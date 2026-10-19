"""A vertente diabetes no log de predição compartilhado (decisão D5). Marcado `banco`.

A inspeção usa psycopg (síncrono), como tests/test_log_predicao.py: o TestClient roda o app num
portal próprio, e `drenar` espera a fila esvaziar no loop do app.
"""

from __future__ import annotations

import re

import pytest

from app.diabetes.dominio.features import ENTRADAS
from tests.conftest import drenar
from tests.diabetes.conftest import ENTRADA_PADRAO_DIABETES, URL_DIABETES

URL = f"{URL_DIABETES}/predicoes"


def _ultimas(conexao, n: int = 1) -> list[tuple]:
    return conexao.execute(
        "SELECT rota, origem, id_correlacao, entrada, saida, rotulo_saida, risco_acumulado, "
        "versao_modelo, versao_dados, status_http "
        "FROM operacao.log_predicao ORDER BY id DESC LIMIT %s",
        (n,),
    ).fetchall()


@pytest.mark.banco
def test_log_grava_a_linha_da_vertente(cliente, conexao, sumidouro, artefato_diabetes) -> None:
    resposta = cliente.post(
        URL, json=ENTRADA_PADRAO_DIABETES, headers={"X-Origem-Cliente": "painel"}
    )
    drenar(cliente, sumidouro)
    rota, origem, _, entrada, saida, rotulo, risco, versao, versao_dados, status = _ultimas(
        conexao
    )[0]
    corpo = resposta.json()
    assert (rota, origem, status) == ("/diabetes/predicoes", "painel", 200)
    assert set(entrada) == set(ENTRADAS)  # allowlist EXATA: as dez entradas
    assert rotulo == corpo["classificacao"] and saida["probabilidade"] == corpo["probabilidade"]
    assert risco is None, "risco_acumulado é da vertente de obesidade"
    assert versao == artefato_diabetes.versao and versao_dados == artefato_diabetes.versao_dados


def test_deriva_da_obesidade_nao_le_as_linhas_da_vertente(artefato, artefato_diabetes) -> None:
    """As consultas de deriva filtram por versao_modelo E versao_dados do modelo de obesidade."""
    assert artefato_diabetes.versao_dados != artefato.versao_dados


@pytest.mark.banco
@pytest.mark.parametrize("proibido", ["nome", "Fulano", "ip", "user-agent", "testclient"])
def test_log_nao_carrega_identificador(cliente, conexao, sumidouro, proibido: str) -> None:
    cliente.post(
        f"{URL}/relatorio", json={"entrada": ENTRADA_PADRAO_DIABETES, "nome": "Fulano de Tal"}
    )
    drenar(cliente, sumidouro)
    (tudo,) = conexao.execute(
        "SELECT to_jsonb(t)::text FROM operacao.log_predicao t ORDER BY id DESC LIMIT 1"
    ).fetchone()
    assert '"/diabetes/predicoes/relatorio"' in tudo
    assert re.search(rf"\b{re.escape(proibido)}\b", tudo, re.IGNORECASE) is None


@pytest.mark.banco
def test_lote_gera_uma_linha_por_item_com_a_mesma_correlacao(cliente, conexao, sumidouro) -> None:
    cliente.post(f"{URL}/lote", json={"itens": [ENTRADA_PADRAO_DIABETES] * 3})
    drenar(cliente, sumidouro)
    linhas = _ultimas(conexao, 3)
    assert {(rota, origem) for rota, origem, *_ in linhas} == {("/diabetes/predicoes/lote", "lote")}
    assert len({correlacao for _, _, correlacao, *_ in linhas}) == 1
