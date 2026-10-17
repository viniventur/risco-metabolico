"""Predição: do JSON de entrada ao DataFrame na ordem do artefato, e do modelo à resposta.

`montar_linha` é o espelho, em serviço, do que o treino viu: as 16 colunas na ordem de
`artefato.colunas`, com os dtypes da tabela de §4.3.3 (float64, int64, object). Igualar os dois
lados é o que sustenta a paridade treino/serviço (§10.2). `prever` reordena o vetor alfabético
do encoder para a ORDEM CLÍNICA (§6.3), e `detectar_fora_do_dominio` é a honestidade sobre
extrapolação: a UI aceita faixas mais largas que as do treino.
"""

from __future__ import annotations

import re
from collections.abc import Mapping, Sequence
from typing import TYPE_CHECKING, Any

import pandas as pd

from app.dominio.features import DTYPES_SNAPSHOT
from app.dominio.regras import CLASSES_RISCO, DOMINIOS, FAIXAS_TREINO, ORDEM_CLINICA
from app.esquemas.saida import ProbabilidadeClasse
from app.nucleo.erros import CategoriaDesconhecida, ForaDoDominio

if TYPE_CHECKING:
    from app.nucleo.artefato import ArtefatoModelo

_DESCONHECIDA = re.compile(r"Found unknown categories \[(?P<valor>.*?)\] in column (?P<idx>\d+)")


def montar_quadro(colunas: Sequence[str], casos: Sequence[Mapping[str, Any]]) -> pd.DataFrame:
    """DataFrame com N linhas, nas colunas e na ordem do artefato, com os dtypes do treino."""
    faltam = sorted({c for caso in casos for c in colunas if c not in caso})
    if faltam:
        raise ForaDoDominio(f"campos ausentes na entrada: {faltam}", [{"campo": c} for c in faltam])
    quadro = pd.DataFrame([{c: caso[c] for c in colunas} for caso in casos], columns=list(colunas))
    try:
        return quadro.astype({c: DTYPES_SNAPSHOT[c] for c in colunas})
    except (TypeError, ValueError) as erro:
        raise ForaDoDominio(f"tipo de valor fora do contrato: {erro}") from erro


def montar_linha(colunas: Sequence[str], valores: Mapping[str, Any]) -> pd.DataFrame:
    """DataFrame de 1 linha **na ordem de `artefato.colunas`** (§6.1)."""
    return montar_quadro(colunas, [valores])


def detectar_categoria_desconhecida(valores: Mapping[str, Any]) -> None:
    """Falha explícita, nomeando campo e valor, no lugar do `handle_unknown='ignore'`."""
    for campo, dominio in DOMINIOS.items():
        if campo in valores and valores[campo] not in dominio:
            raise CategoriaDesconhecida(campo, valores[campo], list(dominio))


def detectar_fora_do_dominio(artefato: ArtefatoModelo, valores: Mapping[str, Any]) -> list[str]:
    """Campos numéricos cujo valor extrapola a faixa observada no treino (a UI aceita mais)."""
    fora: list[str] = []
    for campo, (minimo, maximo) in FAIXAS_TREINO.items():
        if campo in valores and not (minimo <= float(valores[campo]) <= maximo):
            fora.append(campo)
    return fora


def prever(artefato: ArtefatoModelo, valores: Mapping[str, Any]) -> list[ProbabilidadeClasse]:
    """`predict_proba` sobre a linha montada, nas 7 classes em ORDEM CLÍNICA crescente."""
    detectar_categoria_desconhecida(valores)
    linha = montar_linha(artefato.colunas, valores)
    try:
        probas = artefato.predict_proba(linha)[0]
    except ValueError as erro:
        # Rede de segurança: se o encoder recusar algo que DOMINIOS deixou passar, ainda assim o
        # erro sai nomeando o campo — nunca um 500 opaco.
        m = _DESCONHECIDA.search(str(erro))
        if m:
            colunas_cat = list(artefato.pipeline.named_steps["columns"].transformers_[0][2])
            campo = colunas_cat[int(m.group("idx"))]
            raise CategoriaDesconhecida(
                campo, valores.get(campo), list(DOMINIOS.get(campo, []))
            ) from erro
        raise
    por_classe = {classe: float(p) for classe, p in zip(artefato.classes, probas, strict=True)}
    return [
        ProbabilidadeClasse(
            classe=classe,
            probabilidade=min(max(por_classe[classe], 0.0), 1.0),
            de_risco=classe in CLASSES_RISCO,
        )
        for classe in ORDEM_CLINICA
    ]
