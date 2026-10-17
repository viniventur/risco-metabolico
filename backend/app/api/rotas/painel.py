"""`/dimensoes` e `/painel/*`: servidos de memória, com ETag; nenhum toca o banco."""

from __future__ import annotations

from fastapi import APIRouter, Depends, Query, Request, Response

from app.api.dependencias import obter_agregados, obter_filtros
from app.dominio.agregados import BasePainel
from app.esquemas.painel import Agregado, GeneroResumo, OpcaoDimensao, Ponto, Resumo
from app.nucleo.respostas import resposta_cacheavel
from app.utils.filtros import FiltroPainel

roteador = APIRouter(tags=["painel"])


@roteador.get(
    "/dimensoes",
    response_model=dict[str, list[OpcaoDimensao]],
    summary="Valores distintos das 6 dimensões filtráveis, com rótulo e contagem global",
)
def dimensoes(request: Request, base: BasePainel = Depends(obter_agregados)) -> Response:
    """Os slicers mostram TODAS as opções do domínio global, não só as sobreviventes ao filtro."""
    return resposta_cacheavel(request, base.dimensoes(), max_age=3600)


@roteador.get("/painel/resumo", response_model=Resumo, summary="Os 6 KPIs do recorte")
def resumo(
    request: Request,
    base: BasePainel = Depends(obter_agregados),
    filtros: FiltroPainel = Depends(obter_filtros),
) -> Response:
    """count(*) do recorte, médias com n = count da coluna, e a MODA explícita (não Max + TopN)."""
    corpo = {**base.resumir(filtros), "recorte": filtros.como_dict()}
    return resposta_cacheavel(request, corpo, max_age=60)


@roteador.get(
    "/painel/por-categoria",
    response_model=Agregado,
    summary="Tabela longa por categoria (e série opcional): contagem+pct ou IMC médio",
)
def por_categoria(
    request: Request,
    campo: str = Query(
        description="nivel | genero | caloricos | alcool | atividade | agua | historico_familiar "
        "| transporte"
    ),
    metrica: str = Query(default="contagem", description="contagem | imc_medio"),
    serie: str | None = Query(default=None, description="segunda dimensão, ex.: genero"),
    base: BasePainel = Depends(obter_agregados),
    filtros: FiltroPainel = Depends(obter_filtros),
) -> Response:
    """Domínio completo (grupo ausente vira n=0), dimensão sempre string, supressão explícita."""
    return resposta_cacheavel(
        request, base.agregar_por_categoria(campo, metrica, serie, filtros), max_age=60
    )


@roteador.get("/painel/genero", response_model=list[GeneroResumo], summary="Divisão por gênero")
def genero(
    request: Request,
    base: BasePainel = Depends(obter_agregados),
    filtros: FiltroPainel = Depends(obter_filtros),
) -> Response:
    """JSON tipado por gênero — nunca HTML injetado, como no painel de referência."""
    return resposta_cacheavel(request, base.resumir_genero(filtros), max_age=60)


@roteador.get(
    "/painel/pontos", response_model=list[Ponto], summary="Nuvem altura × peso do recorte"
)
def pontos(
    request: Request,
    amostra: int = Query(default=2000, ge=1, le=2500),
    base: BasePainel = Depends(obter_agregados),
    filtros: FiltroPainel = Depends(obter_filtros),
) -> Response:
    """Até `amostra` pontos, amostra determinística; o IMC vem calculado."""
    return resposta_cacheavel(request, base.amostrar_pontos(amostra, filtros), max_age=60)
