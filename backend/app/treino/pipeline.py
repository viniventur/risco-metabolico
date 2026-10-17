"""Pipeline de treino: espelha as células 14, 16 e 17-23 do notebook, sem `dill` e sem acidente.

Os passos são nomeados e documentados: `['columns', 'sampler', 'model']` — `columns` é o
`ColumnTransformer`, `sampler` o SMOTE do `imblearn.pipeline.Pipeline` (só atua no `fit`),
`model` o classificador. Com o binning ligado (ADR 0002) entra um `feature_engineering`
importável na frente. Os testes referenciam `named_steps['columns']`, nunca `pipeline[:-1]`.
"""

from __future__ import annotations

from collections.abc import Callable
from typing import Any

import pandas as pd
from imblearn.over_sampling import SMOTE
from imblearn.pipeline import Pipeline as ImbPipeline
from lightgbm import LGBMClassifier
from sklearn.compose import ColumnTransformer
from sklearn.ensemble import RandomForestClassifier
from sklearn.model_selection import train_test_split
from sklearn.preprocessing import FunctionTransformer, LabelEncoder, OneHotEncoder
from xgboost import XGBClassifier

from app.dominio.features import BINS_CELULA_14, adicionar_imc, engineer_features
from app.dominio.regras import DOMINIOS, ORDEM_ALFABETICA

# As 5 escalas ordinais entram aqui POR DECISÃO (ADR 0002), não por dtype: com select_dtypes e o
# binning desligado elas cairiam no ramo numérico e o modelo teria 31 features em vez de 43.
COLUNAS_CATEGORICAS: list[str] = [
    "Genero",
    "Historico_Familiar_Sobrepeso",
    "Consumo_Calorico_Frequente",
    "Consumo_Vegetais",
    "Numero_Refeicoes_Principais",
    "Consumo_Alimentos_Entre_Refeicoes",
    "Fumante",
    "Consumo_Agua_Diario",
    "Monitoramento_Calorias",
    "Atividade_Fisica_Frequencia",
    "Tempo_Dispositivos_Tecnologicos",
    "Consumo_Alcool",
    "Meio_Transporte",
]
COLUNAS_NUMERICAS: list[str] = ["Idade", "Altura", "Peso"]

# O split congelado da célula 14(7): contrato dos números (§5.3).
TEST_SIZE = 0.2
RANDOM_STATE = 42
SMOTE_PARAMS: dict[str, Any] = {"sampling_strategy": "auto", "k_neighbors": 5, "random_state": 42}

# Hiperparâmetros dos 3 candidatos, literalmente (células 18, 21 e 23).
HIPERPARAMETROS: dict[str, dict[str, Any]] = {
    "RandomForestClassifier": {
        "n_estimators": 300,
        "random_state": 42,
        "n_jobs": -1,
        "class_weight": "balanced_subsample",
    },
    "LGBMClassifier": {
        "n_estimators": 39,
        "learning_rate": 0.05,
        "max_depth": -1,
        "subsample": 0.8,
        "colsample_bytree": 0.8,
        "objective": "multiclass",
        "num_class": 7,
        "random_state": 42,
        "n_jobs": 4,
        "verbose": -1,
    },
    "XGBClassifier": {
        "n_estimators": 400,
        "learning_rate": 0.05,
        "max_depth": 5,
        "subsample": 0.8,
        "colsample_bytree": 0.8,
        "objective": "multi:softprob",
        "eval_metric": "mlogloss",
        "random_state": 42,
        "num_class": 7,
        "n_jobs": 4,
    },
}
CANDIDATOS: dict[str, Callable[[], Any]] = {
    "RandomForestClassifier": lambda: RandomForestClassifier(
        **HIPERPARAMETROS["RandomForestClassifier"]
    ),
    "LGBMClassifier": lambda: LGBMClassifier(**HIPERPARAMETROS["LGBMClassifier"]),
    "XGBClassifier": lambda: XGBClassifier(**HIPERPARAMETROS["XGBClassifier"]),
}


def separar_colunas() -> tuple[list[str], list[str]]:
    """(categóricas, numéricas) por LISTA EXPLÍCITA — célula 14(c), nunca `select_dtypes`."""
    return list(COLUNAS_CATEGORICAS), list(COLUNAS_NUMERICAS)


def categorias_do_encoder(*, binning: bool) -> list[list[Any]]:
    """`categories=` explícito: DOMINIOS (inteiros crus) ou os rótulos de faixa da célula 14(a).

    Sem isso uma categoria rara (`Consumo_Alcool='Sempre'`, 1 em 2.111) pode não cair no treino e a
    largura do modelo muda com o split. A ordem é a lexicográfica que o encoder usaria sozinho.
    """
    categorias: list[list[Any]] = []
    for col in COLUNAS_CATEGORICAS:
        if binning and col in BINS_CELULA_14:
            categorias.append(sorted(set(BINS_CELULA_14[col][1])))
        else:
            categorias.append(list(DOMINIOS[col]))
    return categorias


def montar_preprocessamento(*, binning: bool = False, imc: bool = True) -> ColumnTransformer:
    """O `ColumnTransformer` da célula 14(d): `handle_unknown='error'` e `categories=` explícito.

    Com `imc=True` (ADR 0003) a coluna `IMC`, acrescentada pelo passo `imc` do pipeline, entra no
    ramo numérico: 43 + 1 = 44 colunas de modelo. A largura real sai sempre do manifest.
    """
    numericas = [*COLUNAS_NUMERICAS, "IMC"] if imc else list(COLUNAS_NUMERICAS)
    return ColumnTransformer(
        [
            (
                "categorical",
                OneHotEncoder(
                    categories=categorias_do_encoder(binning=binning),
                    handle_unknown="error",
                    sparse_output=False,
                ),
                COLUNAS_CATEGORICAS,
            ),
            ("numeric", "passthrough", numericas),
        ]
    )


def montar_pipeline(
    estimador: Any, *, binning: bool = False, imc: bool = True, smote: bool = True
) -> ImbPipeline:
    """`['columns', 'sampler', 'model']`, precedido de `imc` (ADR 0003) e/ou `feature_engineering`.

    Os passos antes de `columns` são transformadores NOMEADOS e IMPORTÁVEIS
    (`app.dominio.features`): serializáveis com joblib, sem `dill`, sem `__main__`.
    """
    passos: list[tuple[str, Any]] = []
    if binning:
        passos.append(
            (
                "feature_engineering",
                FunctionTransformer(engineer_features, kw_args={"binning": True}),
            )
        )
    if imc:
        passos.append(("imc", FunctionTransformer(adicionar_imc)))
    passos.append(("columns", montar_preprocessamento(binning=binning, imc=imc)))
    if smote:
        passos.append(("sampler", SMOTE(**SMOTE_PARAMS)))
    passos.append(("model", estimador))
    return ImbPipeline(passos)


def codificar_alvo(y: pd.Series) -> tuple[LabelEncoder, Any]:
    """`LabelEncoder` da célula 14(5): ordem alfabética, conferida contra ORDEM_ALFABETICA."""
    label_encoder = LabelEncoder()
    y_encoded = label_encoder.fit_transform(y)
    assert tuple(label_encoder.classes_) == ORDEM_ALFABETICA, (
        "classes fora da ordem alfabética esperada"
    )
    return label_encoder, y_encoded


def dividir(X: pd.DataFrame, y_encoded: Any) -> tuple[pd.DataFrame, pd.DataFrame, Any, Any]:
    """O split congelado: `test_size=0.2, random_state=42, stratify=y_encoded` → 1.688 / 423."""
    return train_test_split(
        X, y_encoded, test_size=TEST_SIZE, random_state=RANDOM_STATE, stratify=y_encoded
    )


def treinar(pipeline: ImbPipeline, X_train: pd.DataFrame, y_train: Any) -> ImbPipeline:
    """`pipe.fit(X_train, y_train)` — célula 16."""
    pipeline.fit(X_train, y_train)
    return pipeline


def largura_do_modelo(pipeline: ImbPipeline) -> int:
    """Número de colunas que o classificador vê (`get_feature_names_out`), nunca um literal."""
    return int(len(pipeline.named_steps["columns"].get_feature_names_out()))


def transformar_ate_colunas(pipeline: ImbPipeline, X: pd.DataFrame) -> Any:
    """Aplica os passos ANTES do `sampler` (imc, feature_engineering, columns) e devolve a matriz.

    É o que os testes de paridade treino/serviço usam — nunca `pipeline[:-1]`, que num
    `ImbPipeline` inclui o SMOTE e não é um transformador de serviço.
    """
    saida: Any = X
    for nome, passo in pipeline.steps:
        if nome == "sampler":
            break
        if nome == "model":
            break
        saida = passo.transform(saida)
    return saida
