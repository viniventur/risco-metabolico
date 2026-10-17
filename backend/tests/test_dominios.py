"""DOMINIOS (literal em dominio/regras.py) contra o SELECT DISTINCT da tabela de fonte (§10.6)."""

from __future__ import annotations

import pytest

from app.dominio.features import COLUNAS_BANCO
from app.dominio.regras import DOMINIOS, FAIXAS_TREINO


@pytest.mark.banco
def test_dominios_batem_com_o_banco(dsn: str) -> None:
    import psycopg

    with psycopg.connect(dsn) as con:
        for col, dominio in DOMINIOS.items():
            linhas = con.execute(
                f"SELECT DISTINCT {COLUNAS_BANCO[col]} FROM dados.registros_triagem"
            ).fetchall()
            assert sorted(v for (v,) in linhas) == dominio, col
        for col, (minimo, maximo) in FAIXAS_TREINO.items():
            coluna = COLUNAS_BANCO[col]
            lo, hi = con.execute(
                f"SELECT min({coluna}), max({coluna}) FROM dados.registros_triagem"
            ).fetchone()
            assert (float(lo), float(hi)) == (minimo, maximo), col
