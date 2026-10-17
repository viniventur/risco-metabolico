"""Schemas compartilhados: saúde, erro padrão, o modelo e as importâncias.

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


class MetricasModelo(BaseModel):
    """As três métricas de teste do manifest — nunca escritas à mão."""

    acuracia: float
    f1_macro: float
    recall_risco: float


class InfoModelo(BaseModel):
    """`GET /model/info`: o manifest normalizado. É a fonte das métricas publicadas."""

    nome: str
    versao: str
    algoritmo: str
    treinado_em: str
    versao_dados: str
    sha256: str
    n_features_entrada: int
    n_features_modelo: int
    binning_ativo: bool
    imc_como_feature: bool
    classes: list[str] = Field(description="Ordem alfabética do encoder (ordem de predict_proba)")
    ordem_clinica: list[str] = Field(description="Ordem em que a API devolve as probabilidades")
    hiperparametros: dict[str, Any]
    smote: dict[str, Any]
    split: dict[str, Any]
    metricas_teste: MetricasModelo
    overfitting: dict[str, Any] | None = None
    ambiente: dict[str, Any]
    notebook_origem: str
    aviso: str


class ItemImportancia(BaseModel):
    """Importância de uma feature de entrada (one-hot já somado)."""

    feature: str
    rotulo: str
    importancia: float
    importancia_pct: float


class ImportanciaFeatures(BaseModel):
    """`GET /model/feature-importance`."""

    modelo: str
    versao: str
    itens: list[ItemImportancia]
