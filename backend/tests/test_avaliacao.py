"""Avaliação: as 3 métricas, o critério de escolha e o alerta de overfitting."""

from __future__ import annotations

import numpy as np
import pandas as pd

from app.dominio.regras import ORDEM_ALFABETICA
from app.treino import avaliacao


def _codificar(rotulos: pd.Series) -> np.ndarray:
    return np.array([ORDEM_ALFABETICA.index(r) for r in rotulos])


def test_avaliar_sobre_o_artefato_real(artefato, base_referencia: pd.DataFrame) -> None:
    X = base_referencia[artefato.colunas]
    y = _codificar(base_referencia["Nivel_Obesidade"])
    metricas = avaliacao.avaliar(artefato.pipeline, X, y, artefato.classes)
    assert set(metricas) == {"acuracia", "f1_macro", "recall_risco"}
    assert all(0.0 <= v <= 1.0 for v in metricas.values())
    assert metricas["acuracia"] > 0.9  # a amostra tem linhas vistas no treino


def test_checar_overfitting_e_relatorios(artefato, base_referencia: pd.DataFrame) -> None:
    X = base_referencia[artefato.colunas]
    y = _codificar(base_referencia["Nivel_Obesidade"])
    over = avaliacao.checar_overfitting(artefato.pipeline, X, y, X.head(50), y[:50])
    assert set(over) >= {"acuracia_treino", "acuracia_teste", "diff_acuracia", "alerta"}
    assert isinstance(over["alerta"], bool)
    relatorio = avaliacao.relatorio_por_classe(artefato.pipeline, X, y, artefato.classes)
    assert set(ORDEM_ALFABETICA) <= set(relatorio)
    matriz = avaliacao.matriz_confusao(artefato.pipeline, X, y, artefato.classes)
    assert matriz["classes"] == list(ORDEM_ALFABETICA)
    assert len(matriz["matriz"]) == 7 and sum(map(sum, matriz["matriz"])) == len(X)


def _resultado(nome: str, recall: float, acc: float, gap: float) -> dict:
    return {
        "nome": nome,
        "binning": False,
        "metricas": {"acuracia": acc, "f1_macro": acc, "recall_risco": recall},
        "overfitting": {"diff_acuracia": gap},
    }


def test_escolher_segue_o_criterio_do_projeto() -> None:
    resultados = [
        _resultado("a", 0.99, 0.95, 0.02),
        _resultado("b", 0.99, 0.95, 0.01),  # mesmo recall e acurácia: menor gap vence
        _resultado("c", 0.98, 0.99, 0.00),  # acurácia maior não compensa recall menor
    ]
    assert avaliacao.escolher(resultados)["nome"] == "b"
    assert (
        avaliacao.escolher([_resultado("x", 0.9, 0.9, 0.0), _resultado("y", 0.9, 0.95, 0.5)])[
            "nome"
        ]
        == "y"
    )


def test_comparar_ordena_por_recall_e_acuracia() -> None:
    quadro = avaliacao.comparar([_resultado("a", 0.9, 0.9, 0.0), _resultado("b", 0.95, 0.8, 0.0)])
    assert quadro["modelo"].tolist() == ["b", "a"]
    assert list(quadro.columns) == [
        "modelo",
        "binning",
        "acuracia",
        "f1_macro",
        "recall_risco",
        "diff_acuracia",
    ]
