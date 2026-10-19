"""Dependências das rotas da vertente diabetes: o registro e o artefato pedidos por `?versao=`."""

from __future__ import annotations

from fastapi import Query, Request

from app.diabetes.nucleo.artefato import ArtefatoDiabetes, RegistroDiabetes
from app.nucleo.erros import ArtefatoIndisponivel


def obter_registro_diabetes(request: Request) -> RegistroDiabetes:
    """O registro da vertente; 503 explícito enquanto o lifespan não o carregou."""
    registro = getattr(request.app.state, "registro_diabetes", None)
    if registro is None:
        raise ArtefatoIndisponivel("nenhum artefato de modelo da vertente diabetes carregado")
    return registro


def obter_artefato_diabetes(
    request: Request,
    versao: str | None = Query(
        default=None, description="Versão do modelo de diabetes; padrão: a do manifest da vertente"
    ),
) -> ArtefatoDiabetes:
    """O artefato pedido por `?versao=` ou o padrão."""
    return obter_registro_diabetes(request).obter(versao)
