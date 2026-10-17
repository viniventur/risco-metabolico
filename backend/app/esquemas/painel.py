"""Contratos do painel e da consulta: agregados longos, KPIs, pontos, dimensões, registros."""

from __future__ import annotations

from typing import Any, Literal

from pydantic import BaseModel, Field


class Dimensao(BaseModel):
    """Uma dimensão do agregado; `tipo` diz ao front como converter o valor (sempre string)."""

    nome: str
    tipo: Literal["texto", "inteiro"]


class Medida(BaseModel):
    """Uma medida do agregado; a classe escolhe a tolerância do teste de paridade."""

    nome: str
    classe: Literal["contagem", "media_limitada", "proporcao", "texto"]


class Agregado(BaseModel):
    """`GET /painel/por-categoria`: tabela longa, uma medida por linha, domínio completo."""

    campo: str
    metrica: Literal["contagem", "imc_medio"]
    serie: str | None = None
    dimensoes: list[Dimensao]
    medidas: list[Medida]
    amostra_minima: int | None = None
    total_filtrado: int
    total_global: int
    recorte: dict[str, list[Any]]
    linhas: list[dict[str, Any]] = Field(
        description="{ordem, <dimensões como string>, medida, valor|valor_texto, n, suprimido}"
    )


class Resumo(BaseModel):
    """`GET /painel/resumo`: os 6 KPIs da faixa superior."""

    total_registros: int
    idade_media: float | None
    altura_media: float | None
    peso_medio: float | None
    nivel_predominante: str | None
    n_predominante: int
    total_global: int
    recorte: dict[str, list[Any]]


class GeneroResumo(BaseModel):
    """Uma linha de `GET /painel/genero`."""

    genero: str
    n: int
    percentual: float | None
    imc_medio: float | None
    n_imc: int
    nivel_predominante: str | None
    n_predominante: int


class Ponto(BaseModel):
    """Um registro da nuvem altura × peso."""

    altura: float
    peso: float
    imc: float
    nivel: str


class OpcaoDimensao(BaseModel):
    """Um valor de dimensão filtrável, com rótulo de exibição e contagem global."""

    valor: str | int
    rotulo: str
    n: int


class PaginaRegistros(BaseModel):
    """`GET /registros`: página ordenada do recorte, com as 18 colunas e o `id`."""

    total: int
    pagina: int
    tamanho: int
    linhas: list[dict[str, Any]]
    recorte: dict[str, list[Any]]
