"""Contrato de `GET /monitoramento/deriva`: a única rota de leitura que depende do banco (§7.6)."""

from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, Field

Classificacao = Literal["estavel", "atencao", "deriva significativa", "amostra insuficiente"]


class IndicadorFeature(BaseModel):
    """PSI de uma feature sobre as faixas do treino (consulta 03)."""

    feature: str
    tipo: Literal["numerica", "categorica"]
    n_amostra: int
    psi: float | None
    classificacao: Classificacao


class EstatisticaNumerica(BaseModel):
    """Média, desvio e faixa de uma feature numérica, log contra treino (consulta 01)."""

    feature: str
    n_linhas: int
    n_validos: int
    n_nulos: int
    media_log: float | None
    media_treino: float | None
    desvio_log: float | None
    desvio_treino: float | None
    p50_log: float | None
    p50_treino: float | None
    minimo_log: float | None
    maximo_log: float | None
    minimo_treino: float | None
    maximo_treino: float | None
    deslocamento_desvios: float | None
    extrapolou_faixa_de_treino: bool | None


class FaixaComparada(BaseModel):
    """Uma faixa de uma feature: proporção no treino e no log (consulta 02)."""

    feature: str
    faixa_idx: int
    tipo: Literal["numerica", "categorica"]
    faixa_rotulo: str | None
    limite_inf: float | None
    limite_sup: float | None
    n_log: int
    prop_log: float | None
    proporcao_treino: float
    n_treino: int
    n_total_log: int


class RespostaDeriva(BaseModel):
    """Com o banco fora do ar: 200 com `disponivel: false` e `motivo` — nunca 5xx (§4.3.8)."""

    janela_dias: int
    n_minimo: int
    n_amostra: int
    versao_modelo: str
    versao_dados: str
    atualizado_em: str
    disponivel: bool
    motivo: str | None = None
    features: list[IndicadorFeature] = Field(default_factory=list)
    estatisticas: list[EstatisticaNumerica] = Field(default_factory=list)
    faixas: list[FaixaComparada] = Field(default_factory=list)
    consultas: list[str] = Field(
        default_factory=list, description="os arquivos de sql/deriva/ executados"
    )
