"""Contrato (§10.6): snapshot do OpenAPI, cobertura de /metadata, envelope de erro, cache e saúde.

O snapshot em tests/contrato/openapi.json quebra o CI quando o contrato muda SEM intenção.
Para regenerar de propósito: ATUALIZAR_CONTRATO=1 pytest tests/test_contrato_api.py.
"""

from __future__ import annotations

import json
import os
from pathlib import Path

from app.config import CONFIG
from app.esquemas.entrada import EntradaTriagem
from tests.conftest import ENTRADA_PADRAO

SNAPSHOT = Path(__file__).resolve().parent / "contrato" / "openapi.json"


def _normalizar(doc: dict) -> str:
    return json.dumps(doc, sort_keys=True, ensure_ascii=False, indent=2)


def test_openapi_snapshot(cliente) -> None:
    atual = cliente.get("/openapi.json").json()
    if os.environ.get("ATUALIZAR_CONTRATO") == "1" or not SNAPSHOT.exists():
        SNAPSHOT.parent.mkdir(parents=True, exist_ok=True)
        SNAPSHOT.write_text(_normalizar(atual) + "\n", encoding="utf-8", newline="\n")
    esperado = json.loads(SNAPSHOT.read_text(encoding="utf-8"))
    assert _normalizar(atual) == _normalizar(esperado), (
        "o contrato OpenAPI mudou; se foi de propósito, regenere com ATUALIZAR_CONTRATO=1"
    )


def test_openapi_nao_vaza_pandas_nem_sklearn(cliente) -> None:
    texto = cliente.get("/openapi.json").text
    assert "pandas" not in texto and "sklearn" not in texto and "numpy" not in texto


def test_metadata_cobre_cem_por_cento_dos_campos_de_entrada(cliente) -> None:
    corpo = cliente.get("/api/v1/metadata").json()
    nomes = {campo["nome"] for grupo in corpo["grupos"] for campo in grupo["campos"]}
    aliases = {f.alias for f in EntradaTriagem.model_fields.values() if f.alias}
    assert nomes == aliases
    assert len(nomes) == 16
    assert [g["id"] for g in corpo["grupos"]] == ["dados-iniciais", "dieta", "habitos"]
    assert "fictícios" in corpo["aviso"] and "anônima" in corpo["aviso"]


def test_metadata_opcoes_respeitam_o_dominio_do_contrato(cliente) -> None:
    """Toda opção oferecida pelo formulário é aceita pela API (o legado oferecia 2 que não eram)."""
    corpo = cliente.get("/api/v1/metadata").json()
    for grupo in corpo["grupos"]:
        for campo in grupo["campos"]:
            for opcao in campo["opcoes"]:
                resposta = cliente.post(
                    "/api/v1/predicoes", json=ENTRADA_PADRAO | {campo["nome"]: opcao["valor"]}
                )
                assert resposta.status_code == 200, (campo["nome"], opcao)


def test_metadata_tem_cache_e_etag_com_304(cliente) -> None:
    primeira = cliente.get("/api/v1/metadata")
    assert primeira.headers["cache-control"] == "public, max-age=3600"
    etag = primeira.headers["etag"]
    segunda = cliente.get("/api/v1/metadata", headers={"If-None-Match": etag})
    assert segunda.status_code == 304


def test_model_info_vem_do_manifest(cliente, manifest: dict) -> None:
    corpo = cliente.get("/api/v1/model/info").json()
    assert corpo["versao"] == manifest["versao"]
    assert corpo["metricas_teste"] == manifest["metricas_teste"]
    assert corpo["n_features_modelo"] == manifest["n_features_modelo"]
    assert corpo["versao_dados"] == manifest["dataset"]["versao_dados"]
    assert corpo["classes"] == manifest["classes"]
    assert cliente.get("/api/v1/model/info").headers["cache-control"] == "public, max-age=300"


def test_versao_desconhecida_e_404_no_envelope(cliente) -> None:
    resposta = cliente.get("/api/v1/model/info?versao=9.9.9")
    assert resposta.status_code == 404
    assert resposta.json()["erro"] == "nao_encontrado"


def test_feature_importance_soma_cem_e_inclui_imc(cliente, manifest: dict) -> None:
    corpo = cliente.get("/api/v1/model/feature-importance?top=20").json()
    assert corpo["versao"] == manifest["versao"]
    assert sum(i["importancia_pct"] for i in corpo["itens"]) == pytest_approx(100.0)
    features = [i["feature"] for i in corpo["itens"]]
    assert ("IMC" in features) == bool(manifest["imc_como_feature"])
    assert all(i["rotulo"] for i in corpo["itens"])


def pytest_approx(valor: float):  # noqa: ANN202
    import pytest

    return pytest.approx(valor, abs=0.1)


def test_rota_inexistente_sai_no_envelope(cliente) -> None:
    resposta = cliente.get("/api/v1/nao-existe")
    assert resposta.status_code == 404
    assert set(resposta.json()) == {"erro", "mensagem", "detalhes"}


def test_health_sempre_200_com_os_campos_do_contrato(cliente) -> None:
    corpo = cliente.get("/api/v1/health").json()
    assert set(corpo) == {
        "status",
        "versao_api",
        "artefato_carregado",
        "uptime_s",
        "banco",
        "log_predicao",
        "logs_gravados",
        "logs_descartados",
    }
    assert corpo["versao_api"] == CONFIG.versao_api
    assert corpo["artefato_carregado"] is True


def test_preflight_cors_aceita_o_cabecalho_de_origem(cliente) -> None:
    resposta = cliente.options(
        "/api/v1/predicoes",
        headers={
            "Origin": CONFIG.lista_origens_cors[0],
            "Access-Control-Request-Method": "POST",
            "Access-Control-Request-Headers": "content-type,x-origem-cliente",
        },
    )
    assert resposta.status_code == 200
    assert resposta.headers["access-control-allow-origin"] == CONFIG.lista_origens_cors[0]
    assert "x-origem-cliente" in resposta.headers["access-control-allow-headers"].lower()
