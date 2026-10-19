"""`/diabetes/dimensoes`, `/diabetes/painel/*` e `/diabetes/registros*`: de memória, filtros na URL.

O desenho de tests/test_painel_api.py, para a vertente. Os números esperados saem da própria base
(as contagens de `/diabetes/dimensoes`, o manifest), nunca de um literal: a base tem 253.680
respostas reais, e um número digitado aqui seria uma terceira cópia.
"""

from __future__ import annotations

import csv
import io
import json
from types import SimpleNamespace
from typing import Any

import pytest

from app.api.rotas.saude import ready
from app.diabetes.api.dependencias import obter_base_diabetes
from app.diabetes.dominio.agregados import COLUNAS_REGISTROS, FATORES
from app.diabetes.dominio.regras import ORDEM_FAIXA_IMC, ROTULOS_COLUNAS, ROTULOS_ESCALA
from app.nucleo.erros import ArtefatoIndisponivel
from tests.diabetes.conftest import URL_DIABETES


@pytest.fixture(autouse=True)
def _exige_base(cliente: Any) -> None:
    if cliente.app.state.agregados_diabetes is None:
        pytest.skip(
            "base do painel da vertente ausente: rode python -m app.diabetes.treino.agregar"
        )


@pytest.fixture(scope="module")
def dimensoes(cliente: Any) -> dict[str, list[dict[str, Any]]]:
    return cliente.get(f"{URL_DIABETES}/dimensoes").json()


def _n(dimensoes: dict, filtro: str, valor: Any) -> int:
    return next(o["n"] for o in dimensoes[filtro] if o["valor"] == valor)


def _linhas(doc: dict, medida: str) -> list[dict[str, Any]]:
    return [ln for ln in doc["linhas"] if ln["medida"] == medida]


def test_ready_200_com_as_duas_bases(cliente: Any) -> None:
    corpo = cliente.get("/api/v1/ready").json()
    assert corpo == {
        "pronto": True,
        "artefato_carregado": True,
        "agregados_carregados": True,
        "motivo": None,
    }


def test_ready_503_sem_a_base_da_vertente() -> None:
    estado = SimpleNamespace(
        registro=object(), registro_diabetes=object(), agregados=object(), agregados_diabetes=None
    )
    resposta = ready(SimpleNamespace(app=SimpleNamespace(state=estado)))
    assert resposta.status_code == 503
    corpo = json.loads(resposta.body)
    assert corpo["motivo"] == "base do painel da vertente diabetes não carregada"
    assert corpo["agregados_carregados"] is False and corpo["artefato_carregado"] is True


def test_sem_a_base_as_rotas_respondem_503() -> None:
    with pytest.raises(ArtefatoIndisponivel):
        obter_base_diabetes(SimpleNamespace(app=SimpleNamespace(state=SimpleNamespace())))


def test_dimensoes_tem_os_seis_filtros_com_rotulo_e_contagem(
    cliente: Any, dimensoes: dict, manifest_diabetes: dict
) -> None:
    assert list(dimensoes) == [
        "sexo",
        "faixa_etaria",
        "faixa_imc",
        "pressao_alta",
        "colesterol_alto",
        "atividade_fisica_30_dias",
    ]
    linhas = manifest_diabetes["dataset"]["linhas"]
    for nome, opcoes in dimensoes.items():
        assert sum(o["n"] for o in opcoes) == linhas, nome
    assert [o["valor"] for o in dimensoes["faixa_etaria"]] == list(range(1, 14))
    assert [o["rotulo"] for o in dimensoes["faixa_etaria"]] == list(
        ROTULOS_ESCALA["Faixa_Etaria"].values()
    )
    assert [o["valor"] for o in dimensoes["faixa_imc"]] == ORDEM_FAIXA_IMC
    resposta = cliente.get(f"{URL_DIABETES}/dimensoes")
    assert resposta.headers["cache-control"] == "public, max-age=3600"
    etag = resposta.headers["etag"]
    assert (
        cliente.get(f"{URL_DIABETES}/dimensoes", headers={"If-None-Match": etag}).status_code == 304
    )


def test_resumo_sem_filtro_e_a_base(cliente: Any, manifest_diabetes: dict) -> None:
    corpo = cliente.get(f"{URL_DIABETES}/painel/resumo").json()
    assert (
        corpo["total_registros"] == corpo["total_global"] == manifest_diabetes["dataset"]["linhas"]
    )
    assert corpo["n_diabetes"] == corpo["n_diabetes_global"]
    assert corpo["prevalencia"] == corpo["prevalencia_global"]
    assert corpo["prevalencia"] == pytest.approx(
        100.0 * corpo["n_diabetes"] / corpo["total_registros"]
    )
    assert corpo["recorte"] == {}


def test_filtros_or_dentro_e_and_entre(cliente: Any, dimensoes: dict) -> None:
    fem = cliente.get(f"{URL_DIABETES}/painel/resumo?sexo=Feminino").json()
    assert fem["total_registros"] == _n(dimensoes, "sexo", "Feminino")
    assert fem["recorte"] == {"sexo": ["Feminino"]}
    assert fem["total_global"] > fem["total_registros"]
    duas = cliente.get(f"{URL_DIABETES}/painel/resumo?faixa_etaria=2&faixa_etaria=1").json()
    assert duas["total_registros"] == _n(dimensoes, "faixa_etaria", 1) + _n(
        dimensoes, "faixa_etaria", 2
    )
    assert duas["recorte"] == {"faixa_etaria": [1, 2]}  # normalizado na ordem do domínio
    piramide = cliente.get(
        f"{URL_DIABETES}/painel/por-categoria?campo=faixa_etaria&serie=sexo"
    ).json()
    grupo = next(
        ln
        for ln in _linhas(piramide, "contagem")
        if ln["faixa_etaria"] == "9" and ln["sexo"] == "Masculino"
    )
    cruzado = cliente.get(f"{URL_DIABETES}/painel/resumo?faixa_etaria=9&sexo=Masculino").json()
    assert cruzado["total_registros"] == grupo["n"]


@pytest.mark.parametrize(
    ("consulta", "campo"),
    [
        ("faixa_imc=Outra", "faixa_imc"),
        ("faixa_etaria=x", "faixa_etaria"),
        ("faixa_etaria=14", "faixa_etaria"),
        ("pressao_alta=Talvez", "pressao_alta"),
    ],
)
def test_filtro_fora_do_dominio_e_422_nomeando_o_filtro(
    cliente: Any, consulta: str, campo: str
) -> None:
    resposta = cliente.get(f"{URL_DIABETES}/painel/resumo?{consulta}")
    assert resposta.status_code == 422
    assert resposta.json()["detalhes"][0]["campo"] == campo


def test_por_categoria_tem_dominio_completo_e_suprime_grupo_pequeno(cliente: Any) -> None:
    doc = cliente.get(
        f"{URL_DIABETES}/painel/por-categoria?campo=faixa_etaria&faixa_etaria=1"
    ).json()
    assert doc["dimensoes"] == [{"nome": "faixa_etaria", "tipo": "inteiro"}]
    contagens = _linhas(doc, "contagem")
    assert [ln["faixa_etaria"] for ln in contagens] == [str(i) for i in range(1, 14)]
    assert sum(ln["n"] > 0 for ln in contagens) == 1
    for ln in _linhas(doc, "prevalencia"):
        assert ln["suprimido"] == (ln["n"] < doc["amostra_minima"])
        assert (ln["valor"] is None) == ln["suprimido"]
    assert [ln["ordem"] for ln in doc["linhas"]] == list(range(1, len(doc["linhas"]) + 1))
    assert doc["campos"][0]["rotulo"] == ROTULOS_COLUNAS["Faixa_Etaria"]


def test_por_categoria_pct_e_do_recorte_e_prevalencia_e_do_grupo(cliente: Any) -> None:
    doc = cliente.get(f"{URL_DIABETES}/painel/por-categoria?campo=faixa_imc&sexo=Masculino").json()
    total = doc["total_filtrado"]
    por_faixa = {ln["faixa_imc"]: ln for ln in _linhas(doc, "contagem")}
    for ln in _linhas(doc, "pct"):
        assert ln["valor"] == pytest.approx(100.0 * por_faixa[ln["faixa_imc"]]["n"] / total)
    diabetes = {ln["faixa_imc"]: ln["n"] for ln in _linhas(doc, "n_diabetes")}
    for ln in _linhas(doc, "prevalencia"):
        if not ln["suprimido"]:
            assert ln["valor"] == pytest.approx(100.0 * diabetes[ln["faixa_imc"]] / ln["n"])
    assert [c["campo"] for c in doc["campos"]] == ["faixa_imc"]
    assert [v["valor"] for v in doc["campos"][0]["valores"]] == ORDEM_FAIXA_IMC


def test_por_categoria_recusa_campo_e_serie_invalidos(cliente: Any) -> None:
    assert cliente.get(f"{URL_DIABETES}/painel/por-categoria?campo=imc").status_code == 422
    assert (
        cliente.get(f"{URL_DIABETES}/painel/por-categoria?campo=sexo&serie=sexo").status_code == 422
    )
    resposta = cliente.get(f"{URL_DIABETES}/painel/por-categoria?campo=sexo&serie=nivel")
    assert resposta.status_code == 422 and resposta.json()["erro"] == "fora_do_dominio"


def test_dias_de_saude_ruim_entram_por_categoria_com_rotulo(cliente: Any) -> None:
    doc = cliente.get(f"{URL_DIABETES}/painel/por-categoria?campo=dias_saude_mental_ruim").json()
    valores = doc["campos"][0]["valores"]
    assert [v["valor"] for v in valores] == [str(i) for i in range(31)]
    assert valores[1]["rotulo"] == "1 dia" and valores[30]["rotulo"] == "30 dias"


def test_fatores_sao_os_16_com_rotulos(cliente: Any) -> None:
    doc = cliente.get(f"{URL_DIABETES}/painel/fatores?pressao_alta=Sim").json()
    assert [c["campo"] for c in doc["campos"]] == FATORES
    assert doc["recorte"] == {"pressao_alta": ["Sim"]}
    saude = next(c for c in doc["campos"] if c["campo"] == "saude_geral")
    assert [v["rotulo"] for v in saude["valores"]] == list(ROTULOS_ESCALA["Saude_Geral"].values())
    total = doc["total_filtrado"]
    for fator in FATORES:
        contagens = [ln["n"] for ln in _linhas(doc, "contagem") if ln["fator"] == fator]
        assert sum(contagens) == total, fator
    pressao = {
        ln["resposta"]: ln["n"] for ln in _linhas(doc, "contagem") if ln["fator"] == "pressao_alta"
    }
    assert pressao == {"Não": 0, "Sim": total}  # o filtro aparece no próprio fator


def test_registros_paginados_e_ordenados_com_desempate_estavel(cliente: Any) -> None:
    corpo = cliente.get(
        f"{URL_DIABETES}/registros?tamanho=40&ordenar_por=IMC&direcao=desc&sexo=Feminino"
    ).json()
    assert corpo["tamanho"] == 40 and len(corpo["linhas"]) == 40
    assert corpo["recorte"] == {"sexo": ["Feminino"]}
    assert all(set(ln) == {"id", *COLUNAS_REGISTROS} for ln in corpo["linhas"])
    chaves = [(-ln["IMC"], ln["id"]) for ln in corpo["linhas"]]
    assert chaves == sorted(chaves)
    assert {ln["Sexo"] for ln in corpo["linhas"]} == {"Feminino"}
    seguinte = cliente.get(
        f"{URL_DIABETES}/registros?tamanho=40&pagina=2&ordenar_por=IMC&direcao=desc&sexo=Feminino"
    ).json()
    assert (-seguinte["linhas"][0]["IMC"], seguinte["linhas"][0]["id"]) > chaves[-1]
    asc = cliente.get(
        f"{URL_DIABETES}/registros?tamanho=5&ordenar_por=Faixa_IMC&direcao=asc"
    ).json()
    assert {ln["Faixa_IMC"] for ln in asc["linhas"]} == {ORDEM_FAIXA_IMC[0]}  # a ordem da escala


def test_registros_recusa_coluna_de_ordenacao_desconhecida(cliente: Any) -> None:
    resposta = cliente.get(f"{URL_DIABETES}/registros?ordenar_por=Peso")
    assert resposta.status_code == 422


def test_exportar_csv_do_recorte(cliente: Any, dimensoes: dict) -> None:
    resposta = cliente.get(f"{URL_DIABETES}/registros/exportar?faixa_etaria=1&sexo=Masculino")
    assert resposta.status_code == 200
    assert resposta.headers["content-type"].startswith("text/csv")
    assert 'filename="registros-diabetes.csv"' in resposta.headers["content-disposition"]
    leitor = list(csv.reader(io.StringIO(resposta.text)))
    assert leitor[0] == COLUNAS_REGISTROS
    esperado = cliente.get(f"{URL_DIABETES}/painel/resumo?faixa_etaria=1&sexo=Masculino").json()
    assert len(leitor) - 1 == esperado["total_registros"]
    assert {linha[COLUNAS_REGISTROS.index("Sexo")] for linha in leitor[1:]} == {"Masculino"}


def test_exportar_sem_filtro_sai_inteiro_sem_teto(cliente: Any, manifest_diabetes: dict) -> None:
    """Streaming sem teto: a base inteira, em blocos, com um cabeçalho só."""
    with cliente.stream("GET", f"{URL_DIABETES}/registros/exportar") as resposta:
        linhas = sum(bloco.count("\n") for bloco in resposta.iter_text())
    assert linhas == manifest_diabetes["dataset"]["linhas"] + 1
