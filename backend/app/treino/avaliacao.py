"""Avaliação: as 3 métricas, o `summary` e o `check_overfitting` do notebook (células 16, 24-29)."""

from __future__ import annotations

from typing import Any

import numpy as np
import pandas as pd
from sklearn.metrics import (
    accuracy_score,
    classification_report,
    confusion_matrix,
    f1_score,
    recall_score,
)

from app.dominio.regras import to_risk_flag

LIMIAR_OVERFITTING = 0.10  # 10 pontos percentuais, célula 27


def _rotulos(classes: tuple[str, ...] | list[str] | np.ndarray, y_codificado: Any) -> list[str]:
    return [str(classes[int(i)]) for i in y_codificado]


def avaliar(pipeline: Any, X_test: pd.DataFrame, y_test: Any, classes: Any) -> dict[str, float]:
    """Acurácia, F1-macro e recall das classes de risco — célula 16, literalmente."""
    preds = pipeline.predict(X_test)
    return {
        "acuracia": float(accuracy_score(y_test, preds)),
        "f1_macro": float(f1_score(y_test, preds, average="macro")),
        "recall_risco": float(
            recall_score(
                to_risk_flag(_rotulos(classes, y_test)),
                to_risk_flag(_rotulos(classes, preds)),
                zero_division=0,
            )
        ),
    }


def checar_overfitting(
    pipeline: Any, X_train: pd.DataFrame, y_train: Any, X_test: pd.DataFrame, y_test: Any
) -> dict[str, float | bool]:
    """Diferença treino/teste de acurácia e F1-macro; alerta acima de 10 pontos (célula 27)."""
    preds_treino = pipeline.predict(X_train)
    preds_teste = pipeline.predict(X_test)
    acc_treino = float(accuracy_score(y_train, preds_treino))
    acc_teste = float(accuracy_score(y_test, preds_teste))
    f1_treino = float(f1_score(y_train, preds_treino, average="macro"))
    f1_teste = float(f1_score(y_test, preds_teste, average="macro"))
    return {
        "acuracia_treino": acc_treino,
        "acuracia_teste": acc_teste,
        "diff_acuracia": acc_treino - acc_teste,
        "f1_treino": f1_treino,
        "f1_teste": f1_teste,
        "diff_f1": f1_treino - f1_teste,
        "alerta": (acc_treino - acc_teste) > LIMIAR_OVERFITTING,
    }


def comparar(resultados: list[dict[str, Any]]) -> pd.DataFrame:
    """O `summary` da célula 25: ordenado por recall de risco e, no empate, por acurácia."""
    quadro = pd.DataFrame(
        [
            {
                "modelo": r["nome"],
                "binning": r["binning"],
                "acuracia": r["metricas"]["acuracia"],
                "f1_macro": r["metricas"]["f1_macro"],
                "recall_risco": r["metricas"]["recall_risco"],
                "diff_acuracia": r["overfitting"]["diff_acuracia"],
            }
            for r in resultados
        ]
    )
    return quadro.sort_values(by=["recall_risco", "acuracia"], ascending=False).reset_index(
        drop=True
    )


def escolher(resultados: list[dict[str, Any]]) -> dict[str, Any]:
    """Critério do projeto: maior recall de risco; empate por acurácia; depois pelo MENOR gap."""
    return max(
        resultados,
        key=lambda r: (
            round(r["metricas"]["recall_risco"], 6),
            round(r["metricas"]["acuracia"], 6),
            -round(float(r["overfitting"]["diff_acuracia"]), 6),
        ),
    )


def relatorio_por_classe(
    pipeline: Any, X_test: pd.DataFrame, y_test: Any, classes: Any
) -> dict[str, Any]:
    """`classification_report(output_dict=True)` com os nomes das classes."""
    preds = pipeline.predict(X_test)
    return dict(
        classification_report(
            y_test, preds, target_names=[str(c) for c in classes], output_dict=True, zero_division=0
        )
    )


def matriz_confusao(
    pipeline: Any, X_test: pd.DataFrame, y_test: Any, classes: Any
) -> dict[str, Any]:
    """Matriz de confusão na ordem alfabética do encoder (a mesma do vetor de predict_proba)."""
    preds = pipeline.predict(X_test)
    matriz = confusion_matrix(y_test, preds, labels=list(range(len(classes))))
    return {"classes": [str(c) for c in classes], "matriz": matriz.tolist()}
