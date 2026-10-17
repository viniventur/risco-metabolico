"""Dependências das rotas: artefato, registro, banco e sumidouro saem do `app.state`."""

from __future__ import annotations

from fastapi import Query, Request

from app.nucleo.artefato import ArtefatoModelo
from app.nucleo.banco import Banco
from app.nucleo.erros import ArtefatoIndisponivel
from app.nucleo.log_predicao import SumidouroLog
from app.nucleo.registro import RegistroArtefatos


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


def obter_sumidouro(request: Request) -> SumidouroLog:
    """O sumidouro do log de predição criado no lifespan."""
    return request.app.state.sumidouro


def obter_banco(request: Request) -> Banco:
    """O pool preguiçoso do banco (pode estar desligado)."""
    return request.app.state.banco
