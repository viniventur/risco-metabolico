"""`app.diabetes.dados.schema`: o bloco da vertente em dia — e os dois geradores sem se cruzar."""

from __future__ import annotations

import pytest

from app.dados import schema as schema_da_obesidade
from app.diabetes.dados import schema
from app.diabetes.dominio.features import COLUNAS_COM_ALVO

LINHA_GERADA = "    pressao_alta                       text             NOT NULL,\n"


def test_bloco_gerado_esta_em_dia() -> None:
    texto = schema.SCHEMA_SQL.read_text(encoding="utf-8")
    assert schema.gerar(texto) == texto, (
        "rode python -m app.diabetes.dados.schema --gerar e commite"
    )


def test_gerar_e_idempotente_e_preserva_os_comentarios() -> None:
    texto = schema.SCHEMA_SQL.read_text(encoding="utf-8")
    assert LINHA_GERADA in texto
    regenerado = schema.gerar(texto.replace(LINHA_GERADA, ""))
    assert regenerado == texto
    assert "NÃO editar à mão" in regenerado


def test_os_dois_geradores_nao_se_cruzam() -> None:
    """Cada gerador só reescreve o próprio bloco: o da obesidade não vê o desta vertente."""
    texto = schema.SCHEMA_SQL.read_text(encoding="utf-8")
    sem_linha = texto.replace(LINHA_GERADA, "")
    assert schema_da_obesidade.gerar(texto) == texto
    assert schema_da_obesidade.gerar(sem_linha) == sem_linha
    assert not schema.MARCA_INICIO.startswith(schema_da_obesidade.MARCA_INICIO)
    assert not schema.MARCA_FIM.startswith(schema_da_obesidade.MARCA_FIM)


def test_colunas_esperadas_e_dicionario_coincidem() -> None:
    esperadas = schema.colunas_esperadas()
    assert len(esperadas) == 22
    assert [n for n, _ in esperadas] == [c.lower() for c in COLUNAS_COM_ALVO]
    assert schema.colunas_do_dicionario() == esperadas


def test_gerar_sem_marcas_falha() -> None:
    with pytest.raises(SystemExit):
        schema.gerar("CREATE TABLE x (a int);")


def test_cli_gerar_nao_altera_nada(capsys) -> None:
    assert schema.main(["--gerar"]) == 0
    assert "já estava em dia" in capsys.readouterr().out


@pytest.mark.banco
def test_conferir_contra_o_banco_semeado(dsn: str) -> None:
    assert schema.conferir(dsn) == 0
    assert schema.main(["--conferir", "--banco-url", dsn]) == 0
