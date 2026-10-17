"""Fábrica do app FastAPI: lifespan, CORS, handlers de erro e os routers.

`criar_app()` é uma fábrica, não uma instância de módulo, porque o teste de resiliência do log
(§10.9.2) precisa construir o app com o ambiente já sujo, antes do `lifespan`.
`app = criar_app()` fica na última linha para o `uvicorn app.main:app` continuar valendo.
"""

from __future__ import annotations

import time
from collections.abc import AsyncIterator
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.rotas import saude
from app.config import CONFIG
from app.nucleo.erros import registrar_handlers


@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncIterator[None]:
    """Carrega o que o serviço precisa antes de aceitar requisições; nenhuma espera por banco.

    As fases seguintes acrescentam aqui o artefato de modelo, os agregados do painel, o pool
    preguiçoso do banco (sem abrir conexão) e o consumidor do log de predição.
    """
    app.state.iniciado_em = time.monotonic()
    app.state.registro = None  # RegistroArtefatos (F6)
    app.state.agregados = None  # base do painel em memória (F8)
    app.state.banco = None  # nucleo.banco.Banco (F3b/F6)
    app.state.sumidouro = None  # nucleo.log_predicao.SumidouroLog (F6)
    yield


def criar_app() -> FastAPI:
    """Monta o app com CORS, envelope de erro e os routers sob `/api/v{VERSAO_API}`."""
    app = FastAPI(
        title=CONFIG.nome_app,
        version="2.0.0",
        summary="Triagem metabólica: 16 respostas, distribuição entre 7 faixas e risco acumulado.",
        description=(
            "Os dados exibidos são fictícios e servem apenas para demonstração. "
            "Nenhum registro corresponde a uma pessoa real. "
            "Esta ferramenta é de triagem e não substitui avaliação clínica."
        ),
        lifespan=lifespan,
        docs_url="/docs",
        openapi_url="/openapi.json",
    )
    app.add_middleware(
        CORSMiddleware,
        allow_origins=CONFIG.lista_origens_cors,  # lista explícita, vinda do ambiente
        allow_origin_regex=CONFIG.regex_previews,  # previews de PR do front
        allow_credentials=False,  # não há cookie nem sessão neste desenho
        allow_methods=["GET", "POST", "OPTIONS"],
        # X-Origem-Cliente: sem ele no allowlist o preflight rejeita a requisição e a origem
        # 'painel' nunca chega ao log — o filtro de deriva mediria o conjunto errado (§6.8.2).
        allow_headers=["Content-Type", "X-Origem-Cliente"],
        expose_headers=["ETag"],  # sem isto o cache cross-origin dos agregados não funciona
        max_age=86400,
    )
    registrar_handlers(app)
    prefixo = f"/api/v{CONFIG.versao_api}"
    app.include_router(saude.roteador, prefix=prefixo)
    return app


app = criar_app()
