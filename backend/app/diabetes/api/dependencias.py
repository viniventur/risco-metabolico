"""Dependências das rotas da vertente diabetes: artefato, base do painel, filtros e paginação."""

from __future__ import annotations

from typing import Annotated, Literal

from fastapi import Query, Request

from app.api.dependencias import Paginacao
from app.diabetes.dominio.agregados import COLUNAS_REGISTROS, BasePainelDiabetes
from app.diabetes.dominio.filtros import FiltroDiabetes, normalizar_filtros
from app.diabetes.nucleo.artefato import ArtefatoDiabetes, RegistroDiabetes
from app.nucleo.erros import ArtefatoIndisponivel


def obter_registro_diabetes(request: Request) -> RegistroDiabetes:
    """O registro da vertente; 503 explícito enquanto o lifespan não o carregou."""
    registro = getattr(request.app.state, "registro_diabetes", None)
    if registro is None:
        raise ArtefatoIndisponivel("nenhum artefato de modelo da vertente diabetes carregado")
    return registro


def obter_artefato_diabetes(
    request: Request,
    versao: str | None = Query(
        default=None, description="Versão do modelo de diabetes; padrão: a do manifest da vertente"
    ),
) -> ArtefatoDiabetes:
    """O artefato pedido por `?versao=` ou o padrão."""
    return obter_registro_diabetes(request).obter(versao)


def obter_base_diabetes(request: Request) -> BasePainelDiabetes:
    """A base do painel da vertente em memória; 503 se o parquet não foi carregado no lifespan."""
    base = getattr(request.app.state, "agregados_diabetes", None)
    if base is None:
        raise ArtefatoIndisponivel(
            "base do painel da vertente diabetes (diabetes/base_painel.parquet) não carregada"
        )
    return base


def obter_filtros_diabetes(
    sexo: Annotated[list[str], Query()] = [],  # noqa: B006 — FastAPI exige o default literal
    faixa_etaria: Annotated[list[str], Query()] = [],  # noqa: B006
    faixa_imc: Annotated[list[str], Query()] = [],  # noqa: B006
    pressao_alta: Annotated[list[str], Query()] = [],  # noqa: B006
    colesterol_alto: Annotated[list[str], Query()] = [],  # noqa: B006
    atividade_fisica_30_dias: Annotated[list[str], Query()] = [],  # noqa: B006
) -> FiltroDiabetes:
    """Os 6 filtros multivalorados da URL, validados contra o domínio (422 nomeando o filtro)."""
    return normalizar_filtros(
        sexo=sexo,
        faixa_etaria=faixa_etaria,
        faixa_imc=faixa_imc,
        pressao_alta=pressao_alta,
        colesterol_alto=colesterol_alto,
        atividade_fisica_30_dias=atividade_fisica_30_dias,
    )


def paginacao_diabetes(
    pagina: int = Query(default=1, ge=1),
    tamanho: int = Query(default=50, ge=1, le=200),
    ordenar_por: str = Query(default="IMC", description=f"uma de {COLUNAS_REGISTROS}"),
    direcao: Literal["asc", "desc"] = Query(default="desc"),
) -> Paginacao:
    """A paginação da Consulta da vertente; a ordem inicial é a da obesidade, IMC desc (7.4)."""
    return Paginacao(pagina=pagina, tamanho=tamanho, ordenar_por=ordenar_por, direcao=direcao)
