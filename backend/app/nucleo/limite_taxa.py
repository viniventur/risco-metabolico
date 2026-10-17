"""Limitação de taxa por chave pseudonimizada, em memória, só nos três POST de predição (§6.8.3).

Sem Redis: o serviço roda com `--workers 1`, onde a contagem em memória é exata. Contar no
Postgres foi descartado — colocaria uma escrita síncrona no caminho crítico da predição.
Com N instâncias o limite efetivo vira N×; está no README como limitação conhecida.
"""

from __future__ import annotations

import hashlib
import hmac
from datetime import UTC, datetime

from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse
from slowapi import Limiter
from slowapi.errors import RateLimitExceeded
from slowapi.util import get_remote_address

from app.config import CONFIG
from app.nucleo.erros import envelope


def chave_origem(request: Request) -> str:
    """Pseudônimo diário do IP: HMAC com sal secreto. O IP nunca é guardado, nem em memória.

    Dentro do dia dá para dizer "isto veio tudo do mesmo lugar"; passado o dia, as chaves de
    ontem e de hoje são inligáveis, e sem o sal ninguém reverte (§6.8.2).
    """
    ip = get_remote_address(request) or "desconhecido"
    material = f"{datetime.now(UTC).date().isoformat()}|{ip}".encode()
    sal = (CONFIG.sal_taxa or "limitador-desligado").encode()
    return hmac.new(sal, material, hashlib.sha256).hexdigest()[:16]


limitador = Limiter(key_func=chave_origem, enabled=CONFIG.limite_taxa_ativo, headers_enabled=False)


def _limite_excedido(request: Request, exc: RateLimitExceeded) -> JSONResponse:
    """O 429 no envelope único do projeto, com `Retry-After` — o handler padrão quebraria o contrato."""  # noqa: E501
    limite = exc.limit
    try:
        segundos = int(limite.limit.get_expiry()) if limite is not None else 60
    except Exception:  # noqa: BLE001
        segundos = 60
    segundos = segundos or 60
    return JSONResponse(
        status_code=429,
        headers={
            "Retry-After": str(segundos),
            "RateLimit-Limit": str(limite.limit) if limite is not None else "",
        },
        content=envelope(
            "limite_de_taxa",
            f"Muitas predições seguidas. Tente de novo em {segundos}s.",
            {"retry_after_s": segundos},
        ),
    )


def registrar_limitador(app: FastAPI) -> None:
    """Liga o limitador ao app (`app.state.limiter`, onde o slowapi o procura) e o 429."""
    app.state.limiter = limitador
    app.add_exception_handler(RateLimitExceeded, _limite_excedido)  # type: ignore[arg-type]
