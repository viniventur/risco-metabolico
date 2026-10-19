"""Predição da vertente diabetes: do JSON ao DataFrame do artefato, e do modelo à probabilidade.

`montar_quadro` é o espelho, em serviço, do que o treino viu: as dez ENTRADAS na ordem de
`feature_names_in_`, com os dtypes do snapshot (float64, int64, object). O CLI de treino passa os
casos de ouro por aqui também, de modo que a predição de ouro e a da API saem do mesmo caminho.
`detectar_fora_do_dominio` é a honestidade sobre extrapolação, sobre o IMC que o modelo vê: o
arredondado, como a pesquisa arredondou o da base.
"""

from __future__ import annotations

from collections.abc import Mapping, Sequence
from typing import TYPE_CHECKING, Any

import numpy as np
import pandas as pd

from app.diabetes.dominio.features import DTYPES_SNAPSHOT, ENTRADAS
from app.diabetes.dominio.regras import DOMINIOS, FAIXAS_TREINO
from app.nucleo.erros import CategoriaDesconhecida, ForaDoDominio

if TYPE_CHECKING:
    from app.diabetes.nucleo.artefato import ArtefatoDiabetes


def montar_quadro(casos: Sequence[Mapping[str, Any]]) -> pd.DataFrame:
    """DataFrame com N linhas nas dez ENTRADAS, na ordem do artefato e com os dtypes do treino."""
    faltam = sorted({c for caso in casos for c in ENTRADAS if c not in caso})
    if faltam:
        raise ForaDoDominio(f"campos ausentes na entrada: {faltam}", [{"campo": c} for c in faltam])
    quadro = pd.DataFrame([{c: caso[c] for c in ENTRADAS} for caso in casos], columns=ENTRADAS)
    try:
        return quadro.astype({c: DTYPES_SNAPSHOT[c] for c in ENTRADAS})
    except (TypeError, ValueError) as erro:
        raise ForaDoDominio(f"tipo de valor fora do contrato: {erro}") from erro


def detectar_categoria_desconhecida(valores: Mapping[str, Any]) -> None:
    """Falha explícita, nomeando campo e valor, antes de o encoder recusar o valor sozinho."""
    for campo in ENTRADAS:
        dominio = DOMINIOS.get(campo)
        if dominio is not None and campo in valores and valores[campo] not in dominio:
            raise CategoriaDesconhecida(campo, valores[campo], list(dominio))


def detectar_fora_do_dominio(valores: Mapping[str, Any]) -> list[str]:
    """Campos cujo valor, como o modelo o vê, fica fora da faixa observada na base."""
    fora: list[str] = []
    for campo, (minimo, maximo) in FAIXAS_TREINO.items():
        if campo in valores and not (minimo <= float(np.round(float(valores[campo]))) <= maximo):
            fora.append(campo)
    return fora


def prever(artefato: ArtefatoDiabetes, valores: Mapping[str, Any]) -> float:
    """Probabilidade estimada de diagnóstico de diabetes para uma pessoa, entre 0 e 1."""
    detectar_categoria_desconhecida(valores)
    probabilidade = float(artefato.probabilidades(montar_quadro([valores]))[0])
    return min(max(probabilidade, 0.0), 1.0)
