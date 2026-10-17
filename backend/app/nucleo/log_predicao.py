"""Log de predição: fila em memória + consumidor único; nunca levanta exceção para quem chama.

Duas camadas, e as duas são necessárias. `BackgroundTasks` roda depois de a resposta ser
enviada, mas dentro da mesma tarefa de requisição — um `connect()` travado contra um banco
pausado seguraria o worker mesmo com o cliente já servido. Por isso a tarefa de fundo só
ENFILEIRA, e um consumidor único criado no `lifespan` é quem fala com o banco.

NÃO há constante de capacidade aqui: o teto é `CONFIG.log_predicao_fila_max`. Uma constante de
módulo ao lado de uma variável de ambiente para o mesmo número é a violação da regra de §6.4.
"""

from __future__ import annotations

import asyncio
import json
import logging
import time
import uuid
from dataclasses import dataclass
from typing import Any

from fastapi import Request

from app.config import CONFIG
from app.dominio.features import COLUNAS
from app.nucleo.banco import Banco

logger = logging.getLogger(__name__)

FALHAS_PARA_ABRIR = 3  # o disjuntor abre após 3 falhas seguidas
PAUSA_CIRCUITO_S = 900.0  # 15 min sem tentar; a próxima tentativa reabre
# As duas acima NÃO são configuráveis de propósito: são política de disjuntor, não ajuste de
# operação, e um valor errado nelas degrada em silêncio.

# Allowlist, nunca denylist: campo novo no schema não é logado por acidente (§6.8.2).
CAMPOS_LOGADOS: frozenset[str] = frozenset(COLUNAS)  # exatamente as 16 features
ORIGENS_VALIDAS = ("painel", "api", "lote", "teste", "carga")
CABECALHO_ORIGEM = "X-Origem-Cliente"

_PARAR = object()  # sentinela: o consumidor encerra depois de processar o que já estava na fila

SQL_INSERIR_LOG = (
    "INSERT INTO operacao.log_predicao "
    "(rota, origem, id_correlacao, entrada, saida, rotulo_saida, risco_acumulado, "
    " versao_modelo, versao_dados, versao_api, latencia_ms, status_http) "
    "VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12) RETURNING id"
)


def sanear(valores: dict[str, Any]) -> dict[str, Any]:
    """Só as 16 features atravessam; `nome`, cabeçalhos e qualquer campo novo ficam de fora."""
    return {k: v for k, v in valores.items() if k in CAMPOS_LOGADOS}


def origem_de(request: Request) -> str:
    """Rótulo grosso da origem: `painel` ou `api`. Nunca o IP, nunca o User-Agent (§6.8.2).

    Lê o cabeçalho `X-Origem-Cliente`, aceita exatamente `painel` e `api`, e devolve `api` para
    qualquer outro valor ou na ausência do cabeçalho. `origem IN ('painel','api')` é a primeira
    cláusula das três consultas de deriva.
    """
    valor = (request.headers.get(CABECALHO_ORIGEM) or "").strip().lower()
    return valor if valor in ("painel", "api") else "api"


@dataclass(frozen=True)
class RegistroPredicao:
    """Uma linha de `operacao.log_predicao`, já saneada."""

    rota: str
    origem: str
    id_correlacao: str
    entrada: dict[str, Any]
    saida: dict[str, Any]
    rotulo_saida: str
    risco_acumulado: float | None
    versao_modelo: str
    versao_dados: str
    versao_api: str
    latencia_ms: float
    status_http: int = 200

    def parametros(self) -> tuple[Any, ...]:
        """Os 12 parâmetros posicionais de `SQL_INSERIR_LOG` (jsonb passa como dict: codec)."""
        return (
            self.rota,
            self.origem,
            uuid.UUID(self.id_correlacao),
            self.entrada,
            self.saida,
            self.rotulo_saida,
            self.risco_acumulado,
            self.versao_modelo,
            self.versao_dados,
            self.versao_api,
            float(self.latencia_ms),
            int(self.status_http),
        )

    def tamanho_bytes(self) -> int:
        """Teto de bytes aplicado na aplicação: CHECK no Postgres exige função IMMUTABLE."""
        return len(json.dumps(self.entrada, ensure_ascii=False)) + len(
            json.dumps(self.saida, ensure_ascii=False)
        )


class SumidouroLog:
    """Fila em memória + consumidor único + disjuntor. Nunca levanta para quem chama."""

    def __init__(self) -> None:
        """Criado DENTRO do lifespan: captura o event loop para o `call_soon_threadsafe`."""
        self._fila: asyncio.Queue[Any] = asyncio.Queue(maxsize=CONFIG.log_predicao_fila_max)
        self._loop = asyncio.get_running_loop()
        self._circuito_ate = 0.0
        self._falhas_seguidas = 0
        self._banco: Banco | None = None
        self.gravados = 0
        self.descartados = 0

    @property
    def circuito_aberto(self) -> bool:
        """Disjuntor aberto: derivado de `_circuito_ate`, nunca um atributo solto."""
        return time.monotonic() < self._circuito_ate

    @property
    def degradado(self) -> bool:
        """O que `/health` admite: disjuntor aberto OU banco indisponível (nada é gravado)."""
        banco_fora = self._banco is not None and self._banco.estado == "indisponivel"
        return self.circuito_aberto or banco_fora

    @property
    def tamanho_fila(self) -> int:
        """Itens à espera do consumidor."""
        return self._fila.qsize()

    def registrar(self, registro: RegistroPredicao) -> None:
        """Chamada pela BackgroundTask, de uma THREAD do pool. Sem I/O, sem raise."""
        try:
            if not CONFIG.log_predicao_habilitado:  # interruptor de emergência
                return
            if registro.tamanho_bytes() > CONFIG.limite_payload_log_bytes:
                self.descartados += 1
                return
            # asyncio.Queue NÃO é thread-safe e as rotas de predição são síncronas (§6.4):
            # put_nowait direto daqui faz o _wakeup_next tocar o loop da thread errada e o
            # consumidor pode nunca acordar — o log parando em silêncio.
            self._loop.call_soon_threadsafe(self._enfileirar, registro)
        except Exception:  # noqa: BLE001 — o log jamais propaga
            self.descartados += 1
            logger.warning("log de predição descartado", exc_info=True)

    def _enfileirar(self, registro: RegistroPredicao) -> None:
        """Já dentro do event loop. Aqui o put_nowait é seguro."""
        try:
            self._fila.put_nowait(registro)
        except asyncio.QueueFull:
            self.descartados += 1  # fila cheia: descarta o NOVO, não bloqueia
        except Exception:  # noqa: BLE001
            self.descartados += 1
            logger.warning("log de predição descartado", exc_info=True)

    async def encerrar(self, consumidor: asyncio.Task[None], timeout: float = 5.0) -> None:
        """Encerra o consumidor SEM cancelá-lo no meio de um INSERT.

        Cancelar uma tarefa dentro de `fetch` dispara o protocolo de cancelamento do asyncpg
        (uma conexão nova só para o CancelRequest) e a devolução da conexão ao pool fica
        esperando por ele — o desligamento trava. A sentinela pede ao consumidor que pare
        depois do item corrente; o cancelamento é só o último recurso, e não é esperado.
        """
        try:
            self._fila.put_nowait(_PARAR)
        except Exception:  # noqa: BLE001 — fila cheia ou quebrada: cai no cancelamento abaixo
            pass
        try:
            await asyncio.wait_for(asyncio.shield(consumidor), timeout)
        except (TimeoutError, asyncio.CancelledError):
            logger.warning("consumidor do log não encerrou em %.0fs; cancelando", timeout)
        if not consumidor.done():
            consumidor.cancel()

    async def drenar(self, timeout: float = 5.0) -> None:
        """Espera a fila esvaziar. SÓ em teste — o task_done() está no finally do consumidor."""
        await asyncio.wait_for(self._fila.join(), timeout)

    async def consumir(self, banco: Banco) -> None:
        """O único que fala com o banco. Falha vira contador e, na terceira seguida, disjuntor."""
        self._banco = banco
        while True:
            registro = await self._fila.get()
            if registro is _PARAR:
                self._fila.task_done()
                return
            try:
                if self.circuito_aberto:  # disjuntor aberto: nem tenta
                    self.descartados += 1
                    continue
                if await banco.consultar(SQL_INSERIR_LOG, *registro.parametros()) is None:
                    raise RuntimeError("banco indisponível")
                self.gravados += 1
                self._falhas_seguidas = 0
            except asyncio.CancelledError:
                raise
            except Exception:  # noqa: BLE001
                self.descartados += 1
                self._falhas_seguidas += 1
                if self._falhas_seguidas >= FALHAS_PARA_ABRIR:
                    self._circuito_ate = time.monotonic() + PAUSA_CIRCUITO_S
                    logger.error("log de predição em circuito aberto", exc_info=True)
            finally:
                self._fila.task_done()
