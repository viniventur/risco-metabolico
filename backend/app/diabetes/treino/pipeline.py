"""Pipeline de treino da vertente diabetes: a configuração que o notebook 02 congelou (célula 38).

Espelha `preprocessador` e `montar` da célula 15 (ramo das árvores, `linear=False`, sem SMOTE) e a
fábrica `xgb` com os ajustes do escolhido. Os passos têm os nomes do notebook,
`['imc', 'colunas', 'modelo']`: `imc` arredonda o IMC ao inteiro como a limpeza da origem
(`arredondar_imc`, importável), `colunas` é o `ColumnTransformer` — Sim/Não e sexo em 0/1 por
`OrdinalEncoder` com o domínio explícito e `handle_unknown='error'`, faixa etária, IMC e
escolaridade como número — e `modelo` o XGBoost. Sem tratamento de desbalanceamento e sem
calibração: o notebook mediu os dois e nenhum reduziu o Brier fora da dobra.
"""

from __future__ import annotations

from typing import Any

import numpy as np
import pandas as pd
from sklearn.compose import ColumnTransformer
from sklearn.model_selection import StratifiedKFold, train_test_split
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import FunctionTransformer, OrdinalEncoder
from xgboost import XGBClassifier

from app.diabetes.dominio.features import ALVO, COLUNAS_SIM_NAO, ENTRADAS, arredondar_imc
from app.diabetes.dominio.regras import DOMINIOS

# 1. As entradas por família, na ORDEM de ENTRADAS: a célula 15 filtra a lista sem reordená-la, e
#    essa é a ordem das colunas que o XGBoost vê. Texto: as seis Sim/Não do simulador e o sexo.
COLUNAS_TEXTO: list[str] = [c for c in ENTRADAS if c in COLUNAS_SIM_NAO or c == "Sexo"]
COLUNAS_NUMERICAS: list[str] = [c for c in ENTRADAS if c not in COLUNAS_TEXTO]

# 2. O split e a validação cruzada congelados (célula 38): o contrato dos números.
TEST_SIZE = 0.2
RANDOM_STATE = 42
N_DOBRAS = 5

# 3. O algoritmo e os hiperparâmetros do escolhido, literalmente (célula 38): a fábrica `xgb` da
#    célula 15 com `max_depth=3, n_estimators=300` por cima.
ALGORITMO = "XGBClassifier"
HIPERPARAMETROS: dict[str, Any] = {
    "n_estimators": 300,
    "learning_rate": 0.05,
    "max_depth": 3,
    "subsample": 0.8,
    "colsample_bytree": 0.8,
    "objective": "binary:logistic",
    "eval_metric": "logloss",
    "tree_method": "hist",
    "random_state": 42,
    "n_jobs": 8,
}
DESBALANCEAMENTO = "nenhum"
CALIBRACAO = "nenhuma"


def montar_preprocessamento() -> ColumnTransformer:
    """O `ColumnTransformer` da célula 15: `categories=` explícito e desconhecido é erro."""
    return ColumnTransformer(
        [
            (
                "texto",
                OrdinalEncoder(
                    categories=[list(DOMINIOS[c]) for c in COLUNAS_TEXTO], handle_unknown="error"
                ),
                COLUNAS_TEXTO,
            ),
            ("numericas", "passthrough", COLUNAS_NUMERICAS),
        ]
    )


def montar_pipeline() -> Pipeline:
    """`['imc', 'colunas', 'modelo']`: um `Pipeline` do sklearn, sem sampler (nenhum SMOTE)."""
    return Pipeline(
        [
            ("imc", FunctionTransformer(arredondar_imc)),
            ("colunas", montar_preprocessamento()),
            ("modelo", XGBClassifier(**HIPERPARAMETROS)),
        ]
    )


def separar(quadro: pd.DataFrame) -> tuple[pd.DataFrame, np.ndarray]:
    """As dez entradas e o alvo 0/1 (`Diabetes == 'Sim'`), como a célula 14."""
    return quadro[ENTRADAS], (quadro[ALVO] == "Sim").astype("int64").to_numpy()


def dividir(
    X: pd.DataFrame, y: np.ndarray
) -> tuple[pd.DataFrame, pd.DataFrame, np.ndarray, np.ndarray]:
    """O split congelado: 80/20 estratificado no alvo, `random_state=42`."""
    X_treino, X_teste, y_treino, y_teste = train_test_split(
        X, y, test_size=TEST_SIZE, random_state=RANDOM_STATE, stratify=y
    )
    return X_treino, X_teste, y_treino, y_teste


def dobras(X_treino: pd.DataFrame, y_treino: np.ndarray) -> list[tuple[np.ndarray, np.ndarray]]:
    """As 5 dobras estratificadas do treino (`shuffle=True`, 42): as mesmas do notebook."""
    divisor = StratifiedKFold(n_splits=N_DOBRAS, shuffle=True, random_state=RANDOM_STATE)
    return list(divisor.split(X_treino, y_treino))


def transformar_ate_colunas(pipeline: Pipeline, X: pd.DataFrame) -> np.ndarray:
    """Aplica `imc` e `colunas` e devolve a matriz que o modelo vê — a base da paridade."""
    return np.asarray(pipeline[:-1].transform(X), dtype="float64")


def largura_do_modelo(pipeline: Pipeline) -> int:
    """Número de colunas que o classificador vê (`get_feature_names_out`), nunca um literal."""
    return int(len(pipeline.named_steps["colunas"].get_feature_names_out()))
