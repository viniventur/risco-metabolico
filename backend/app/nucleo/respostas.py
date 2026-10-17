"""`ETag` e `Cache-Control` para o que é servido de memória: agregados, metadados, modelo."""

from __future__ import annotations

import hashlib
import json
from typing import Any

from fastapi import Request, Response
from fastapi.responses import JSONResponse


def etag_de(conteudo: Any) -> str:
    """ETag forte: sha256 do JSON canônico (chaves ordenadas), entre aspas como manda o RFC."""
    bruto = json.dumps(
        conteudo, sort_keys=True, ensure_ascii=False, separators=(",", ":"), default=str
    )
    return '"' + hashlib.sha256(bruto.encode("utf-8")).hexdigest()[:32] + '"'


def resposta_cacheavel(
    request: Request, conteudo: Any, *, max_age: int, com_etag: bool = True
) -> Response:
    """JSON com `Cache-Control: public, max-age=N` e, opcionalmente, `ETag` + 304.

    `expose_headers=["ETag"]` no CORS (§11.4) é o que permite ao navegador usar o 304
    cross-origin.
    """
    cabecalhos = {"Cache-Control": f"public, max-age={max_age}"}
    if com_etag:
        etag = etag_de(conteudo)
        cabecalhos["ETag"] = etag
        if request.headers.get("if-none-match") == etag:
            return Response(status_code=304, headers=cabecalhos)
    return JSONResponse(content=conteudo, headers=cabecalhos)
