"""Schemas compartilhados: saúde, erro padrão e, a partir da F6, o modelo e os agregados.

Este pacote não importa pandas nem sklearn: é o que mantém o `openapi.json` limpo e permite
gerar os tipos TypeScript do front a partir dele.
"""

from __future__ import annotations

from typing import Any, Literal

from pydantic import BaseModel, Field

EstadoBanco = Literal["desligado", "frio", "ok", "indisponivel"]
EstadoLog = Literal["desligado", "ok", "degradado"]


class Saude(BaseModel):
    """Resposta de `GET /health` — sempre 200; o banco não é requisito de vivacidade."""

    status: Literal["ok"] = "ok"
    versao_api: str
    artefato_carregado: bool
    uptime_s: float = Field(ge=0.0)
    banco: EstadoBanco
    log_predicao: EstadoLog
    logs_gravados: int = Field(ge=0)
    logs_descartados: int = Field(ge=0)


class Prontidao(BaseModel):
    """Resposta de `GET /ready`: 200 só com artefato e agregados carregados."""

    pronto: bool
    artefato_carregado: bool
    agregados_carregados: bool
    motivo: str | None = None


class ErroPadrao(BaseModel):
    """O envelope único de erro do projeto (ver `nucleo/erros.py`)."""

    erro: str
    mensagem: str
    detalhes: Any = Field(default_factory=list)
