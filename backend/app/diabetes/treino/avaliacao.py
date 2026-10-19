"""Avaliação da vertente diabetes: validação cruzada, limiar de triagem, teste e grupos.

As funções são as do notebook 02, literalmente: `validar` (célula 15), `limiar_para_recall` e
`ponto_de_operacao` (célula 29), a avaliação final no teste (célula 32) e o desempenho por sexo e
por idade (célula 34). O limiar sai das predições FORA DA DOBRA do treino e o teste é olhado uma
vez, para medir — nunca para escolher.
"""

from __future__ import annotations

from collections.abc import Callable
from typing import Any

import numpy as np
import pandas as pd
from sklearn.metrics import (
    average_precision_score,
    brier_score_loss,
    confusion_matrix,
    precision_recall_curve,
    roc_auc_score,
)

# 1. O critério do limiar (decisão D4, célula 28): o MAIOR limiar com recall >= 0,80 fora da dobra.
RECALL_ALVO = 0.80
CRITERIO_LIMIAR = f"maior limiar com recall >= {RECALL_ALVO} nas predições fora da dobra do treino"
# A tabela de preço de cada alvo de recall (célula 29) e o segundo ponto de leitura (célula 32).
RECALLS_DA_TABELA: tuple[float, ...] = (0.70, 0.75, 0.80, 0.85, 0.90)
PRECISAO_FIXA = 0.30
# Os três grupos de idade da célula 34, sobre as faixas de 5 anos do BRFSS.
CORTES_IDADE: list[int] = [0, 5, 9, 13]
GRUPOS_IDADE: list[str] = ["18 a 44 anos", "45 a 64 anos", "65 anos ou mais"]


def validar(
    fabrica: Callable[[], Any],
    X_treino: pd.DataFrame,
    y_treino: np.ndarray,
    dobras: list[tuple[np.ndarray, np.ndarray]],
) -> tuple[np.ndarray, dict[str, float]]:
    """Predições fora da dobra e métricas por dobra (média e desvio), nas MESMAS 5 dobras."""
    fora_da_dobra = np.zeros(len(y_treino))
    por_dobra: list[list[float]] = []
    for indices_treino, indices_validacao in dobras:
        modelo = fabrica()
        modelo.fit(X_treino.iloc[indices_treino], y_treino[indices_treino])
        p = modelo.predict_proba(X_treino.iloc[indices_validacao])[:, 1]
        fora_da_dobra[indices_validacao] = p
        alvo = y_treino[indices_validacao]
        por_dobra.append(
            [
                float(roc_auc_score(alvo, p)),
                float(average_precision_score(alvo, p)),
                float(brier_score_loss(alvo, p)),
            ]
        )
    m = np.array(por_dobra)
    return fora_da_dobra, {
        "roc_auc": float(m[:, 0].mean()),
        "roc_auc_dp": float(m[:, 0].std(ddof=1)),
        "pr_auc": float(m[:, 1].mean()),
        "pr_auc_dp": float(m[:, 1].std(ddof=1)),
        "brier": float(m[:, 2].mean()),
    }


def limiar_para_recall(alvo: np.ndarray, p: np.ndarray, recall_alvo: float) -> float:
    """O maior t tal que recall(p >= t) >= recall_alvo; os empates em t entram todos."""
    ordem = np.argsort(-p, kind="mergesort")
    recall_acumulado = np.cumsum(alvo[ordem]) / alvo.sum()
    return float(p[ordem][np.argmax(recall_acumulado >= recall_alvo)])


def ponto_de_operacao(alvo: np.ndarray, p: np.ndarray, limiar: float) -> dict[str, float | int]:
    """Recall, precisão, especificidade e fração encaminhada com `p >= limiar`, e a matriz."""
    encaminhar = p >= limiar
    vp = int((encaminhar & (alvo == 1)).sum())
    fp = int((encaminhar & (alvo == 0)).sum())
    vn = int((~encaminhar & (alvo == 0)).sum())
    fn = int((~encaminhar & (alvo == 1)).sum())
    return {
        "limiar": float(limiar),
        "recall": vp / (vp + fn),
        "precisao": vp / (vp + fp),
        "especificidade": vn / (vn + fp),
        "encaminhados": float(encaminhar.mean()),
        "vp": vp,
        "fp": fp,
        "vn": vn,
        "fn": fn,
    }


def pontos_de_operacao(alvo: np.ndarray, p: np.ndarray) -> list[dict[str, float | int]]:
    """A tabela da célula 29: o limiar e o preço de cada alvo de recall, fora da dobra."""
    return [
        {"recall_alvo": r, **ponto_de_operacao(alvo, p, limiar_para_recall(alvo, p, r))}
        for r in RECALLS_DA_TABELA
    ]


def avaliar_teste(
    y_teste: np.ndarray, p_teste: np.ndarray, limiar: float, prevalencia_treino: float
) -> dict[str, float]:
    """A avaliação final, uma vez, no teste (célula 32): ordenação, calibração e o limiar."""
    precisoes, recalls, _ = precision_recall_curve(y_teste, p_teste)
    no_limiar = ponto_de_operacao(y_teste, p_teste, limiar)
    return {
        "roc_auc": float(roc_auc_score(y_teste, p_teste)),
        "pr_auc": float(average_precision_score(y_teste, p_teste)),
        "brier": float(brier_score_loss(y_teste, p_teste)),
        "brier_da_prevalencia": float(
            brier_score_loss(y_teste, np.full(len(y_teste), prevalencia_treino))
        ),
        "precisao_fixa": PRECISAO_FIXA,
        "recall_na_precisao_fixa": float(recalls[precisoes >= PRECISAO_FIXA].max()),
        "recall_no_limiar": float(no_limiar["recall"]),
        "precisao_no_limiar": float(no_limiar["precisao"]),
        "especificidade_no_limiar": float(no_limiar["especificidade"]),
        "encaminhados_no_limiar": float(no_limiar["encaminhados"]),
    }


def matriz_confusao(y_teste: np.ndarray, p_teste: np.ndarray, limiar: float) -> dict[str, Any]:
    """A matriz do teste no limiar, com os rótulos da célula 32 (linhas: real; colunas: triagem)."""
    matriz = confusion_matrix(y_teste, (p_teste >= limiar).astype("int64"), labels=[0, 1])
    return {
        "limiar": float(limiar),
        "linhas": ["real: sem diabetes", "real: com diabetes"],
        "colunas": ["não encaminhado", "encaminhado"],
        "matriz": matriz.tolist(),
    }


def por_grupo(
    X_teste: pd.DataFrame, y_teste: np.ndarray, p_teste: np.ndarray, limiar: float
) -> list[dict[str, Any]]:
    """Desempenho no teste por sexo e por grupo de idade (célula 34): o limiar é um só."""
    grupo_idade = pd.cut(X_teste["Faixa_Etaria"], CORTES_IDADE, labels=GRUPOS_IDADE)
    linhas: list[dict[str, Any]] = []
    for nome, chave in (("sexo", X_teste["Sexo"]), ("idade", grupo_idade)):
        for valor in chave.dropna().unique():
            mascara = (chave == valor).to_numpy()
            alvo, p = y_teste[mascara], p_teste[mascara]
            ponto = ponto_de_operacao(alvo, p, limiar)
            linhas.append(
                {
                    "grupo": nome,
                    "valor": str(valor),
                    "n": int(mascara.sum()),
                    "prevalencia": float(alvo.mean()),
                    "probabilidade_media": float(p.mean()),
                    "roc_auc": float(roc_auc_score(alvo, p)),
                    "recall": float(ponto["recall"]),
                    "precisao": float(ponto["precisao"]),
                    "encaminhados": float(ponto["encaminhados"]),
                }
            )
    return sorted(linhas, key=lambda linha: (linha["grupo"], linha["valor"]))
