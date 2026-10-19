"""Fábrica do app FastAPI: lifespan, CORS, limitador, handlers de erro e os routers.

`criar_app()` é uma fábrica, não uma instância de módulo, porque o teste de resiliência do log
(§10.9.2) precisa construir o app com o ambiente já sujo, antes do `lifespan`.
`app = criar_app()` fica na última linha para o `uvicorn app.main:app` continuar valendo.
"""

from __future__ import annotations

import asyncio
import logging
import time
from collections.abc import AsyncIterator
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.rotas import metadados, modelo, monitoramento, painel, predicoes, registros, saude
from app.config import CONFIG
from app.diabetes.api import roteador as roteador_diabetes
from app.diabetes.dominio.relatorio import FRASE_DADOS_REAIS
from app.diabetes.nucleo.artefato import RegistroDiabetes
from app.dominio.agregados import BasePainel
from app.nucleo.banco import Banco
from app.nucleo.erros import ArtefatoIndisponivel, registrar_handlers
from app.nucleo.limite_taxa import registrar_limitador
from app.nucleo.log_predicao import SumidouroLog
from app.nucleo.registro import RegistroArtefatos

log = logging.getLogger(__name__)


def carregar_registro() -> RegistroArtefatos | None:
    """Carrega o artefato do manifest; falha vira log e `/ready` 503, nunca silêncio."""
    try:
        return RegistroArtefatos.carregar(
            CONFIG.modelos_dir, CONFIG.artefatos_dir, exigir_integridade=CONFIG.exigir_integridade
        )
    except ArtefatoIndisponivel as erro:
        log.error("artefato não carregado: %s", erro.mensagem)
        return None


def carregar_registro_diabetes() -> RegistroDiabetes | None:
    """O artefato da vertente diabetes, do manifest dela; falha vira log e `/ready` 503."""
    try:
        return RegistroDiabetes.carregar(
            CONFIG.modelos_dir,
            CONFIG.artefatos_dir / "diabetes",
            exigir_integridade=CONFIG.exigir_integridade,
        )
    except ArtefatoIndisponivel as erro:
        log.error("artefato da vertente diabetes não carregado: %s", erro.mensagem)
        return None


def carregar_base_painel() -> BasePainel | None:
    """Lê `base_painel.parquet` de DADOS_DIR; ausente, `/painel/*` e `/ready` respondem 503."""
    caminho = CONFIG.dados_dir / "base_painel.parquet"
    try:
        return BasePainel.carregar(caminho)
    except (OSError, ValueError) as erro:
        log.error("base do painel não carregada (%s): %s", caminho.name, erro)
        return None


@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncIterator[None]:
    """Carrega o que o serviço precisa antes de aceitar requisições; nenhuma espera por banco.

    O pool nasce sem abrir conexão (`min_size=0`), o aquecimento roda em segundo plano e o
    consumidor do log é a única tarefa que fala com o banco.
    """
    app.state.iniciado_em = time.monotonic()
    app.state.registro = carregar_registro()
    app.state.registro_diabetes = carregar_registro_diabetes()
    app.state.agregados = carregar_base_painel()  # base do painel em memória; nunca o banco
    banco = Banco()
    await banco.abrir()  # não abre conexão: min_size=0
    app.state.banco = banco
    app.state.sumidouro = SumidouroLog()
    consumidor = asyncio.create_task(app.state.sumidouro.consumir(banco))
    aquecimento = asyncio.create_task(banco.consultar("SELECT 1"))  # aquecimento, sem await
    try:
        yield
    finally:
        # Ordem importa: o consumidor para sozinho (sentinela), depois o pool fecha. Cancelar
        # o consumidor no meio de um INSERT travaria o desligamento (ver SumidouroLog.encerrar).
        await app.state.sumidouro.encerrar(consumidor)
        if not aquecimento.done():
            aquecimento.cancel()
        await banco.fechar()


def criar_app() -> FastAPI:
    """Monta o app com CORS, limitador, envelope de erro e os routers sob `/api/v{VERSAO_API}`."""
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
        # A vertente diabetes tem base real e anonimizada: a frase dela vai na descrição da tag.
        openapi_tags=[
            {
                "name": "diabetes",
                "description": "Triagem de diabetes: 10 respostas, probabilidade e limiar. "
                + FRASE_DADOS_REAIS,
            }
        ],
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
    registrar_limitador(app)
    prefixo = f"/api/v{CONFIG.versao_api}"
    app.include_router(saude.roteador, prefix=prefixo)
    app.include_router(modelo.roteador, prefix=prefixo)
    app.include_router(metadados.roteador, prefix=prefixo)
    app.include_router(predicoes.roteador, prefix=prefixo)
    app.include_router(painel.roteador, prefix=prefixo)
    app.include_router(registros.roteador, prefix=prefixo)
    app.include_router(monitoramento.roteador, prefix=prefixo)
    app.include_router(roteador_diabetes, prefix=prefixo)
    return app


app = criar_app()
