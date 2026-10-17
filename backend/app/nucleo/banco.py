"""Acesso ao Postgres. Regra única: nenhuma falha daqui derruba requisição (§4.3.7).

É o ÚNICO módulo que abre conexão. Pool preguiçoso (`min_size=0`): o boot não abre conexão,
e um banco pausado não impede a API de subir e servir o painel inteiro de memória (§4.3.8).
"""

from __future__ import annotations

import asyncio
import json
import logging
import time
from typing import Any

import asyncpg

from app.config import CONFIG

log = logging.getLogger(__name__)

Estado = str  # "desligado" | "frio" | "ok" | "indisponivel"


async def _registrar_codecs(con: asyncpg.Connection) -> None:
    """O jsonb entra e sai como dict, nunca como str (senão o teste do log compara caracteres)."""
    await con.set_type_codec("jsonb", encoder=json.dumps, decoder=json.loads, schema="pg_catalog")


class Banco:
    """Pool preguiçoso com estados `desligado | frio | ok | indisponivel`."""

    def __init__(self) -> None:
        """Nasce desligado; `abrir()` decide, pela configuração, se cria o pool."""
        self._pool: asyncpg.Pool | None = None
        self.estado: Estado = "desligado"
        self.ultimo_erro_em: float | None = None

    async def abrir(self) -> None:
        """Cria o pool SEM abrir conexão. Falha de criação vira estado, nunca exceção."""
        if not CONFIG.banco_habilitado:
            self.estado = "desligado"
            return
        try:
            self._pool = await asyncpg.create_pool(
                dsn=CONFIG.banco_url,
                min_size=0,  # o boot NÃO abre conexão (§4.3.8)
                max_size=CONFIG.banco_pool_max,
                timeout=CONFIG.banco_timeout_conexao_s,
                command_timeout=CONFIG.banco_timeout_consulta_s,
                max_inactive_connection_lifetime=120.0,
                # OBRIGATÓRIO atrás do pooler em modo transação: com cache de statements o
                # pgbouncer devolve, de forma intermitente, "prepared statement _pg_0 already
                # exists". Não "otimizar" este parâmetro de volta.
                statement_cache_size=0,
                # Sem o codec, `entrada` e `saida` voltam como str e todo teste de conteúdo do
                # log compara CARACTERES em vez de chaves (§10.9.2).
                init=_registrar_codecs,
                server_settings={"application_name": CONFIG.nome_repositorio, "timezone": "UTC"},
            )
        except Exception as erro:  # noqa: BLE001 — nunca derruba o boot
            # Nunca logar o DSN nem repr(erro) de conexão: a senha viaja neles.
            log.warning("pool do banco não criado (%s)", type(erro).__name__)
            self._pool = None
            self.estado = "indisponivel"
            self.ultimo_erro_em = time.time()
            return
        self.estado = "frio"

    @property
    def habilitado(self) -> bool:
        """Há um pool para tentar."""
        return self._pool is not None

    async def consultar(
        self, sql: str, *args: Any, timeout: float | None = None
    ) -> list[Any] | None:
        """Devolve list[Record] ou None. NUNCA levanta para o chamador."""
        if self._pool is None:
            return None
        limite = timeout or (
            CONFIG.banco_timeout_acordar_s
            if self.estado in ("frio", "indisponivel")
            else CONFIG.banco_timeout_consulta_s
        )
        try:
            async with asyncio.timeout(limite):
                async with self._pool.acquire() as con:
                    linhas = await con.fetch(sql, *args, timeout=limite)
        except (TimeoutError, OSError, asyncpg.PostgresError, asyncio.CancelledError) as erro:
            self.estado = "indisponivel"
            self.ultimo_erro_em = time.time()
            log.warning("banco indisponível (%s)", type(erro).__name__)
            return None
        except Exception as erro:  # noqa: BLE001 — qualquer outra falha também vira None
            self.estado = "indisponivel"
            self.ultimo_erro_em = time.time()
            log.warning("banco indisponível (%s)", type(erro).__name__)
            return None
        self.estado = "ok"
        return list(linhas)

    async def fechar(self) -> None:
        """Fecha o pool com tempo limitado; nunca segura o desligamento."""
        if self._pool is None:
            return
        try:
            async with asyncio.timeout(5.0):
                await self._pool.close()
        except Exception as erro:  # noqa: BLE001
            log.warning("pool do banco não fechou limpo (%s)", type(erro).__name__)
            self._pool.terminate()
        finally:
            self._pool = None
            self.estado = "desligado"
