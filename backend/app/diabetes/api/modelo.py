"""`GET /diabetes/model/info`: o manifest da vertente normalizado, fonte das métricas publicadas."""

from __future__ import annotations

from fastapi import APIRouter, Depends, Request, Response

from app.config import CONFIG
from app.diabetes.api.dependencias import obter_artefato_diabetes
from app.diabetes.dominio.relatorio import FRASE_DADOS_REAIS
from app.diabetes.esquemas.saida import (
    InfoModeloDiabetes,
    LimiarDiabetes,
    MetricasTesteDiabetes,
    ValidacaoCruzadaDiabetes,
)
from app.diabetes.nucleo.artefato import ArtefatoDiabetes
from app.nucleo.respostas import resposta_cacheavel

roteador = APIRouter(prefix="/model", tags=["diabetes"])


def info_de(artefato: ArtefatoDiabetes) -> InfoModeloDiabetes:
    """O manifest da vertente normalizado: nenhuma métrica escrita à mão, nem o limiar."""
    m = artefato.manifest
    return InfoModeloDiabetes(
        nome=CONFIG.nome_app,
        vertente="diabetes",
        versao=artefato.versao,
        release=str(m["release"]),
        algoritmo=artefato.algoritmo,
        treinado_em=artefato.treinado_em,
        versao_dados=artefato.versao_dados,
        sha256=str(m["sha256"]),
        entradas=list(m["entradas"]),
        n_features_entrada=int(m["n_features_entrada"]),
        n_features_modelo=artefato.n_features_modelo,
        hiperparametros=dict(m["hiperparametros"] or {}),
        desbalanceamento=str(m["desbalanceamento"]),
        calibracao=str(m["calibracao"]),
        split=dict(m["split"] or {}),
        validacao_cruzada=ValidacaoCruzadaDiabetes(**m["validacao_cruzada"]),
        limiar=LimiarDiabetes(**m["limiar"]),
        metricas_teste=MetricasTesteDiabetes(**m["metricas_teste"]),
        ambiente=dict(m["ambiente"] or {}),
        notebook_origem=str(m["notebook_origem"]),
        aviso=FRASE_DADOS_REAIS,
    )


@roteador.get(
    "/info",
    response_model=InfoModeloDiabetes,
    summary="Manifest da vertente diabetes: versão, limiar, métricas de validação e de teste",
)
def model_info_diabetes(
    request: Request, artefato: ArtefatoDiabetes = Depends(obter_artefato_diabetes)
) -> Response:
    """Versão, release, hiperparâmetros, o limiar com o critério e as métricas do manifest."""
    return resposta_cacheavel(request, info_de(artefato).model_dump(), max_age=300)
