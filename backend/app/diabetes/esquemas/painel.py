"""Contratos do painel e da Consulta da vertente diabetes: KPIs, tabelas longas, fatores, registros.

`Dimensao`, `Medida` e `OpcaoDimensao` vêm de `app.esquemas.painel` por import, sem edição: são
genéricos, e o mesmo componente no OpenAPI deixa o front ler as tabelas longas das duas vertentes
com o mesmo código. O resto leva o sufixo `Diabetes`. As frações são em pontos percentuais (0 a
100), como o `pct` dos agregados; a probabilidade da predição, de 0 a 1, é outro contrato.
"""

from __future__ import annotations

from typing import Any

from pydantic import BaseModel, Field

from app.esquemas.painel import Dimensao, Medida


class ValorRotuladoDiabetes(BaseModel):
    """Um valor do domínio de um campo, com o rótulo de exibição."""

    valor: str
    rotulo: str


class CampoPainelDiabetes(BaseModel):
    """Um campo do painel: o rótulo dele e o de cada valor, na ordem de exibição."""

    campo: str
    rotulo: str
    valores: list[ValorRotuladoDiabetes]


class ResumoDiabetes(BaseModel):
    """`GET /diabetes/painel/resumo`: o recorte contra a base inteira."""

    total_registros: int
    n_diabetes: int
    prevalencia: float | None = Field(
        description="% com diabetes no recorte (0 a 100), na escala da base: não é a da população"
    )
    imc_medio: float | None
    total_global: int
    n_diabetes_global: int
    prevalencia_global: float | None = Field(description="% com diabetes na base inteira (0 a 100)")
    recorte: dict[str, list[Any]]


class AgregadoDiabetes(BaseModel):
    """`GET /diabetes/painel/por-categoria`: tabela longa, uma medida por linha, domínio inteiro."""

    campo: str
    serie: str | None = None
    dimensoes: list[Dimensao]
    medidas: list[Medida]
    amostra_minima: int = Field(description="abaixo deste n a prevalência do grupo é suprimida")
    total_filtrado: int
    total_global: int
    recorte: dict[str, list[Any]]
    campos: list[CampoPainelDiabetes] = Field(
        description="rótulos do campo e da série, e de cada valor do domínio"
    )
    linhas: list[dict[str, Any]] = Field(
        description="{ordem, <dimensões como string>, medida, valor, n, suprimido}; medidas: "
        "contagem, pct (do recorte), n_diabetes e prevalencia (% com diabetes no grupo)"
    )


class FatoresDiabetes(BaseModel):
    """`GET /diabetes/painel/fatores`: as 16 variáveis categóricas × resposta, numa tabela longa."""

    dimensoes: list[Dimensao]
    medidas: list[Medida]
    amostra_minima: int
    total_filtrado: int
    total_global: int
    recorte: dict[str, list[Any]]
    campos: list[CampoPainelDiabetes] = Field(
        description="os 16 fatores, na ordem do gráfico, com o rótulo de cada resposta"
    )
    linhas: list[dict[str, Any]] = Field(
        description="{ordem, fator, resposta, medida, valor, n, suprimido}"
    )


class PaginaRegistrosDiabetes(BaseModel):
    """`GET /diabetes/registros`: página ordenada do recorte, com as 23 colunas e o `id`."""

    total: int
    pagina: int
    tamanho: int
    linhas: list[dict[str, Any]]
    recorte: dict[str, list[Any]]
