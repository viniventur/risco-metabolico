"""Paridade treino ↔ serviço: o teste mais importante (§10.2).

Existe por causa da divergência 3 do legado: o treino usava inteiros crus e o serviço mandava
strings de binning, com o encoder devolvendo zeros em silêncio.
"""

from __future__ import annotations

import numpy as np
import pandas as pd

from app.dominio.features import engineer_features
from app.dominio.predicao import montar_linha


def test_paridade_treino_servico(artefato, base_referencia: pd.DataFrame, manifest: dict) -> None:
    """As features vistas pelo modelo no treino são idênticas às vistas em serviço."""
    colunas = base_referencia[artefato.colunas]  # 16 colunas, sem o alvo
    binning = bool(manifest["binning_ativo"])

    # O MESMO pipeline ajustado dos dois lados, pelos passos ANTES do sampler (imc, columns).
    do_treino = artefato.transformar(
        engineer_features(colunas, binning=False) if not binning else colunas
    )

    do_servico = np.vstack(
        [
            artefato.transformar(montar_linha(artefato.colunas, linha.to_dict()))
            for _, linha in colunas.iterrows()
        ]
    )

    assert do_treino.shape == do_servico.shape
    assert do_treino.shape[1] == manifest["n_features_modelo"]
    np.testing.assert_allclose(do_treino, do_servico, rtol=0, atol=0)
    # O bug do legado era uma coluna morta em SERVIÇO que estava viva no TREINO. Comparar as duas
    # contagens pega isso; exigir "nenhuma coluna zerada" daria falso positivo em categoria rara.
    assert (do_treino.sum(axis=0) == 0).sum() == (do_servico.sum(axis=0) == 0).sum()


def test_nenhuma_coluna_one_hot_morta_na_amostra_completa(
    artefato, base_referencia: pd.DataFrame
) -> None:
    """Com toda categoria presente na amostra, nenhuma coluna one-hot pode ficar zerada."""
    matriz = artefato.transformar(base_referencia[artefato.colunas])
    nomes = list(artefato.pipeline.named_steps["columns"].get_feature_names_out())
    zeradas = [n for n, z in zip(nomes, matriz.sum(axis=0) == 0, strict=True) if z]
    assert zeradas == []


def test_predict_proba_igual_por_linha_e_em_lote(artefato, base_referencia: pd.DataFrame) -> None:
    colunas = base_referencia[artefato.colunas].head(40)
    em_lote = artefato.predict_proba(colunas)
    por_linha = np.vstack(
        [
            artefato.predict_proba(montar_linha(artefato.colunas, linha.to_dict()))
            for _, linha in colunas.iterrows()
        ]
    )
    np.testing.assert_allclose(em_lote, por_linha, rtol=0, atol=1e-6)
