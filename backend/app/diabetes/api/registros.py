"""`/diabetes/registros` (paginado, ordenável) e `/diabetes/registros/exportar` (CSV em streaming).

A Consulta da vertente, no desenho de `app.api.rotas.registros`, com uma diferença: são 253.680
linhas, e a exportação sai em blocos (`StreamingResponse`), sem teto — o recorte inteiro, sem
montar o arquivo de uma vez na memória.
"""

from __future__ import annotations

from fastapi import APIRouter, Depends, Request, Response
from fastapi.responses import StreamingResponse

from app.api.dependencias import Paginacao
from app.diabetes.api.dependencias import (
    obter_base_diabetes,
    obter_filtros_diabetes,
    paginacao_diabetes,
)
from app.diabetes.dominio.agregados import BasePainelDiabetes
from app.diabetes.dominio.filtros import FiltroDiabetes
from app.diabetes.esquemas.painel import PaginaRegistrosDiabetes
from app.nucleo.respostas import resposta_cacheavel

roteador = APIRouter(prefix="/registros", tags=["diabetes"])


@roteador.get(
    "",
    response_model=PaginaRegistrosDiabetes,
    summary="Página ordenada do recorte da base de diabetes, 23 colunas",
)
def registros_diabetes(
    request: Request,
    base: BasePainelDiabetes = Depends(obter_base_diabetes),
    filtros: FiltroDiabetes = Depends(obter_filtros_diabetes),
    pag: Paginacao = Depends(paginacao_diabetes),
) -> Response:
    """Ordenação e paginação no servidor; `linha_origem` desempata para a ordem ser estável."""
    corpo = base.paginar_registros(pag.pagina, pag.tamanho, pag.ordenar_por, pag.direcao, filtros)
    corpo["recorte"] = filtros.como_dict()
    return resposta_cacheavel(request, corpo, max_age=60)


@roteador.get(
    "/exportar",
    summary="O recorte inteiro da base de diabetes em CSV, em streaming e sem teto",
    response_class=StreamingResponse,
    responses={200: {"content": {"text/csv": {}}, "description": "CSV UTF-8, 23 colunas"}},
)
def exportar_diabetes(
    base: BasePainelDiabetes = Depends(obter_base_diabetes),
    filtros: FiltroDiabetes = Depends(obter_filtros_diabetes),
) -> StreamingResponse:
    """`text/csv` com `Content-Disposition`, na ordem de `linha_origem`, gerado bloco a bloco."""
    return StreamingResponse(
        base.exportar_csv(filtros),
        media_type="text/csv; charset=utf-8",
        headers={"Content-Disposition": 'attachment; filename="registros-diabetes.csv"'},
    )
