"""Dependências das rotas: artefato, registro, base do painel, filtros, paginação, banco, log."""

from __future__ import annotations

from dataclasses import dataclass
from typing import Annotated, Literal

from fastapi import Query, Request

from app.dominio.agregados import COLUNAS_REGISTROS, BasePainel
from app.nucleo.artefato import ArtefatoModelo
from app.nucleo.banco import Banco
from app.nucleo.erros import ArtefatoIndisponivel
from app.nucleo.log_predicao import SumidouroLog
from app.nucleo.registro import RegistroArtefatos
from app.utils.filtros import FiltroPainel, normalizar_filtros


def obter_registro(request: Request) -> RegistroArtefatos:
    """O registro de artefatos; 503 explícito enquanto o lifespan não o carregou."""
    registro = getattr(request.app.state, "registro", None)
    if registro is None:
        raise ArtefatoIndisponivel("nenhum artefato de modelo carregado")
    return registro


def obter_artefato(
    request: Request,
    versao: str | None = Query(default=None, description="Versão do modelo; padrão: a do manifest"),
) -> ArtefatoModelo:
    """O artefato pedido por `?versao=` ou o padrão."""
    return obter_registro(request).obter(versao)


def obter_agregados(request: Request) -> BasePainel:
    """A base do painel em memória; 503 se o parquet não foi carregado no lifespan."""
    base = getattr(request.app.state, "agregados", None)
    if base is None:
        raise ArtefatoIndisponivel("base do painel (base_painel.parquet) não carregada")
    return base


def obter_filtros(
    nivel: Annotated[list[str], Query()] = [],  # noqa: B006 — FastAPI exige o default literal
    genero: Annotated[list[str], Query()] = [],  # noqa: B006
    agua: Annotated[list[str], Query()] = [],  # noqa: B006
    alcool: Annotated[list[str], Query()] = [],  # noqa: B006
    caloricos: Annotated[list[str], Query()] = [],  # noqa: B006
    historico_familiar: Annotated[list[str], Query()] = [],  # noqa: B006
) -> FiltroPainel:
    """Os 6 filtros multivalorados da URL, validados contra o domínio (422 nomeando o filtro)."""
    return normalizar_filtros(
        nivel=nivel,
        genero=genero,
        agua=agua,
        alcool=alcool,
        caloricos=caloricos,
        historico_familiar=historico_familiar,
    )


@dataclass(frozen=True)
class Paginacao:
    """Página, tamanho, coluna e direção de ordenação de `/registros`."""

    pagina: int
    tamanho: int
    ordenar_por: str
    direcao: Literal["asc", "desc"]


def paginacao(
    pagina: int = Query(default=1, ge=1),
    tamanho: int = Query(default=50, ge=1, le=200),
    ordenar_por: str = Query(default="IMC", description=f"uma de {COLUNAS_REGISTROS}"),
    direcao: Literal["asc", "desc"] = Query(default="desc"),
) -> Paginacao:
    """Ordem inicial por IMC desc (7.4)."""
    return Paginacao(pagina=pagina, tamanho=tamanho, ordenar_por=ordenar_por, direcao=direcao)


def obter_sumidouro(request: Request) -> SumidouroLog:
    """O sumidouro do log de predição criado no lifespan."""
    return request.app.state.sumidouro


def obter_banco(request: Request) -> Banco:
    """O pool preguiçoso do banco (pode estar desligado)."""
    return request.app.state.banco
