"""Materializa artifacts/agregados/*.json a partir de sql/agregados/*.sql e sql/pontos/*.sql.

Contrato de saída único (docs/agregados.md). NENHUM cálculo acontece aqui: o Python lê, executa,
valida e serializa. Também deriva `data/processado/base_painel.parquet` do snapshot congelado —
o parquet que os endpoints `/painel/*` e `/registros` servem de memória.
"""

from __future__ import annotations

import hashlib
import json
import math
import re
from dataclasses import dataclass, field
from datetime import UTC, datetime
from pathlib import Path
from typing import TYPE_CHECKING, Any

import pandas as pd

from app.dominio.features import COLUNAS_COM_ALVO, COLUNAS_ESCALAS
from app.dominio.regras import ORDEM_CLINICA

if TYPE_CHECKING:
    import psycopg

COLUNAS_CONTRATO = (
    "agregado_id",
    "ordem",
    "dim1_nome",
    "dim1_valor",
    "dim2_nome",
    "dim2_valor",
    "medida",
    "valor",
    "valor_texto",
    "n",
    "suprimido",
)
COLUNAS_PONTOS = ("altura", "peso", "imc", "nivel")
CLASSES_MEDIDA = {"contagem", "media_limitada", "proporcao", "texto"}
TIPOS_DIMENSAO = {"texto", "inteiro"}
TETO_BYTES = 300 * 1024  # o mesmo teto de §3.1 e §10.6
TETO_LINHAS = 2_500  # a projeção de pontos carrega as 2.111 linhas da base
PREFIXO_PONTOS = "pontos-"
_CHAVE = re.compile(r"^--\s*@(\w+):\s*(.*)$")
_CONTINUACAO = re.compile(r"^--\s{2,}(\S.*)$")


class ContratoViolado(RuntimeError):
    """A query não respeitou o contrato. Sempre fatal — nunca aviso."""


@dataclass
class Cabecalho:
    """O bloco `-- @chave: valor` que abre todo `.sql` (§6.7.2). O materializador o parseia."""

    arquivo: Path
    tipo: str  # "agregado" | "pontos"
    id: str = ""
    titulo: str = ""
    mede: str = ""
    origem: str = ""
    fonte: list[str] = field(default_factory=list)
    dimensoes: list[tuple[str, str]] = field(default_factory=list)
    medidas: list[tuple[str, str]] = field(default_factory=list)
    amostra_minima: int | None = None
    suprime_quando: str | None = None
    divergencia: str | None = None
    sql: str = ""

    @property
    def id_esperado(self) -> str:
        """`@id` tem de ser igual ao nome do arquivo (com prefixo `pontos-` para a projeção)."""
        stem = self.arquivo.stem
        return f"{PREFIXO_PONTOS}{stem}" if self.tipo == "pontos" else stem


def ler_cabecalho(arquivo: Path, tipo: str) -> Cabecalho:
    """Parseia as chaves `@` do topo do arquivo; falha em chave desconhecida ou `@id` divergente."""
    texto = arquivo.read_text(encoding="utf-8")
    cab = Cabecalho(arquivo=arquivo, tipo=tipo, sql=texto)
    ultima: str | None = None
    for linha in texto.splitlines():
        m = _CHAVE.match(linha)
        if m:
            chave, valor = m.group(1), m.group(2).strip()
            ultima = chave
            _atribuir(cab, chave, valor)
            continue
        c = _CONTINUACAO.match(linha)
        if c and ultima in ("mede", "titulo", "origem"):
            setattr(cab, ultima, (getattr(cab, ultima) + " " + c.group(1).strip()).strip())
            continue
        if not linha.startswith("--") and linha.strip():
            break  # começou o SQL
    if cab.id != cab.id_esperado:
        raise ContratoViolado(
            f"{arquivo.name}: @id={cab.id!r} difere do nome esperado {cab.id_esperado!r}"
        )
    if not cab.titulo or not cab.mede or not cab.origem or not cab.fonte:
        raise ContratoViolado(f"{arquivo.name}: faltam @titulo, @mede, @origem ou @fonte")
    if tipo == "agregado" and not cab.medidas:
        raise ContratoViolado(f"{arquivo.name}: pelo menos uma @medida é obrigatória")
    return cab


def _atribuir(cab: Cabecalho, chave: str, valor: str) -> None:
    if chave in ("id", "titulo", "mede", "origem"):
        setattr(cab, chave, valor)
    elif chave == "fonte":
        cab.fonte = [v.strip() for v in valor.split(",") if v.strip()]
    elif chave == "dimensao":
        nome, _, tipo = valor.partition(":")
        if tipo.strip() not in TIPOS_DIMENSAO:
            raise ContratoViolado(
                f"{cab.arquivo.name}: tipo de dimensão {tipo!r} não é texto|inteiro"
            )
        cab.dimensoes.append((nome.strip(), tipo.strip()))
    elif chave == "medida":
        nome, _, classe = valor.partition(":")
        if classe.strip() not in CLASSES_MEDIDA:
            raise ContratoViolado(
                f"{cab.arquivo.name}: classe de medida {classe!r} fora de {sorted(CLASSES_MEDIDA)}"
            )
        cab.medidas.append((nome.strip(), classe.strip()))
    elif chave == "amostra_minima":
        cab.amostra_minima = None if valor in ("-", "") else int(valor)
    elif chave == "suprime_quando":
        cab.suprime_quando = None if valor in ("-", "") else valor
    elif chave == "divergencia":
        cab.divergencia = None if valor in ("-", "") else valor
    else:
        raise ContratoViolado(f"{cab.arquivo.name}: chave @{chave} desconhecida")


def _num(v: Any) -> float | None:
    if v is None:
        return None
    f = float(v)
    if math.isnan(f) or math.isinf(f):
        raise ContratoViolado("valor NaN ou infinito: JSON não os representa (invariante 7)")
    return f


def _validar_agregado(
    cab: Cabecalho, linhas: list[dict[str, Any]], colunas: tuple[str, ...]
) -> None:
    """As 7 invariantes de §6.7.2, linha a linha."""
    if colunas != COLUNAS_CONTRATO:
        raise ContratoViolado(f"{cab.id}: colunas {colunas} diferem do contrato {COLUNAS_CONTRATO}")
    if len(linhas) > TETO_LINHAS:
        raise ContratoViolado(f"{cab.id}: {len(linhas)} linhas acima do teto de {TETO_LINHAS}")
    nomes_dim = {n for n, _ in cab.dimensoes}
    nomes_med = {n for n, _ in cab.medidas}
    vistas: set[tuple[Any, Any, Any]] = set()
    dims_vistas: set[str] = set()
    meds_vistas: set[str] = set()
    for i, ln in enumerate(linhas, start=1):
        if ln["agregado_id"] != cab.id:
            raise ContratoViolado(
                f"{cab.id}: agregado_id {ln['agregado_id']!r} na linha {i} (invariante 1)"
            )
        if int(ln["ordem"]) != i:
            raise ContratoViolado(
                f"{cab.id}: ordem {ln['ordem']} na linha {i}, esperado {i} (invariante 6)"
            )
        for k in (1, 2):
            nome, valor = ln[f"dim{k}_nome"], ln[f"dim{k}_valor"]
            if (nome is None) != (valor is None):
                raise ContratoViolado(
                    f"{cab.id}: dim{k}_nome/dim{k}_valor meio nulos na linha {i} (invariante 2)"
                )
            if nome is not None:
                if nome not in nomes_dim:
                    raise ContratoViolado(
                        f"{cab.id}: dimensão {nome!r} não declarada (invariante 3)"
                    )
                dims_vistas.add(nome)
        if ln["dim2_nome"] is not None and ln["dim1_nome"] is None:
            raise ContratoViolado(f"{cab.id}: dim2 sem dim1 na linha {i} (invariante 2)")
        if ln["medida"] not in nomes_med:
            raise ContratoViolado(f"{cab.id}: medida {ln['medida']!r} não declarada (inv. 3)")
        meds_vistas.add(ln["medida"])
        valor, texto, n, suprimido = (
            _num(ln["valor"]),
            ln["valor_texto"],
            int(ln["n"]),
            bool(ln["suprimido"]),
        )
        if suprimido and (valor is not None or texto is not None):
            raise ContratoViolado(f"{cab.id}: linha {i} suprimida com valor (invariante 4)")
        if not suprimido:
            preenchidos = (valor is not None) + (texto is not None)
            if preenchidos == 0 and n != 0:
                raise ContratoViolado(f"{cab.id}: linha {i} sem valor com n={n} (invariante 4)")
            if preenchidos == 2:
                raise ContratoViolado(f"{cab.id}: linha {i} com valor E valor_texto (invariante 4)")
        chave = (ln["dim1_valor"], ln["dim2_valor"], ln["medida"])
        if chave in vistas:
            raise ContratoViolado(f"{cab.id}: chave repetida {chave} (invariante 5)")
        vistas.add(chave)
    if dims_vistas != nomes_dim:
        raise ContratoViolado(
            f"{cab.id}: dimensões declaradas {sorted(nomes_dim)} "
            f"≠ usadas {sorted(dims_vistas)} (inv. 3)"
        )
    if meds_vistas != nomes_med:
        raise ContratoViolado(
            f"{cab.id}: medidas declaradas {sorted(nomes_med)} "
            f"≠ usadas {sorted(meds_vistas)} (inv. 3)"
        )


def _validar_pontos(
    cab: Cabecalho, linhas: list[dict[str, Any]], colunas: tuple[str, ...], n_esperado: int
) -> None:
    """Invariantes da projeção: contagem, IMC conferido, nenhum nulo, nível no domínio."""
    if colunas != COLUNAS_PONTOS:
        raise ContratoViolado(f"{cab.id}: colunas {colunas} diferem de {COLUNAS_PONTOS}")
    if len(linhas) != n_esperado or len(linhas) > TETO_LINHAS:
        raise ContratoViolado(f"{cab.id}: {len(linhas)} linhas, esperado {n_esperado}")
    for i, ln in enumerate(linhas, start=1):
        if any(ln[c] is None for c in COLUNAS_PONTOS):
            raise ContratoViolado(f"{cab.id}: nulo na linha {i}")
        altura, peso, imc = float(ln["altura"]), float(ln["peso"]), float(ln["imc"])
        if abs(imc - peso / (altura**2)) > 1e-9:
            raise ContratoViolado(f"{cab.id}: imc da linha {i} não bate com peso/altura²")
        if ln["nivel"] not in ORDEM_CLINICA:
            raise ContratoViolado(f"{cab.id}: nível {ln['nivel']!r} fora do domínio na linha {i}")


def _linha_json(cab: Cabecalho, ln: dict[str, Any]) -> dict[str, Any]:
    doc: dict[str, Any] = {"ordem": int(ln["ordem"])}
    for k in (1, 2):
        if ln[f"dim{k}_nome"] is not None:
            doc[str(ln[f"dim{k}_nome"])] = str(
                ln[f"dim{k}_valor"]
            )  # valor de dimensão é SEMPRE string
    doc["medida"] = ln["medida"]
    if ln["valor_texto"] is not None:
        doc["valor_texto"] = ln["valor_texto"]
    else:
        doc["valor"] = _num(ln["valor"])
    doc["n"] = int(ln["n"])
    doc["suprimido"] = bool(ln["suprimido"])
    return doc


def materializar(
    con: psycopg.Connection[Any],
    cab: Cabecalho,
    versao_dados: str,
    destino: Path,
    *,
    n_registros: int,
) -> Path:
    """Executa o `.sql`, valida o contrato e grava `destino/<id>.json`."""
    from psycopg.rows import dict_row

    with con.cursor(row_factory=dict_row) as cur:
        cur.execute(cab.sql)
        colunas = tuple(d.name for d in cur.description or [])
        linhas = cur.fetchall()
    doc: dict[str, Any] = {
        "id": cab.id,
        "titulo": cab.titulo,
        "mede": cab.mede,
        "origem": cab.origem,
        "fonte": cab.fonte,
        "versao_dados": versao_dados,
        "sql_sha256": hashlib.sha256(cab.sql.encode("utf-8")).hexdigest(),
        "gerado_em": datetime.now(UTC).isoformat(timespec="seconds"),
    }
    if cab.tipo == "pontos":
        _validar_pontos(cab, linhas, colunas, n_registros)
        doc["colunas"] = list(COLUNAS_PONTOS)
        doc["total_linhas"] = len(linhas)
        doc["linhas"] = [
            {
                "altura": float(ln["altura"]),
                "peso": float(ln["peso"]),
                "imc": float(ln["imc"]),
                "nivel": ln["nivel"],
            }
            for ln in linhas
        ]
        bruto = json.dumps(doc, ensure_ascii=False, separators=(",", ":"), allow_nan=False)
    else:
        _validar_agregado(cab, linhas, colunas)
        doc["dimensoes"] = [{"nome": n, "tipo": t} for n, t in cab.dimensoes]
        doc["medidas"] = [{"nome": n, "classe": c} for n, c in cab.medidas]
        doc["amostra_minima"] = cab.amostra_minima
        doc["divergencia"] = cab.divergencia
        doc["total_linhas"] = len(linhas)
        doc["linhas"] = [_linha_json(cab, ln) for ln in linhas]
        bruto = json.dumps(doc, ensure_ascii=False, indent=2, allow_nan=False)
    if len(bruto.encode("utf-8")) > TETO_BYTES:
        raise ContratoViolado(f"{cab.id}: {len(bruto)} bytes acima do teto de {TETO_BYTES}")
    destino.mkdir(parents=True, exist_ok=True)
    arquivo = destino / f"{cab.id}.json"
    arquivo.write_text(bruto + "\n", encoding="utf-8", newline="\n")
    return arquivo


def listar(sql_agregados: Path, sql_pontos: Path) -> list[Cabecalho]:
    """Os cabeçalhos de todos os `.sql`, em ordem de nome, agregados primeiro."""
    cabs = [ler_cabecalho(p, "agregado") for p in sorted(sql_agregados.glob("*.sql"))]
    cabs += [ler_cabecalho(p, "pontos") for p in sorted(sql_pontos.glob("*.sql"))]
    return cabs


def conferir_carga(con: psycopg.Connection[Any], versao_dados: str) -> None:
    """Fora da transação de `congelar`: a tabela ainda é a que o snapshot congelou? (§6.7.4)."""
    with con.cursor() as cur:
        cur.execute(
            "SELECT sha256_arquivo FROM operacao.carga_fonte "
            "WHERE tabela_destino = 'dados.registros_triagem' ORDER BY id DESC LIMIT 1"
        )
        carga = cur.fetchone()
        cur.execute(
            "SELECT sha256_carga FROM operacao.snapshot_treino WHERE versao_dados = %s",
            (versao_dados,),
        )
        snap = cur.fetchone()
    if carga is None or snap is None:
        raise ContratoViolado(
            f"sem carga ou sem snapshot registrado para versao_dados={versao_dados}"
        )
    if str(carga[0]).strip() != str(snap[0]).strip():
        raise ContratoViolado(
            f"a carga corrente ({str(carga[0])[:12]}…) não é a que o snapshot "
            f"{versao_dados} congelou "
            f"({str(snap[0])[:12]}…): rode `congelar` de novo"
        )


def ler_rotulos(con: psycopg.Connection[Any]) -> dict[str, dict[int, str]]:
    """`dados.rotulos_escala` -> {coluna: {valor: rotulo}} (semeada de ROTULOS_ESCALA)."""
    rotulos: dict[str, dict[int, str]] = {}
    with con.cursor() as cur:
        cur.execute("SELECT coluna, valor, rotulo FROM dados.rotulos_escala ORDER BY coluna, valor")
        for coluna, valor, rotulo in cur.fetchall():
            rotulos.setdefault(str(coluna), {})[int(valor)] = str(rotulo)
    return rotulos


def derivar_base_painel(snapshot: pd.DataFrame, rotulos: dict[str, dict[int, str]]) -> pd.DataFrame:
    """Snapshot -> base do painel: `linha_origem`, as 17 colunas, `IMC` e `*_rotulo`.

    As 5 escalas vão em DUAS colunas: o inteiro (eixo e ordenação) e o rótulo de exibição
    (`dados.rotulos_escala`). A rotulagem é de apresentação e independe do binning do modelo.
    """
    base = snapshot[COLUNAS_COM_ALVO].copy()
    base.insert(0, "linha_origem", range(len(base)))
    base["IMC"] = base["Peso"] / (base["Altura"] ** 2)
    for col in COLUNAS_ESCALAS:
        mapa = rotulos.get(col, {})
        base[f"{col}_rotulo"] = base[col].map(mapa).astype("object")
        if base[f"{col}_rotulo"].isnull().any():
            raise ContratoViolado(f"rótulo ausente em dados.rotulos_escala para valores de {col}")
    return base


def materializar_todos(
    con: psycopg.Connection[Any],
    *,
    versao_dados: str,
    snapshot: pd.DataFrame,
    sql_agregados: Path,
    sql_pontos: Path,
    destino: Path,
    parquet: Path,
    conferir: bool = False,
) -> list[Path]:
    """Deriva o parquet do painel e materializa todos os `.sql`. Devolve os arquivos escritos."""
    if conferir:
        conferir_carga(con, versao_dados)
    base = derivar_base_painel(snapshot, ler_rotulos(con))
    parquet.parent.mkdir(parents=True, exist_ok=True)
    base.to_parquet(parquet, index=False)
    escritos = [parquet]
    cabs = listar(sql_agregados, sql_pontos)
    ids = [c.id for c in cabs]
    if len(ids) != len(set(ids)):
        raise ContratoViolado(f"ids de agregado repetidos: {ids}")
    for cab in cabs:
        escritos.append(materializar(con, cab, versao_dados, destino, n_registros=len(snapshot)))
    return escritos
