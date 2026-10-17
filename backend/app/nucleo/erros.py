"""Exceções de domínio e os handlers que as traduzem para o envelope `{erro, mensagem, detalhes}`.

O legado respondia a erro com `st.error` + `st.stop`. Aqui toda falha — de domínio, de
validação, HTTP ou de limite de taxa — sai no mesmo formato, para o front e para o teste.
"""

from __future__ import annotations

from typing import Any

from fastapi import FastAPI, Request, status
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from starlette.exceptions import HTTPException

_NOMES_HTTP = {
    404: "nao_encontrado",
    413: "lote_acima_do_limite",
    422: "entrada_invalida",
    429: "limite_de_taxa",
    503: "indisponivel",
}


def envelope(erro: str, mensagem: str, detalhes: Any = None) -> dict[str, Any]:
    """Monta o corpo de erro padrão do projeto."""
    return {
        "erro": erro,
        "mensagem": mensagem,
        "detalhes": detalhes if detalhes is not None else [],
    }


class ErroDominio(Exception):
    """Base das exceções de domínio: cada subclasse fixa o status e o código."""

    status_http: int = status.HTTP_400_BAD_REQUEST
    codigo: str = "erro_de_dominio"

    def __init__(self, mensagem: str, detalhes: Any = None) -> None:
        """Guarda a mensagem para o usuário e os detalhes estruturados."""
        super().__init__(mensagem)
        self.mensagem = mensagem
        self.detalhes = detalhes


class CategoriaDesconhecida(ErroDominio):
    """Valor fora das `categories_` do encoder: falha explícita, não `handle_unknown='ignore'`."""

    status_http = status.HTTP_422_UNPROCESSABLE_CONTENT
    codigo = "categoria_desconhecida"

    def __init__(self, campo: str, valor: Any, permitidos: list[Any] | None = None) -> None:
        """Nomeia o campo, o valor recusado e, quando disponível, os valores aceitos."""
        self.campo = campo
        self.valor = valor
        super().__init__(
            f"Valor {valor!r} não existe no domínio de treino do campo {campo!r}.",
            [{"campo": campo, "valor": valor, "permitidos": permitidos or []}],
        )


class ForaDoDominio(ErroDominio):
    """Entrada estruturalmente válida, mas fora do que o serviço consegue tratar."""

    status_http = status.HTTP_422_UNPROCESSABLE_CONTENT
    codigo = "fora_do_dominio"


class ArtefatoIndisponivel(ErroDominio):
    """O artefato de modelo não carregou (ou não passou na integridade): 503, nunca silêncio."""

    status_http = status.HTTP_503_SERVICE_UNAVAILABLE
    codigo = "artefato_indisponivel"


class NaoEncontrado(ErroDominio):
    """Recurso inexistente (por exemplo, `?versao=` de modelo que não está no registro)."""

    status_http = status.HTTP_404_NOT_FOUND
    codigo = "nao_encontrado"


def registrar_handlers(app: FastAPI) -> None:
    """Liga os quatro handlers ao app; o de 429 é registrado por `nucleo/limite_taxa.py`."""

    @app.exception_handler(ErroDominio)
    async def _erro_dominio(_: Request, exc: ErroDominio) -> JSONResponse:
        return JSONResponse(
            status_code=exc.status_http,
            content=envelope(exc.codigo, exc.mensagem, exc.detalhes),
        )

    @app.exception_handler(RequestValidationError)
    async def _validacao(_: Request, exc: RequestValidationError) -> JSONResponse:
        # `extra="forbid"` e enums fechados: um typo vira 422 nomeando o campo, nunca silêncio.
        detalhes = [
            {
                "campo": str(e["loc"][-1]) if e.get("loc") else None,
                "mensagem": e.get("msg", ""),
                "tipo": e.get("type", ""),
            }
            for e in exc.errors()
        ]
        return JSONResponse(
            status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
            content=envelope("entrada_invalida", "A entrada não respeita o contrato.", detalhes),
        )

    # Registrado sobre a HTTPException do STARLETTE (a do FastAPI é subclasse dela): só assim o
    # 404 de rota inexistente, levantado pelo roteador, também sai no envelope do projeto.
    @app.exception_handler(HTTPException)
    async def _http(_: Request, exc: HTTPException) -> JSONResponse:
        codigo = _NOMES_HTTP.get(exc.status_code, "erro_http")
        return JSONResponse(
            status_code=exc.status_code,
            content=envelope(codigo, str(exc.detail)),
            headers=dict(exc.headers or {}),
        )
