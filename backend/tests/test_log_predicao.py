"""O log grava o que promete (§10.9.2). Marcado `banco`: roda contra o Postgres do compose.

Adaptação do plano: a inspeção usa psycopg (síncrono) em vez de asyncpg, porque o TestClient
roda o app num portal próprio e `await` no loop do pytest cruzaria loops. `drenar` roda no portal.
"""

from __future__ import annotations

import re

import pytest

from tests.conftest import ENTRADA_PADRAO, drenar

URL = "/api/v1/predicoes"


@pytest.mark.banco
def test_log_grava_o_que_promete(cliente, conexao, sumidouro, artefato) -> None:
    resposta = cliente.post(URL, json=ENTRADA_PADRAO, headers={"X-Origem-Cliente": "painel"})
    drenar(cliente, sumidouro)
    linha = conexao.execute(
        "SELECT entrada, saida, versao_modelo, versao_dados, rotulo_saida, risco_acumulado, "
        "latencia_ms, origem, rota, status_http "
        "FROM operacao.log_predicao ORDER BY id DESC LIMIT 1"
    ).fetchone()
    entrada, saida, versao_modelo, versao_dados, rotulo, risco, latencia, origem, rota, status = (
        linha
    )
    corpo = resposta.json()
    assert set(entrada) == set(artefato.colunas)  # allowlist EXATA: 16 chaves
    assert versao_modelo == corpo["versao_modelo"] == artefato.versao
    assert versao_dados == artefato.versao_dados
    assert rotulo == corpo["classe_prevista"]
    assert risco == pytest.approx(corpo["risco_acumulado"], abs=1e-9)
    assert latencia > 0.0
    assert origem == "painel" and rota == "/predicoes" and status == 200
    assert saida["classe_prevista"] == corpo["classe_prevista"]


@pytest.mark.banco
def test_origem_sem_cabecalho_cai_em_api(cliente, conexao, sumidouro) -> None:
    cliente.post(URL, json=ENTRADA_PADRAO)
    drenar(cliente, sumidouro)
    (origem,) = conexao.execute(
        "SELECT origem FROM operacao.log_predicao ORDER BY id DESC LIMIT 1"
    ).fetchone()
    assert origem == "api"
    cliente.post(URL, json=ENTRADA_PADRAO, headers={"X-Origem-Cliente": "qualquer-coisa"})
    drenar(cliente, sumidouro)
    (origem,) = conexao.execute(
        "SELECT origem FROM operacao.log_predicao ORDER BY id DESC LIMIT 1"
    ).fetchone()
    assert origem == "api"


@pytest.mark.banco
@pytest.mark.parametrize("proibido", ["nome", "Fulano", "ip", "user-agent", "testclient"])
def test_log_nao_carrega_identificador(cliente, conexao, sumidouro, proibido: str) -> None:
    cliente.post(f"{URL}/relatorio", json={"entrada": ENTRADA_PADRAO, "nome": "Fulano de Tal"})
    drenar(cliente, sumidouro)
    (tudo,) = conexao.execute(
        "SELECT to_jsonb(t)::text FROM operacao.log_predicao t ORDER BY id DESC LIMIT 1"
    ).fetchone()
    # Varre a LINHA inteira, não só `entrada`. Por palavra: "ip" é substring de "principais".
    assert re.search(rf"\b{re.escape(proibido)}\b", tudo, re.IGNORECASE) is None


@pytest.mark.banco
def test_lote_gera_uma_linha_por_item_com_mesma_correlacao(cliente, conexao, sumidouro) -> None:
    cliente.post(f"{URL}/lote", json={"itens": [ENTRADA_PADRAO] * 3})
    drenar(cliente, sumidouro)
    linhas = conexao.execute(
        "SELECT id_correlacao, origem FROM operacao.log_predicao ORDER BY id DESC LIMIT 3"
    ).fetchall()
    assert len({c for c, _ in linhas}) == 1
    assert {o for _, o in linhas} == {"lote"}


@pytest.mark.banco
def test_health_reporta_gravados(cliente, sumidouro) -> None:
    antes = cliente.get("/api/v1/health").json()["logs_gravados"]
    cliente.post(URL, json=ENTRADA_PADRAO)
    drenar(cliente, sumidouro)
    depois = cliente.get("/api/v1/health").json()
    assert depois["logs_gravados"] == antes + 1
    assert depois["banco"] == "ok" and depois["log_predicao"] == "ok"
