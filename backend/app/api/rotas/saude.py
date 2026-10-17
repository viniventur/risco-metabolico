"""Rotas de infraestrutura: `/health` (vivacidade) e `/ready` (prontidão)."""

from __future__ import annotations

import time

from fastapi import APIRouter, Request, status
from fastapi.responses import JSONResponse

from app.config import CONFIG
from app.esquemas.comuns import Prontidao, Saude

roteador = APIRouter(tags=["infraestrutura"])


def _estado(request: Request) -> tuple[bool, bool]:
    """Devolve (artefato carregado, agregados carregados) a partir do `app.state`."""
    registro = getattr(request.app.state, "registro", None)
    agregados = getattr(request.app.state, "agregados", None)
    return registro is not None, agregados is not None


@roteador.get(
    "/health",
    response_model=Saude,
    summary="Vivacidade: sempre 200, mesmo com banco ou log degradados.",
)
def health(request: Request) -> Saude:
    """Estado do serviço. O banco e o log de predição aparecem, mas nunca derrubam a resposta."""
    estado = request.app.state
    iniciado_em = getattr(estado, "iniciado_em", time.monotonic())
    artefato_carregado, _ = _estado(request)
    banco = getattr(estado, "banco", None)
    sumidouro = getattr(estado, "sumidouro", None)
    if sumidouro is None or not CONFIG.log_predicao_habilitado:
        log_predicao = "desligado"
    else:
        log_predicao = "degradado" if sumidouro.degradado else "ok"
    return Saude(
        versao_api=CONFIG.versao_api,
        artefato_carregado=artefato_carregado,
        uptime_s=round(time.monotonic() - iniciado_em, 3),
        banco=getattr(banco, "estado", "desligado"),
        log_predicao=log_predicao,
        logs_gravados=getattr(sumidouro, "gravados", 0),
        logs_descartados=getattr(sumidouro, "descartados", 0),
    )


@roteador.get(
    "/ready",
    response_model=Prontidao,
    responses={503: {"model": Prontidao}},
    summary="Prontidão: 200 com artefato e agregados carregados, 503 caso contrário.",
)
def ready(request: Request) -> JSONResponse:
    """Prontidão para receber tráfego. O banco não entra: o produto abre inteiro sem ele."""
    artefato, agregados = _estado(request)
    pronto = artefato and agregados
    motivo = None
    if not artefato:
        motivo = "artefato de modelo não carregado"
    elif not agregados:
        motivo = "agregados do painel não carregados"
    corpo = Prontidao(
        pronto=pronto, artefato_carregado=artefato, agregados_carregados=agregados, motivo=motivo
    )
    return JSONResponse(
        status_code=status.HTTP_200_OK if pronto else status.HTTP_503_SERVICE_UNAVAILABLE,
        content=corpo.model_dump(),
    )
