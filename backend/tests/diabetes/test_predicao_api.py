"""`/diabetes/predicoes*`: determinismo, ouro, arredondamento do IMC, contrato e relatório."""

from __future__ import annotations

import json

import pytest

from app.config import CONFIG
from app.diabetes.dominio.regras import RISCO_BAIXO, RISCO_ELEVADO
from app.diabetes.dominio.relatorio import (
    FRASE_DADOS_REAIS,
    LEITURA_RISCO_BAIXO,
    LEITURA_RISCO_ELEVADO,
)
from tests.diabetes.conftest import DADOS_OURO_DIABETES, ENTRADA_PADRAO_DIABETES, URL_DIABETES

URL = f"{URL_DIABETES}/predicoes"


def _prever(cliente, **mudancas) -> dict:
    resposta = cliente.post(URL, json=ENTRADA_PADRAO_DIABETES | mudancas)
    assert resposta.status_code == 200, resposta.json()
    return resposta.json()


def test_predicao_e_deterministica_e_traz_o_contrato(cliente, manifest_diabetes: dict) -> None:
    a, b = _prever(cliente), _prever(cliente)
    assert a["probabilidade"] == b["probabilidade"]
    assert set(a) == {
        "probabilidade",
        "limiar",
        "risco_elevado",
        "classificacao",
        "imc",
        "faixa_imc",
        "fora_do_dominio_treino",
        "versao_modelo",
        "latencia_ms",
    }
    assert a["limiar"] == manifest_diabetes["limiar"]["valor"]
    assert a["versao_modelo"] == manifest_diabetes["versao"]
    assert a["latencia_ms"] >= 0.0


def test_classificacao_segue_o_limiar(cliente) -> None:
    for caso in json.loads((DADOS_OURO_DIABETES / "entradas.json").read_text(encoding="utf-8")):
        corpo = cliente.post(URL, json=caso).json()
        assert corpo["risco_elevado"] == (corpo["probabilidade"] >= corpo["limiar"])
        esperado = RISCO_ELEVADO if corpo["risco_elevado"] else RISCO_BAIXO
        assert corpo["classificacao"] == esperado


def test_dados_de_ouro_reproduzem_as_saidas_esperadas(cliente) -> None:
    """As saídas que o CLI gravou são as que a API devolve: mesmo modelo, mesmo caminho."""
    entradas = json.loads((DADOS_OURO_DIABETES / "entradas.json").read_text(encoding="utf-8"))
    esperadas = json.loads(
        (DADOS_OURO_DIABETES / "saidas_esperadas.json").read_text(encoding="utf-8")
    )
    assert len(entradas) == len(esperadas) >= 20
    for entrada, esperado in zip(entradas, esperadas, strict=True):
        corpo = cliente.post(URL, json=entrada).json()
        assert corpo["probabilidade"] == pytest.approx(esperado["probabilidade"], abs=1e-6)
        assert corpo["risco_elevado"] == esperado["risco_elevado"]
        assert corpo["classificacao"] == esperado["classificacao"]
    assert {e["classificacao"] for e in esperadas} == {RISCO_ELEVADO, RISCO_BAIXO}


@pytest.mark.parametrize(
    ("informado", "como_o_modelo_ve"),
    [(26.5, 26.0), (27.5, 28.0), (26.49, 26.0), (26.51, 27.0), (24.96, 25.0)],
)
def test_imc_e_arredondado_como_a_pesquisa(cliente, informado: float, como_o_modelo_ve) -> None:
    """O modelo vê o IMC inteiro, com o desempate no par; a resposta devolve o informado."""
    a = _prever(cliente, IMC=informado)
    b = _prever(cliente, IMC=como_o_modelo_ve)
    assert a["probabilidade"] == b["probabilidade"]
    assert a["imc"] == round(informado, 2)


def test_faixa_imc_e_a_mesma_da_vertente_de_obesidade(cliente) -> None:
    assert _prever(cliente, IMC=17.9)["faixa_imc"] == "Abaixo do Peso"
    assert _prever(cliente, IMC=22.0)["faixa_imc"] == "Peso Ideal"
    assert _prever(cliente, IMC=25.0)["faixa_imc"] == "Sobrepeso"
    assert _prever(cliente, IMC=41.0)["faixa_imc"] == "Obesidade Grau III"


@pytest.mark.parametrize(
    ("imc", "fora"), [(10.4, ["IMC"]), (11.6, []), (98.4, []), (98.6, ["IMC"]), (30.0, [])]
)
def test_fora_do_dominio_e_sobre_o_imc_que_o_modelo_ve(cliente, imc: float, fora) -> None:
    """A base viu IMC de 12 a 98; 11,6 vira 12 e está dentro, 98,6 vira 99 e está fora."""
    assert _prever(cliente, IMC=imc)["fora_do_dominio_treino"] == fora


@pytest.mark.parametrize(
    ("mudanca", "campo"),
    [
        ({"Faixa_Etaria": 0}, "Faixa_Etaria"),
        ({"Faixa_Etaria": 14}, "Faixa_Etaria"),
        ({"Escolaridade": 7}, "Escolaridade"),
        ({"IMC": 9.9}, "IMC"),
        ({"IMC": 100.1}, "IMC"),
        ({"Sexo": "Outro"}, "Sexo"),
        ({"Pressao_Alta": "Talvez"}, "Pressao_Alta"),
        ({"Peso": 70.0}, "Peso"),  # campo da OUTRA vertente: extra="forbid"
    ],
)
def test_entrada_fora_do_contrato_e_422_nomeando_o_campo(cliente, mudanca: dict, campo) -> None:
    resposta = cliente.post(URL, json=ENTRADA_PADRAO_DIABETES | mudanca)
    assert resposta.status_code == 422
    corpo = resposta.json()
    assert corpo["erro"] == "entrada_invalida"
    assert campo in {d["campo"] for d in corpo["detalhes"]}


def test_campo_ausente_e_422(cliente) -> None:
    sem_imc = {k: v for k, v in ENTRADA_PADRAO_DIABETES.items() if k != "IMC"}
    corpo = cliente.post(URL, json=sem_imc).json()
    assert corpo["erro"] == "entrada_invalida" and corpo["detalhes"][0]["campo"] == "IMC"


def test_lote_isola_falha(cliente) -> None:
    corpo = {
        "itens": [
            ENTRADA_PADRAO_DIABETES,
            ENTRADA_PADRAO_DIABETES | {"Faixa_Etaria": 99},
            ENTRADA_PADRAO_DIABETES | {"Genero": "Feminino"},
            ENTRADA_PADRAO_DIABETES,
        ]
    }
    dados = cliente.post(f"{URL}/lote", json=corpo).json()
    assert (dados["total"], dados["sucesso"], len(dados["resultados"])) == (4, 2, 2)
    assert [(f["indice"], f["campo"]) for f in dados["falhas"]] == [
        (1, "Faixa_Etaria"),
        (2, "Genero"),
    ]
    sem_latencia = [{k: v for k, v in r.items() if k != "latencia_ms"} for r in dados["resultados"]]
    assert sem_latencia[0] == sem_latencia[1]


def test_lote_acima_do_limite_e_413_e_vazio_e_422(cliente) -> None:
    acima = cliente.post(
        f"{URL}/lote", json={"itens": [ENTRADA_PADRAO_DIABETES] * (CONFIG.limite_lote + 1)}
    )
    assert acima.status_code == 413 and acima.json()["erro"] == "lote_acima_do_limite"
    assert cliente.post(f"{URL}/lote", json={"itens": []}).status_code == 422


def test_relatorio_escapa_html_e_traz_a_frase_de_dados_reais(cliente) -> None:
    resposta = cliente.post(
        f"{URL}/relatorio",
        json={"entrada": ENTRADA_PADRAO_DIABETES, "nome": "<script>alert(1)</script>"},
    )
    assert resposta.status_code == 200
    assert resposta.headers["content-type"].startswith("text/html")
    html = resposta.text
    assert "&lt;script&gt;" in html and "<script>" not in html
    assert FRASE_DADOS_REAIS in html
    assert "70 a 74 anos" in html  # a faixa etária pelo rótulo, não pelo código 11
    assert "Ensino médio completo" in html


def test_relatorio_le_a_classificacao(cliente) -> None:
    baixo = ENTRADA_PADRAO_DIABETES | {
        "Faixa_Etaria": 1,
        "IMC": 21.0,
        "Pressao_Alta": "Não",
        "Colesterol_Alto": "Não",
    }
    html_alto = cliente.post(f"{URL}/relatorio", json={"entrada": ENTRADA_PADRAO_DIABETES}).text
    html_baixo = cliente.post(f"{URL}/relatorio", json={"entrada": baixo}).text
    assert LEITURA_RISCO_ELEVADO in html_alto and RISCO_ELEVADO in html_alto
    assert LEITURA_RISCO_BAIXO in html_baixo and RISCO_BAIXO in html_baixo
    assert "Pessoa avaliada" in html_baixo


def test_nome_solto_e_recusado(cliente) -> None:
    """O nome não pode ir dentro de EntradaDiabetes (extra='forbid')."""
    resposta = cliente.post(f"{URL}/relatorio", json=ENTRADA_PADRAO_DIABETES | {"nome": "x"})
    assert resposta.status_code == 422


def test_versao_desconhecida_e_404_no_envelope(cliente) -> None:
    resposta = cliente.post(f"{URL}?versao=9.9.9", json=ENTRADA_PADRAO_DIABETES)
    assert resposta.status_code == 404 and resposta.json()["erro"] == "nao_encontrado"
