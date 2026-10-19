"""Paridade treino ↔ serviço da vertente diabetes: a mesma matriz dos dois lados (§10.2).

Do lado do treino, a base preparada (`preparar_base`, a mesma preparação do snapshot e do
notebook); do lado do serviço, o JSON de cada linha passando por `montar_quadro`, o caminho da API.
A amostra é completada com toda categoria de cada entrada de domínio fechado.
"""

from __future__ import annotations

from functools import lru_cache

import numpy as np
import pandas as pd
import pytest

from app.diabetes.dominio.features import DTYPES_SNAPSHOT, ENTRADAS, preparar_base
from app.diabetes.dominio.predicao import montar_quadro
from app.diabetes.dominio.regras import DOMINIOS
from app.nucleo.erros import ForaDoDominio
from tests.diabetes.conftest import ENTRADA_PADRAO_DIABETES, RAIZ

CSV = RAIZ / "data" / "bruto" / "diabetes" / "cdc_diabetes_health_indicators.csv"


@lru_cache(maxsize=1)
def _amostra() -> pd.DataFrame:
    base = preparar_base(pd.read_csv(CSV))[ENTRADAS]
    indices = set(base.sample(n=300, random_state=42).index)
    for coluna in [c for c in ENTRADAS if c in DOMINIOS]:
        indices |= set(base.groupby(coluna).head(2).index)
    amostra = base.loc[sorted(indices)].reset_index(drop=True)
    for coluna in [c for c in ENTRADAS if c in DOMINIOS]:
        assert set(base[coluna].unique()) <= set(amostra[coluna].unique()), coluna
    return amostra


def _registros(quadro: pd.DataFrame) -> list[dict]:
    """Como o JSON chega: tipos nativos do Python, sem os dtypes do pandas."""
    return [
        {c: (v.item() if hasattr(v, "item") else v) for c, v in linha.items()}
        for linha in quadro.to_dict(orient="records")
    ]


def test_paridade_treino_servico(artefato_diabetes, manifest_diabetes: dict) -> None:
    amostra = _amostra()
    do_treino = artefato_diabetes.transformar(amostra)
    do_servico = np.vstack(
        [artefato_diabetes.transformar(montar_quadro([r])) for r in _registros(amostra)]
    )
    assert (
        do_treino.shape
        == do_servico.shape
        == (len(amostra), manifest_diabetes["n_features_modelo"])
    )
    np.testing.assert_array_equal(do_treino, do_servico)
    # Nenhuma coluna morta em serviço que estava viva no treino (o bug do legado da obesidade).
    assert (do_treino.std(axis=0) == 0).sum() == (do_servico.std(axis=0) == 0).sum() == 0


def test_predict_proba_igual_por_linha_e_em_lote(artefato_diabetes) -> None:
    amostra = _amostra().head(40)
    em_lote = artefato_diabetes.probabilidades(montar_quadro(_registros(amostra)))
    por_linha = np.concatenate(
        [artefato_diabetes.probabilidades(montar_quadro([r])) for r in _registros(amostra)]
    )
    np.testing.assert_allclose(em_lote, por_linha, rtol=0, atol=1e-6)


def test_quadro_de_servico_tem_a_ordem_e_os_dtypes_do_treino(artefato_diabetes) -> None:
    quadro = montar_quadro([dict(reversed(list(ENTRADA_PADRAO_DIABETES.items())))])
    assert list(quadro.columns) == ENTRADAS == artefato_diabetes.colunas
    assert quadro.dtypes.astype(str).to_dict() == {c: DTYPES_SNAPSHOT[c] for c in ENTRADAS}
    assert list(artefato_diabetes.pipeline.feature_names_in_) == ENTRADAS
    assert [nome for nome, _ in artefato_diabetes.pipeline.steps] == ["imc", "colunas", "modelo"]


def test_campo_ausente_e_tipo_errado_sao_recusados_nomeando() -> None:
    sem_imc = {k: v for k, v in ENTRADA_PADRAO_DIABETES.items() if k != "IMC"}
    with pytest.raises(ForaDoDominio) as erro:
        montar_quadro([sem_imc])
    assert erro.value.detalhes == [{"campo": "IMC"}]
    with pytest.raises(ForaDoDominio, match="tipo de valor"):
        montar_quadro([ENTRADA_PADRAO_DIABETES | {"Faixa_Etaria": "sessenta"}])
