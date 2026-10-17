"""`/registros` (paginado, ordenável) e `/registros/exportar` (CSV): a página "Consulta" (7.4)."""

from __future__ import annotations

from fastapi import APIRouter, Depends, Request, Response

from app.api.dependencias import Paginacao, obter_agregados, obter_filtros, paginacao
from app.dominio.agregados import BasePainel
from app.esquemas.painel import PaginaRegistros
from app.nucleo.respostas import resposta_cacheavel
from app.utils.filtros import FiltroPainel

roteador = APIRouter(prefix="/registros", tags=["registros"])


@roteador.get("", response_model=PaginaRegistros, summary="Página ordenada do recorte, 18 colunas")
def registros(
    request: Request,
    base: BasePainel = Depends(obter_agregados),
    filtros: FiltroPainel = Depends(obter_filtros),
    pag: Paginacao = Depends(paginacao),
) -> Response:
    """Ordenação e paginação no servidor; `linha_origem` desempata para a ordem ser estável."""
    corpo = base.paginar_registros(pag.pagina, pag.tamanho, pag.ordenar_por, pag.direcao, filtros)
    corpo["recorte"] = filtros.como_dict()
    return resposta_cacheavel(request, corpo, max_age=60)


@roteador.get("/exportar", summary="O recorte inteiro em CSV", response_class=Response)
def exportar(
    base: BasePainel = Depends(obter_agregados),
    filtros: FiltroPainel = Depends(obter_filtros),
) -> Response:
    """`text/csv` com `Content-Disposition`, na ordem de `linha_origem`."""
    return Response(
        content=base.exportar_csv(filtros),
        media_type="text/csv; charset=utf-8",
        headers={"Content-Disposition": 'attachment; filename="registros.csv"'},
    )
