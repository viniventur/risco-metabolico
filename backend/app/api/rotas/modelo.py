"""`/model/info` e `/model/feature-importance`: substituem o texto fixo da aba Início do legado."""

from __future__ import annotations

from fastapi import APIRouter, Depends, Query, Request, Response

from app.api.dependencias import obter_artefato
from app.api.rotas.metadados import ROTULOS_FEATURES
from app.config import CONFIG
from app.dominio.regras import ORDEM_CLINICA
from app.dominio.relatorio import FRASE_DADOS_FICTICIOS
from app.esquemas.comuns import ImportanciaFeatures, InfoModelo, ItemImportancia, MetricasModelo
from app.nucleo.artefato import ArtefatoModelo
from app.nucleo.respostas import resposta_cacheavel

roteador = APIRouter(prefix="/model", tags=["modelo"])


def info_de(artefato: ArtefatoModelo) -> InfoModelo:
    """O manifest normalizado: a fonte de verdade das métricas publicadas."""
    m = artefato.manifest
    return InfoModelo(
        nome=CONFIG.nome_app,
        versao=artefato.versao,
        algoritmo=artefato.algoritmo,
        treinado_em=artefato.treinado_em,
        versao_dados=artefato.versao_dados,
        sha256=str(m["sha256"]),
        n_features_entrada=int(m["n_features_entrada"]),
        n_features_modelo=artefato.n_features_modelo,
        binning_ativo=bool(m["binning_ativo"]),
        imc_como_feature=bool(m["imc_como_feature"]),
        classes=list(artefato.classes),
        ordem_clinica=list(ORDEM_CLINICA),
        hiperparametros=dict(m["hiperparametros"] or {}),
        smote=dict(m["smote"] or {}),
        split=dict(m["split"] or {}),
        metricas_teste=MetricasModelo(**artefato.metricas),
        overfitting=m.get("overfitting"),
        ambiente=dict(m["ambiente"] or {}),
        notebook_origem=str(m["notebook_origem"]),
        aviso=FRASE_DADOS_FICTICIOS,
    )


@roteador.get(
    "/info", response_model=InfoModelo, summary="Manifest normalizado: versão, métricas, ambiente"
)
def model_info(request: Request, artefato: ArtefatoModelo = Depends(obter_artefato)) -> Response:
    """Versão, algoritmo, `treinado_em`, hiperparâmetros, métricas de teste e ambiente."""
    return resposta_cacheavel(request, info_de(artefato).model_dump(), max_age=300)


@roteador.get(
    "/feature-importance",
    response_model=ImportanciaFeatures,
    summary="Importância das features de entrada (one-hot somado), em ordem decrescente",
)
def feature_importance(
    request: Request,
    top: int = Query(default=10, ge=1, le=20),
    artefato: ArtefatoModelo = Depends(obter_artefato),
) -> Response:
    """As `top` features mais importantes; o IMC derivado entra como uma feature."""
    itens = [
        ItemImportancia(
            feature=str(i["feature"]),
            rotulo=ROTULOS_FEATURES.get(str(i["feature"]), str(i["feature"])),
            importancia=float(i["importancia"]),
            importancia_pct=float(i["importancia_pct"]),
        )
        for i in artefato.importancias()[:top]
    ]
    corpo = ImportanciaFeatures(modelo=artefato.algoritmo, versao=artefato.versao, itens=itens)
    return resposta_cacheavel(request, corpo.model_dump(), max_age=300)
