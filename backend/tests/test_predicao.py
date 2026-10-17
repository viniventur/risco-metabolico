"""Determinismo, ordem clínica, lote, dados de ouro e relatório (§10.5, F9)."""

from __future__ import annotations

import json

import pytest

from app.config import CONFIG
from app.dominio.regras import CLASSES_RISCO, ORDEM_CLINICA
from app.dominio.relatorio import FRASE_DADOS_FICTICIOS
from tests.conftest import DADOS_OURO, ENTRADA_PADRAO

URL = "/api/v1/predicoes"


def test_predicao_e_deterministica(cliente) -> None:
    a = cliente.post(URL, json=ENTRADA_PADRAO).json()
    b = cliente.post(URL, json=ENTRADA_PADRAO).json()
    assert a["probabilidades"] == b["probabilidades"]
    assert a["classe_prevista"] == b["classe_prevista"]


def test_probabilidades_em_ordem_clinica(cliente) -> None:
    """O LabelEncoder indexa em ordem alfabética; a API responde em ordem clínica."""
    corpo = cliente.post(URL, json=ENTRADA_PADRAO).json()
    assert [p["classe"] for p in corpo["probabilidades"]] == list(ORDEM_CLINICA)
    assert sum(p["probabilidade"] for p in corpo["probabilidades"]) == pytest.approx(1.0, abs=1e-6)
    assert [p["de_risco"] for p in corpo["probabilidades"]] == [
        c in CLASSES_RISCO for c in ORDEM_CLINICA
    ]


def test_classe_prevista_e_o_argmax_e_risco_e_a_soma_das_classes_de_risco(cliente) -> None:
    corpo = cliente.post(URL, json=ENTRADA_PADRAO).json()
    maior = max(corpo["probabilidades"], key=lambda p: p["probabilidade"])
    assert corpo["classe_prevista"] == maior["classe"]
    soma_risco = sum(p["probabilidade"] for p in corpo["probabilidades"] if p["de_risco"])
    assert corpo["risco_acumulado"] == pytest.approx(soma_risco, abs=1e-9)
    assert corpo["imc"] == pytest.approx(70.0 / 1.70**2, abs=0.005)
    assert corpo["faixa_imc"] == "Peso Ideal"
    assert corpo["versao_modelo"] == CONFIG.versao_api or corpo["versao_modelo"]
    assert corpo["latencia_ms"] >= 0.0


def test_dados_de_ouro_reproduzem_as_saidas_esperadas(cliente) -> None:
    """As saídas que o CLI de treino gravou são as que a API devolve — mesmo modelo, mesmo dado."""
    entradas = json.loads((DADOS_OURO / "entradas.json").read_text(encoding="utf-8"))
    esperadas = json.loads((DADOS_OURO / "saidas_esperadas.json").read_text(encoding="utf-8"))
    assert len(entradas) == len(esperadas) >= 20
    classes_vistas: set[str] = set()
    for entrada, esperado in zip(entradas, esperadas, strict=True):
        resposta = cliente.post(URL, json=entrada)
        assert resposta.status_code == 200, entrada
        corpo = resposta.json()
        assert corpo["classe_prevista"] == esperado["classe_prevista"]
        for p in corpo["probabilidades"]:
            assert p["probabilidade"] == pytest.approx(
                esperado["probabilidades"][p["classe"]], abs=1e-6
            )
        classes_vistas.add(corpo["classe_prevista"])
    assert classes_vistas == set(ORDEM_CLINICA), (
        f"os casos de ouro não cobrem as 7 classes: {classes_vistas}"
    )


def test_lote_isola_falha(cliente) -> None:
    """Um item inválido volta em `falhas`; os outros dois são processados."""
    corpo = {"itens": [ENTRADA_PADRAO, ENTRADA_PADRAO | {"Idade": 999}, ENTRADA_PADRAO]}
    resposta = cliente.post(f"{URL}/lote", json=corpo)
    assert resposta.status_code == 200
    dados = resposta.json()
    assert dados["total"] == 3
    assert dados["sucesso"] == 2
    assert len(dados["resultados"]) == 2
    assert dados["falhas"][0]["indice"] == 1
    assert dados["falhas"][0]["campo"] == "Idade"


def test_lote_com_campo_desconhecido_nomeia_o_campo(cliente) -> None:
    dados = cliente.post(f"{URL}/lote", json={"itens": [ENTRADA_PADRAO | {"IMC": 1}]}).json()
    assert dados["sucesso"] == 0 and dados["falhas"][0]["campo"] == "IMC"


def test_lote_acima_do_limite_retorna_413(cliente) -> None:
    corpo = {"itens": [ENTRADA_PADRAO] * (CONFIG.limite_lote + 1)}
    resposta = cliente.post(f"{URL}/lote", json=corpo)
    assert resposta.status_code == 413
    assert resposta.json()["erro"] == "lote_acima_do_limite"


def test_lote_vazio_e_422(cliente) -> None:
    assert cliente.post(f"{URL}/lote", json={"itens": []}).status_code == 422


def test_relatorio_escapa_html_e_traz_a_frase_de_dados_ficticios(cliente) -> None:
    resposta = cliente.post(
        f"{URL}/relatorio", json={"entrada": ENTRADA_PADRAO, "nome": "<script>alert(1)</script>"}
    )
    assert resposta.status_code == 200
    assert resposta.headers["content-type"].startswith("text/html")
    html = resposta.text
    assert "&lt;script&gt;" in html
    assert "<script>" not in html
    assert FRASE_DADOS_FICTICIOS in html
    assert "Peso Ideal" in html


def test_relatorio_sem_nome_usa_um_rotulo_neutro(cliente) -> None:
    html = cliente.post(f"{URL}/relatorio", json={"entrada": ENTRADA_PADRAO}).text
    assert "Pessoa avaliada" in html


def test_nome_como_parametro_solto_e_recusado(cliente) -> None:
    """O nome não pode ir dentro de EntradaTriagem (extra='forbid') nem como query string."""
    assert cliente.post(f"{URL}/relatorio", json=ENTRADA_PADRAO | {"nome": "x"}).status_code == 422
