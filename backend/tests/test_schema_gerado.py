"""`app.dados.schema`: o bloco gerado de sql/schema.sql em dia com colunas_map e o dicionário."""

from __future__ import annotations

import pytest

from app.dados import schema
from app.dominio.features import COLUNAS_COM_ALVO


def test_bloco_gerado_esta_em_dia() -> None:
    texto = schema.SCHEMA_SQL.read_text(encoding="utf-8")
    assert schema.gerar(texto) == texto, "rode python -m app.dados.schema --gerar e commite"


def test_gerar_e_idempotente_e_preserva_os_comentarios() -> None:
    texto = schema.SCHEMA_SQL.read_text(encoding="utf-8")
    sem_corpo = texto.replace(
        "    genero                             text             NOT NULL,\n", ""
    )
    regenerado = schema.gerar(sem_corpo)
    assert regenerado == texto
    assert "NÃO editar à mão" in regenerado


def test_colunas_esperadas_e_dicionario_coincidem() -> None:
    esperadas = schema.colunas_esperadas()
    assert len(esperadas) == 17
    assert [n for n, _ in esperadas] == [c.lower() for c in COLUNAS_COM_ALVO]
    assert schema.colunas_do_dicionario() == esperadas


def test_gerar_sem_marcas_falha() -> None:
    with pytest.raises(SystemExit):
        schema.gerar("CREATE TABLE x (a int);")


@pytest.mark.banco
def test_conferir_contra_o_banco_semeado(dsn: str) -> None:
    assert schema.conferir(dsn) == 0


def test_cli_gerar_nao_altera_nada(capsys) -> None:
    assert schema.main(["--gerar"]) == 0
    assert "já estava em dia" in capsys.readouterr().out
