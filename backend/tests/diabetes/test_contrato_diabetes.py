"""Contrato da vertente diabetes: formulário, modelo, domínios, OpenAPI, prontidão e a frase de D3.

O snapshot do OpenAPI inteiro é o de tests/test_contrato_api.py (o mesmo app); aqui ficam as
garantias próprias da vertente.
"""

from __future__ import annotations

import json
from types import SimpleNamespace
from typing import get_args

import pytest

from app.api.rotas.saude import ready
from app.diabetes.dominio.features import ENTRADAS
from app.diabetes.dominio.regras import DOMINIOS, FAIXAS_TREINO, RISCO_BAIXO, RISCO_ELEVADO
from app.diabetes.dominio.relatorio import FRASE_DADOS_REAIS
from app.diabetes.esquemas.entrada import IMC_MAXIMO, IMC_MINIMO, EntradaDiabetes
from app.diabetes.esquemas.saida import Classificacao
from tests.diabetes.conftest import ENTRADA_PADRAO_DIABETES, RAIZ, URL_DIABETES

# A frase de dados da vertente (decisão D3), com portão próprio: literal e contígua onde é
# obrigatória. A cópia do portão é esta; a do código, a de app/diabetes/dominio/relatorio.py.
FRASE_D3 = (
    "Os dados exibidos são respostas reais e anonimizadas de uma pesquisa pública de saúde dos "
    "Estados Unidos (BRFSS 2015, CDC) e servem apenas para demonstração. Nenhum registro "
    "identifica uma pessoa. Esta ferramenta é de triagem e não substitui avaliação clínica."
)


def test_aviso_de_dados_reais_presente() -> None:
    """O que é OBRIGATÓRIO também tem portão: a frase de D3, literal, no código e no estudo."""
    assert FRASE_DADOS_REAIS == FRASE_D3
    for rel in (
        "backend/app/diabetes/dominio/relatorio.py",
        "study/README.md",
        "study/02_triagem_de_diabetes.ipynb",
    ):
        texto = (RAIZ / rel).read_text(encoding="utf-8")
        if rel.endswith(".ipynb"):
            texto = "".join("".join(c["source"]) for c in json.loads(texto)["cells"])
        assert FRASE_D3 in texto, f"{rel}: frase ausente"


def test_metadata_cobre_cem_por_cento_das_entradas(cliente) -> None:
    corpo = cliente.get(f"{URL_DIABETES}/metadata").json()
    nomes = [campo["nome"] for grupo in corpo["grupos"] for campo in grupo["campos"]]
    aliases = {f.alias for f in EntradaDiabetes.model_fields.values() if f.alias}
    assert set(nomes) == aliases == set(ENTRADAS) and len(nomes) == 10
    assert [g["id"] for g in corpo["grupos"]] == ["dados-iniciais", "saude", "habitos"]
    assert FRASE_D3 in corpo["aviso"] and "anônima" in corpo["aviso"]
    assert all(campo["rotulo"] for grupo in corpo["grupos"] for campo in grupo["campos"])


def test_metadata_do_imc_vem_do_contrato_e_da_faixa_da_base(cliente) -> None:
    corpo = cliente.get(f"{URL_DIABETES}/metadata").json()
    imc = next(c for g in corpo["grupos"] for c in g["campos"] if c["nome"] == "IMC")
    assert (imc["tipo"], imc["minimo"], imc["maximo"]) == ("numero", IMC_MINIMO, IMC_MAXIMO)
    minimo, maximo = FAIXAS_TREINO["IMC"]
    assert f"de {minimo:.0f} a {maximo:.0f}" in imc["ajuda"]


def test_toda_opcao_do_formulario_e_aceita_pela_api(cliente) -> None:
    corpo = cliente.get(f"{URL_DIABETES}/metadata").json()
    for grupo in corpo["grupos"]:
        for campo in grupo["campos"]:
            valores = [o["valor"] for o in campo["opcoes"]] or [campo["padrao"]]
            for valor in valores:
                resposta = cliente.post(
                    f"{URL_DIABETES}/predicoes",
                    json=ENTRADA_PADRAO_DIABETES | {campo["nome"]: valor},
                )
                assert resposta.status_code == 200, (campo["nome"], valor)
    padroes = {c["nome"]: c["padrao"] for g in corpo["grupos"] for c in g["campos"]}
    assert cliente.post(f"{URL_DIABETES}/predicoes", json=padroes).status_code == 200


def test_opcoes_das_escalas_sao_o_dominio_inteiro(cliente) -> None:
    corpo = cliente.get(f"{URL_DIABETES}/metadata").json()
    campos = {c["nome"]: c for g in corpo["grupos"] for c in g["campos"]}
    for nome in ("Faixa_Etaria", "Escolaridade", "Sexo", "Pressao_Alta"):
        assert sorted(o["valor"] for o in campos[nome]["opcoes"]) == sorted(DOMINIOS[nome])


def test_metadata_e_model_info_tem_cache_e_etag(cliente) -> None:
    for rota, idade in (("metadata", 3600), ("model/info", 300)):
        primeira = cliente.get(f"{URL_DIABETES}/{rota}")
        assert primeira.headers["cache-control"] == f"public, max-age={idade}"
        segunda = cliente.get(
            f"{URL_DIABETES}/{rota}", headers={"If-None-Match": primeira.headers["etag"]}
        )
        assert segunda.status_code == 304


def test_model_info_vem_do_manifest(cliente, manifest_diabetes: dict) -> None:
    corpo = cliente.get(f"{URL_DIABETES}/model/info").json()
    for chave in (
        "versao",
        "release",
        "algoritmo",
        "sha256",
        "entradas",
        "hiperparametros",
        "desbalanceamento",
        "calibracao",
        "split",
        "validacao_cruzada",
        "limiar",
        "metricas_teste",
        "ambiente",
        "notebook_origem",
    ):
        assert corpo[chave] == manifest_diabetes[chave], chave
    assert corpo["vertente"] == "diabetes"
    assert corpo["versao_dados"] == manifest_diabetes["dataset"]["versao_dados"]
    assert corpo["aviso"] == FRASE_D3
    assert cliente.get(f"{URL_DIABETES}/model/info?versao=9.9.9").status_code == 404


def test_dominios_do_contrato_sao_os_da_base() -> None:
    """Os `Literal` e as faixas do contrato não podem divergir de `regras.DOMINIOS`."""
    for campo in EntradaDiabetes.model_fields.values():
        nome = campo.alias
        assert nome is not None
        argumentos = get_args(campo.annotation)
        if argumentos and all(isinstance(a, str) for a in argumentos):
            assert sorted(argumentos) == sorted(DOMINIOS[nome]), nome
        elif nome in DOMINIOS:
            limites = {type(m).__name__: m for m in campo.metadata}
            assert limites["Ge"].ge == min(DOMINIOS[nome]), nome
            assert limites["Le"].le == max(DOMINIOS[nome]), nome
    assert [c for c in EntradaDiabetes.model_fields] == [c.lower() for c in ENTRADAS]
    assert get_args(Classificacao) == (RISCO_ELEVADO, RISCO_BAIXO)


def test_openapi_tem_as_rotas_e_a_tag_da_vertente(cliente) -> None:
    doc = cliente.get("/openapi.json").json()
    rotas = {p for p in doc["paths"] if p.startswith(URL_DIABETES)}
    assert rotas == {
        f"{URL_DIABETES}/predicoes",
        f"{URL_DIABETES}/predicoes/lote",
        f"{URL_DIABETES}/predicoes/relatorio",
        f"{URL_DIABETES}/metadata",
        f"{URL_DIABETES}/model/info",
        f"{URL_DIABETES}/dimensoes",
        f"{URL_DIABETES}/painel/resumo",
        f"{URL_DIABETES}/painel/por-categoria",
        f"{URL_DIABETES}/painel/fatores",
        f"{URL_DIABETES}/registros",
        f"{URL_DIABETES}/registros/exportar",
        f"{URL_DIABETES}/monitoramento/deriva",
    }
    tag = next(t for t in doc["tags"] if t["name"] == "diabetes")
    assert FRASE_D3 in tag["description"]
    componentes = set(doc["components"]["schemas"])
    assert {"EntradaDiabetes", "RespostaDiabetes", "InfoModeloDiabetes"} <= componentes


@pytest.mark.parametrize(
    ("registro", "diabetes", "agregados", "motivo"),
    [
        (True, False, True, "artefato de modelo da vertente diabetes não carregado"),
        (False, True, True, "artefato de modelo não carregado"),
        (True, True, False, "agregados do painel não carregados"),
    ],
)
def test_ready_exige_as_duas_vertentes(registro, diabetes, agregados, motivo: str) -> None:
    estado = SimpleNamespace(
        registro=object() if registro else None,
        registro_diabetes=object() if diabetes else None,
        agregados=object() if agregados else None,
    )
    resposta = ready(SimpleNamespace(app=SimpleNamespace(state=estado)))
    assert resposta.status_code == 503
    corpo = json.loads(resposta.body)
    assert corpo["pronto"] is False and corpo["motivo"] == motivo
    assert corpo["artefato_carregado"] == (registro and diabetes)
