"""`/diabetes/dimensoes` e `/diabetes/painel/*`: a Visão Geral da vertente, servida de memória.

O desenho de `app.api.rotas.painel`: nenhuma rota toca o banco, toda resposta leva ETag e
`Cache-Control`, e os seis filtros chegam pela URL. Os números são os de
`dominio.agregados.BasePainelDiabetes`, cuja paridade com sql/diabetes/agregados/*.sql é provada por
teste; os rótulos de campo e de valor vão junto, para o front não guardar uma segunda cópia deles.
"""

from __future__ import annotations

from fastapi import APIRouter, Depends, Query, Request, Response

from app.diabetes.api.dependencias import obter_base_diabetes, obter_filtros_diabetes
from app.diabetes.dominio.agregados import CAMPOS_CATEGORIA, BasePainelDiabetes
from app.diabetes.dominio.filtros import FiltroDiabetes
from app.diabetes.esquemas.painel import AgregadoDiabetes, FatoresDiabetes, ResumoDiabetes
from app.esquemas.painel import OpcaoDimensao
from app.nucleo.respostas import resposta_cacheavel

roteador = APIRouter(tags=["diabetes"])


@roteador.get(
    "/dimensoes",
    response_model=dict[str, list[OpcaoDimensao]],
    summary="Valores dos 6 filtros da vertente diabetes, com rótulo e contagem na base inteira",
)
def dimensoes_diabetes(
    request: Request, base: BasePainelDiabetes = Depends(obter_base_diabetes)
) -> Response:
    """Os filtros mostram TODAS as opções do domínio, não só as que sobrevivem ao recorte."""
    return resposta_cacheavel(request, base.dimensoes(), max_age=3600)


@roteador.get(
    "/painel/resumo",
    response_model=ResumoDiabetes,
    summary="KPIs do recorte: respostas, com diabetes e a prevalência, contra a base inteira",
)
def resumo_diabetes(
    request: Request,
    base: BasePainelDiabetes = Depends(obter_base_diabetes),
    filtros: FiltroDiabetes = Depends(obter_filtros_diabetes),
) -> Response:
    """O % com diabetes do recorte e o da base, para o KPI dizer a diferença."""
    corpo = {**base.resumir(filtros), "recorte": filtros.como_dict()}
    return resposta_cacheavel(request, corpo, max_age=60)


@roteador.get(
    "/painel/por-categoria",
    response_model=AgregadoDiabetes,
    summary="Tabela longa por categoria (e série opcional): contagem, % e prevalência de diabetes",
)
def por_categoria_diabetes(
    request: Request,
    campo: str = Query(description=" | ".join(CAMPOS_CATEGORIA)),
    serie: str | None = Query(default=None, description="segunda dimensão, ex.: sexo"),
    base: BasePainelDiabetes = Depends(obter_base_diabetes),
    filtros: FiltroDiabetes = Depends(obter_filtros_diabetes),
) -> Response:
    """Domínio completo, dimensão sempre string e prevalência suprimida abaixo do n mínimo.

    A Visão Geral pede a prevalência por idade (`faixa_etaria`), por faixa de IMC (`faixa_imc`) e
    a pirâmide (`faixa_etaria` com `serie=sexo`).
    """
    return resposta_cacheavel(
        request, base.agregar_por_categoria(campo, serie, filtros), max_age=60
    )


@roteador.get(
    "/painel/fatores",
    response_model=FatoresDiabetes,
    summary="A fração com diabetes em cada resposta das 16 variáveis categóricas da base",
)
def fatores_diabetes(
    request: Request,
    base: BasePainelDiabetes = Depends(obter_base_diabetes),
    filtros: FiltroDiabetes = Depends(obter_filtros_diabetes),
) -> Response:
    """O gráfico de fatores numa requisição só, com os rótulos de cada resposta.

    As 13 variáveis de sim ou não, a saúde geral, a escolaridade e a renda.
    """
    return resposta_cacheavel(request, base.fatores(filtros), max_age=60)
