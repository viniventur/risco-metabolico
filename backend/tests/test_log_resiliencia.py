"""O log não pode derrubar a predição (§10.9.2). Roda SEM banco, na suíte principal."""

from __future__ import annotations

import time

import pytest
from fastapi.testclient import TestClient

from app.config import recarregar_config
from tests.conftest import ENTRADA_PADRAO

URL = "/api/v1/predicoes"


@pytest.fixture
def cliente_banco_morto(monkeypatch):
    """O ambiente é sujado ANTES do lifespan; por isso a fábrica criar_app().

    monkeypatch.setenv depois de a fixture `cliente` ter rodado o lifespan não muda nada: o pool
    já nasceu de CONFIG.banco_url, lido no import. E se BANCO_HABILITADO for false na suíte,
    `consultar` devolve None na hora e o teste passa por um motivo que não é o testado.
    """
    monkeypatch.setenv("BANCO_URL", "postgresql://x:x@127.0.0.1:1/x")
    monkeypatch.setenv("BANCO_HABILITADO", "true")
    monkeypatch.setenv("BANCO_TIMEOUT_CONEXAO_S", "5")
    monkeypatch.setenv("N_MINIMO_DERIVA", "100")
    recarregar_config()
    from app.main import criar_app

    try:
        with TestClient(criar_app()) as c:
            yield c
    finally:
        monkeypatch.undo()
        recarregar_config()


def test_predicao_responde_com_banco_fora(cliente_banco_morto) -> None:
    """Pool apontado para uma porta fechada: a predição ainda responde 200, e rápido."""
    inicio = time.perf_counter()
    resposta = cliente_banco_morto.post(URL, json=ENTRADA_PADRAO)
    decorrido = time.perf_counter() - inicio
    assert resposta.status_code == 200
    assert resposta.json()["classe_prevista"]
    assert decorrido < 1.0  # a resposta NÃO espera o timeout de 5 s do pool
    # E o /health tem que ADMITIR a degradação, senão o teste passaria com o log simplesmente
    # desligado — que é o falso verde que esta fixture existe para evitar.
    for _ in range(50):
        saude = cliente_banco_morto.get("/api/v1/health").json()
        if saude["log_predicao"] == "degradado":
            break
        time.sleep(0.05)
    assert saude["log_predicao"] == "degradado"
    assert saude["banco"] == "indisponivel"
    assert saude["status"] == "ok"


def test_falha_do_sumidouro_nao_vira_500(cliente, monkeypatch, sumidouro) -> None:
    """Quebra a fila POR DENTRO: é o `registrar` real que precisa segurar."""

    def explodir(_item):  # noqa: ANN001, ANN202
        raise RuntimeError("fila quebrada")

    monkeypatch.setattr(sumidouro._fila, "put_nowait", explodir)
    antes = sumidouro.descartados
    assert cliente.post(URL, json=ENTRADA_PADRAO).status_code == 200
    for _ in range(50):
        if sumidouro.descartados > antes:
            break
        time.sleep(0.02)
    assert sumidouro.descartados > antes


def test_fila_recebe_de_rota_sincrona(cliente, sumidouro, monkeypatch) -> None:
    """Guarda o `call_soon_threadsafe`: chama a rota SÍNCRONA real e afirma que a fila recebeu."""
    recebidos: list = []
    monkeypatch.setattr(sumidouro._fila, "put_nowait", recebidos.append)
    assert cliente.post(URL, json=ENTRADA_PADRAO).status_code == 200
    for _ in range(50):
        if recebidos:
            break
        time.sleep(0.02)
    assert len(recebidos) == 1
    registro = recebidos[0]
    assert set(registro.entrada) == set(ENTRADA_PADRAO)
    assert registro.rota == "/predicoes"


def test_log_desligado_nao_enfileira_nem_derruba(cliente, sumidouro, monkeypatch) -> None:
    monkeypatch.setattr("app.nucleo.log_predicao.CONFIG.log_predicao_habilitado", False)
    recebidos: list = []
    monkeypatch.setattr(sumidouro._fila, "put_nowait", recebidos.append)
    assert cliente.post(URL, json=ENTRADA_PADRAO).status_code == 200
    time.sleep(0.1)
    assert recebidos == []


def test_payload_acima_do_teto_e_descartado_sem_erro(cliente, sumidouro, monkeypatch) -> None:
    monkeypatch.setattr("app.nucleo.log_predicao.CONFIG.limite_payload_log_bytes", 10)
    antes = sumidouro.descartados
    assert cliente.post(URL, json=ENTRADA_PADRAO).status_code == 200
    for _ in range(50):
        if sumidouro.descartados > antes:
            break
        time.sleep(0.02)
    assert sumidouro.descartados == antes + 1
