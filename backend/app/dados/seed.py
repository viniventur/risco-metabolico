"""Semeadura do Postgres a partir do CSV público: csv -> dados.registros_triagem, idempotente.

As cinco verificações, em ordem (§4.3.5): citação presente em FONTE.md, schema nominal (nomes E
ordem), carga já existente por sha256, contagem real na tabela e contagem após o COPY. Rodar duas
vezes com o mesmo arquivo não escreve nada; rodar com um arquivo diferente recarrega inteiro.

Uso:
    python -m app.dados.seed --arquivo ../data/bruto/obesity.csv --tabela dados.registros_triagem
    python -m app.dados.seed ... --conferir      # modo de verificação do CI: nunca escreve
"""

from __future__ import annotations

import argparse
import hashlib
import re
import sys
from pathlib import Path
from typing import TYPE_CHECKING, Any

import pandas as pd

from app.config import CONFIG, RAIZ_REPOSITORIO

if TYPE_CHECKING:
    import psycopg
from app.dominio.features import COLUNAS_BANCO, COLUNAS_COM_ALVO, preparar_base
from app.dominio.regras import ROTULOS_ESCALA

FONTE_MD = RAIZ_REPOSITORIO / "data" / "bruto" / "FONTE.md"
TABELA_PADRAO = "dados.registros_triagem"
_TABELA_VALIDA = re.compile(r"^[a-z_][a-z0-9_]*\.[a-z_][a-z0-9_]*$")

SQL_CARGA_EXISTENTE = (
    "SELECT id, linhas_inseridas, sha256_fonte_md FROM operacao.carga_fonte "
    "WHERE tabela_destino = %s AND sha256_arquivo = %s"
)
SQL_INSERIR_CARGA = (
    "INSERT INTO operacao.carga_fonte "
    "(tabela_destino, arquivo_origem, sha256_arquivo, sha256_fonte_md, "
    "linhas_arquivo, linhas_inseridas) "
    "VALUES (%s, %s, %s, %s, %s, %s) "
    "ON CONFLICT (tabela_destino, sha256_arquivo) DO UPDATE SET "
    "executado_em = now(), sha256_fonte_md = EXCLUDED.sha256_fonte_md, "
    "linhas_inseridas = EXCLUDED.linhas_inseridas "
    "RETURNING id"
)
SQL_ATUALIZAR_CARGA = "UPDATE operacao.carga_fonte SET linhas_inseridas = %s WHERE id = %s"
SQL_ATUALIZAR_FONTE = "UPDATE operacao.carga_fonte SET sha256_fonte_md = %s WHERE id = %s"
SQL_INSERIR_ROTULO = (
    "INSERT INTO dados.rotulos_escala (coluna, valor, rotulo, ordem) VALUES (%s, %s, %s, %s)"
)


class CitacaoAusente(RuntimeError):
    """FONTE.md ausente, citação vazia ou PENDENTE: a base não entra no banco sem crédito."""


def sha256_arquivo(caminho: Path) -> str:
    """sha256 do arquivo inteiro, em hexadecimal."""
    return hashlib.sha256(caminho.read_bytes()).hexdigest()


def conferir_citacao(fonte_md: Path = FONTE_MD) -> None:
    """0. Proveniência (§3.2): falha antes da transação se a citação não estiver completa."""
    if not fonte_md.exists():
        raise CitacaoAusente(f"{fonte_md.name} não existe: a base não é semeada sem citação")
    texto = fonte_md.read_text(encoding="utf-8")
    bloco = re.search(r"(?s)citacao-inicio -->(.*?)<!-- citacao-fim", texto)
    if bloco is None or not bloco.group(1).strip():
        raise CitacaoAusente(
            "bloco <!-- citacao-inicio --> ... <!-- citacao-fim --> vazio ou ausente"
        )
    if "PENDENTE" in bloco.group(1):
        raise CitacaoAusente("a citação de FONTE.md ainda está PENDENTE")


def nome_de_origem(arquivo: Path) -> str:
    """Só o nome do arquivo vai para `arquivo_origem`: caminho absoluto é item da lista negra."""
    return arquivo.name


def preparar_quadro(arquivo: Path) -> pd.DataFrame:
    """CSV público -> DataFrame com as colunas do BANCO (snake_case), na ordem canônica.

    `linha_origem` (a ordem no arquivo) entra na posição 0: é a única chave natural da base e o
    que torna o SELECT do snapshot determinístico (§4.3.6).
    """
    quadro = preparar_base(pd.read_csv(arquivo))  # renomeia, arredonda, traduz
    faltam = [c for c in COLUNAS_COM_ALVO if c not in quadro.columns]
    if faltam:
        raise ValueError(f"colunas ausentes no CSV após a preparação: {faltam}")
    if quadro[COLUNAS_COM_ALVO].isnull().any().any():
        raise ValueError("a preparação produziu nulos: tradução de valor fora do dicionário?")
    quadro = quadro[COLUNAS_COM_ALVO].rename(columns=COLUNAS_BANCO)
    quadro.insert(0, "linha_origem", range(len(quadro)))
    return quadro


def conferir_schema(con: psycopg.Connection[Any], quadro: pd.DataFrame, tabela: str) -> None:
    """1. Nomes E ordem das colunas do DataFrame contra `information_schema.columns` da tabela.

    Falha com o diff nominal, nunca com "número de colunas diferente".
    """
    schema, nome = tabela.split(".")
    linhas = con.execute(
        "SELECT column_name FROM information_schema.columns "
        "WHERE table_schema = %s AND table_name = %s ORDER BY ordinal_position",
        (schema, nome),
    ).fetchall()
    no_banco = [str(ln[0]) for ln in linhas]
    if not no_banco:
        raise RuntimeError(f"tabela {tabela} não existe: aplique sql/schema.sql antes do seed")
    esperado = list(quadro.columns) + ["carga_id"]
    if no_banco != esperado:
        diff = [
            f"  posição {i}: banco={no_banco[i] if i < len(no_banco) else None} "
            f"| csv={esperado[i] if i < len(esperado) else None}"
            for i in range(max(len(no_banco), len(esperado)))
            if (no_banco[i] if i < len(no_banco) else None)
            != (esperado[i] if i < len(esperado) else None)
        ]
        raise RuntimeError(
            "schema da tabela diverge das colunas do CSV preparado:\n" + "\n".join(diff)
        )


def _linhas_rotulos() -> list[tuple[str, int, str, int]]:
    """Linhas de dados.rotulos_escala a partir de ROTULOS_ESCALA: uma fonte só."""
    linhas: list[tuple[str, int, str, int]] = []
    for coluna, rotulos in ROTULOS_ESCALA.items():
        for ordem, (valor, rotulo) in enumerate(sorted(rotulos.items())):
            linhas.append((coluna, valor, rotulo, ordem))
    return linhas


def semear(arquivo: Path, tabela: str, dsn: str, *, conferir: bool = False) -> int:
    """Carrega o CSV público na tabela de fonte, idempotente por sha256; devolve as linhas."""
    import psycopg  # extra `treino`

    if not _TABELA_VALIDA.match(tabela):
        raise ValueError(f"nome de tabela inválido: {tabela!r}")
    conferir_citacao(FONTE_MD)  # 0. proveniência (§3.2)
    sha = sha256_arquivo(arquivo)
    sha_fonte = sha256_arquivo(FONTE_MD)
    quadro = preparar_quadro(arquivo)
    colunas = list(quadro.columns) + ["carga_id"]

    with psycopg.connect(dsn) as con:
        conferir_schema(con, quadro, tabela)  # 1. nomes e ordem
        with con.cursor() as cur:
            cur.execute(SQL_CARGA_EXISTENTE, (tabela, sha))
            linha = cur.fetchone()
            if linha is not None:
                carga_id, linhas_registradas, sha_fonte_banco = linha
                cur.execute(f"SELECT count(*) FROM {tabela}")  # 2. contagem real
                contagem = cur.fetchone()[0]  # type: ignore[index]
                if contagem == linhas_registradas == len(quadro):
                    if sha_fonte_banco.strip() != sha_fonte:
                        # A citação mudou, o dado não: atualiza só a amarração (§3.2).
                        if conferir:
                            print("FONTE.md mudou desde a semeadura — rode o seed de novo")
                            return 1
                        cur.execute(SQL_ATUALIZAR_FONTE, (sha_fonte, carga_id))
                        con.commit()
                        print(f"FONTE.md mudou: hash da citação atualizado na carga {carga_id}")
                        return 0
                    print(f"nada a fazer: {tabela} já carregada de {nome_de_origem(arquivo)}")
                    return 0
                print("ATENÇÃO: carga registrada mas contagem divergente; recarregando")
        if conferir:
            print(f"{tabela} NÃO está carregada de {nome_de_origem(arquivo)} (modo --conferir)")
            return 1
        # 3. Tudo em UMA transação: ou a tabela fica coerente, ou não muda.
        with con.transaction(), con.cursor() as cur:
            cur.execute(f"TRUNCATE {tabela} CASCADE")
            cur.execute(
                SQL_INSERIR_CARGA,
                (tabela, nome_de_origem(arquivo), sha, sha_fonte, len(quadro), len(quadro)),
            )
            carga_id = cur.fetchone()[0]  # type: ignore[index]
            quadro["carga_id"] = carga_id
            with cur.copy(f"COPY {tabela} ({', '.join(colunas)}) FROM STDIN") as copia:
                for registro in quadro.itertuples(index=False):
                    copia.write_row(tuple(v.item() if hasattr(v, "item") else v for v in registro))
            cur.execute(f"SELECT count(*) FROM {tabela}")
            inseridas = cur.fetchone()[0]  # type: ignore[index]
            if inseridas != len(quadro):  # 4. contagem pós-carga
                raise RuntimeError(f"esperado {len(quadro)}, inserido {inseridas}")
            cur.execute(SQL_ATUALIZAR_CARGA, (inseridas, carga_id))
            cur.execute("TRUNCATE dados.rotulos_escala")
            cur.executemany(SQL_INSERIR_ROTULO, _linhas_rotulos())
    print(f"{tabela}: {inseridas} linhas inseridas de {nome_de_origem(arquivo)} (carga {carga_id})")
    return inseridas


def main(argv: list[str] | None = None) -> int:
    """Ponto de entrada do CLI."""
    parser = argparse.ArgumentParser(
        description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter
    )
    parser.add_argument(
        "--arquivo", type=Path, default=RAIZ_REPOSITORIO / "data" / "bruto" / "obesity.csv"
    )
    parser.add_argument("--tabela", default=TABELA_PADRAO)
    parser.add_argument(
        "--banco-url", default=None, help="DSN; padrão: BANCO_URL (CONFIG.banco_url)"
    )
    parser.add_argument(
        "--conferir", action="store_true", help="só verifica; sai 1 se precisar semear"
    )
    args = parser.parse_args(argv)
    try:
        resultado = semear(
            args.arquivo.resolve(),
            args.tabela,
            args.banco_url or CONFIG.banco_url,
            conferir=args.conferir,
        )
    except (CitacaoAusente, RuntimeError, ValueError) as erro:
        print(f"FALHA: {erro}")
        return 1
    return 1 if args.conferir and resultado == 1 else 0


if __name__ == "__main__":
    sys.exit(main())
