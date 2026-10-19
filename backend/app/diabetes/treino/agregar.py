"""Materializa os agregados SQL da vertente diabetes e deriva a base do painel dela.

Os JSON de artifacts/diabetes/agregados/ saem de sql/diabetes/agregados/*.sql. O materializador é
o da vertente de obesidade (`app.treino.agregar`), por import e sem edição: o mesmo contrato de
saída (docs/agregados.md), os mesmos cabeçalhos `@` e as mesmas sete invariantes, conferidas linha
a linha. Mudam a tabela, as pastas e a base do painel: data/processado/diabetes/base_painel.parquet,
derivada do snapshot congelado da vertente — as 22 colunas, `linha_origem` e a faixa de IMC, com os
tipos pequenos de `dominio.agregados.tipar`.

Roda fora da transação do snapshot (`python -m app.diabetes.treino snapshot`), como o `agregados`
da vertente de obesidade: antes de materializar, confere que a carga corrente da tabela é a que o
snapshot congelou (§6.7.4), e a sessão usa os mesmos ajustes do congelamento.

Uso: python -m app.diabetes.treino.agregar [--banco-url <dsn>] [--manifesto ...] [--sql ...]
                                           [--agregados ...] [--parquet ...]
"""

from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path
from typing import TYPE_CHECKING, Any

import numpy as np
import pandas as pd

from app.config import CONFIG, RAIZ_REPOSITORIO
from app.diabetes.dominio.agregados import tipar
from app.diabetes.dominio.features import COLUNAS_COM_ALVO
from app.diabetes.dominio.regras import COLUNA_FAIXA_IMC
from app.diabetes.treino import dados
from app.dominio.regras import classificar_imc
from app.treino.agregar import ContratoViolado, ler_cabecalho, materializar

if TYPE_CHECKING:
    import psycopg

MANIFESTO_PADRAO = RAIZ_REPOSITORIO / "artifacts" / "diabetes" / "manifest.json"
SQL_PADRAO = RAIZ_REPOSITORIO / "sql" / "diabetes" / "agregados"
AGREGADOS_PADRAO = RAIZ_REPOSITORIO / "artifacts" / "diabetes" / "agregados"
PARQUET_PADRAO = dados.PASTA_PADRAO / "base_painel.parquet"


def derivar_base_painel(snapshot: pd.DataFrame) -> pd.DataFrame:
    """Snapshot -> base do painel: `linha_origem`, as 22 colunas e a faixa de IMC, tipadas.

    O snapshot está na ordem de `linha_origem`, que é a posição da linha (o seed confere): a
    posição volta a ser a chave. A faixa sai de `classificar_imc`, a regra única, aplicada uma vez
    por valor distinto do IMC.
    """
    base = snapshot[COLUNAS_COM_ALVO].copy()
    base.insert(0, "linha_origem", np.arange(len(base), dtype="int64"))
    faixas = {valor: classificar_imc(valor) for valor in base["IMC"].unique()}
    base.insert(base.columns.get_loc("IMC") + 1, COLUNA_FAIXA_IMC, base["IMC"].map(faixas))
    return tipar(base)


def conferir_carga(con: psycopg.Connection[Any], versao_dados: str) -> None:
    """Fora da transação do snapshot: a tabela ainda é a que o snapshot congelou? (§6.7.4)."""
    with con.cursor() as cur:
        cur.execute(
            "SELECT sha256_arquivo FROM operacao.carga_fonte "
            "WHERE tabela_destino = %s ORDER BY id DESC LIMIT 1",
            (dados.TABELA_ORIGEM,),
        )
        carga = cur.fetchone()
        cur.execute(
            "SELECT sha256_carga FROM operacao.snapshot_treino WHERE versao_dados = %s",
            (versao_dados,),
        )
        snap = cur.fetchone()
    if carga is None or snap is None:
        raise ContratoViolado(
            f"sem carga de {dados.TABELA_ORIGEM} ou sem snapshot registrado para "
            f"versao_dados={versao_dados}: rode o seed e `python -m app.diabetes.treino snapshot`"
        )
    if str(carga[0]).strip() != str(snap[0]).strip():
        raise ContratoViolado(
            f"a carga corrente ({str(carga[0])[:12]}…) não é a que o snapshot {versao_dados} "
            f"congelou ({str(snap[0])[:12]}…): rode `python -m app.diabetes.treino snapshot`"
        )


def listar(sql_agregados: Path) -> list[Any]:
    """Os cabeçalhos dos `.sql` da vertente, em ordem de nome; a vertente não tem projeção."""
    cabecalhos = [ler_cabecalho(p, "agregado") for p in sorted(sql_agregados.glob("*.sql"))]
    ids = [c.id for c in cabecalhos]
    if not ids or len(ids) != len(set(ids)):
        raise ContratoViolado(f"ids de agregado ausentes ou repetidos: {ids}")
    return cabecalhos


def materializar_todos(
    con: psycopg.Connection[Any],
    *,
    versao_dados: str,
    snapshot: pd.DataFrame,
    sql_agregados: Path,
    destino: Path,
    parquet: Path,
    conferir: bool = True,
) -> list[Path]:
    """Deriva o parquet do painel e materializa todos os `.sql`. Devolve os arquivos escritos."""
    if conferir:
        conferir_carga(con, versao_dados)
    base = derivar_base_painel(snapshot)
    parquet.parent.mkdir(parents=True, exist_ok=True)
    base.to_parquet(parquet, index=False)
    escritos = [parquet]
    for cab in listar(sql_agregados):
        escritos.append(materializar(con, cab, versao_dados, destino, n_registros=len(snapshot)))
    return escritos


def _relativo(caminho: Path) -> str:
    """Caminho relativo à raiz do repositório; fora dela (pastas temporárias de teste), absoluto."""
    try:
        return caminho.resolve().relative_to(RAIZ_REPOSITORIO).as_posix()
    except ValueError:
        return caminho.resolve().as_posix()


def main(argv: list[str] | None = None) -> int:
    """Ponto de entrada do CLI; 1 em qualquer falha, com a causa."""
    import psycopg

    parser = argparse.ArgumentParser(
        description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter
    )
    parser.add_argument("--manifesto", type=Path, default=MANIFESTO_PADRAO)
    parser.add_argument("--banco-url", default=None, help="DSN; padrão BANCO_URL")
    parser.add_argument("--sql", type=Path, default=SQL_PADRAO)
    parser.add_argument("--agregados", type=Path, default=AGREGADOS_PADRAO)
    parser.add_argument("--parquet", type=Path, default=PARQUET_PADRAO)
    args = parser.parse_args(argv)

    manifest = json.loads(args.manifesto.read_text(encoding="utf-8"))
    dataset = manifest.get("dataset") or {}
    if not dataset.get("snapshot") or not dataset.get("sha256_snapshot"):
        print("FALHA: manifest sem dataset.snapshot: rode `python -m app.diabetes.treino snapshot`")
        return 1
    caminho = Path(dataset["snapshot"])
    if not caminho.is_absolute():  # pastas temporárias de teste gravam caminho absoluto
        caminho = RAIZ_REPOSITORIO / caminho
    try:
        snapshot = dados.carregar_snapshot(caminho, sha256_esperado=dataset["sha256_snapshot"])
        with psycopg.connect(args.banco_url or CONFIG.banco_url) as con:
            con.execute("SET SESSION timezone = 'UTC'")
            con.execute("SET SESSION extra_float_digits = 3")
            con.execute("SET SESSION max_parallel_workers_per_gather = 0")
            escritos = materializar_todos(
                con,
                versao_dados=dataset["versao_dados"],
                snapshot=snapshot,
                sql_agregados=args.sql,
                destino=args.agregados,
                parquet=args.parquet,
            )
    # ValueError: um valor fora do domínio na base do painel (dominio.agregados.tipar).
    except (FileNotFoundError, RuntimeError, ValueError) as erro:
        print(f"FALHA: {erro}")
        return 1
    for escrito in escritos:
        print(f"escrito: {_relativo(escrito)}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
