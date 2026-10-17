"""Ordem e completude das colunas (§10.3): a largura vem do manifest, nunca de um literal."""

from __future__ import annotations

import pytest

from app.dominio.features import COLUNAS
from app.dominio.predicao import montar_linha
from app.nucleo.erros import ForaDoDominio
from tests.conftest import ENTRADA_PADRAO


def test_dataframe_de_entrada_respeita_ordem_do_artefato(artefato, manifest: dict) -> None:
    linha = montar_linha(artefato.colunas, ENTRADA_PADRAO)
    assert list(linha.columns) == artefato.colunas == COLUNAS
    assert linha.shape == (1, 16)
    # A largura do modelo é a do manifest, seja ela qual for na variante escolhida.
    assert artefato.transformar(linha).shape[1] == manifest["n_features_modelo"]


def test_dtypes_da_linha_sao_os_do_treino(artefato) -> None:
    linha = montar_linha(artefato.colunas, ENTRADA_PADRAO)
    assert str(linha["Idade"].dtype) == "float64"
    assert str(linha["Consumo_Vegetais"].dtype) == "int64"
    assert str(linha["Genero"].dtype) == "object"


def test_ordem_das_chaves_do_json_nao_importa(artefato) -> None:
    invertido = dict(reversed(list(ENTRADA_PADRAO.items())))
    a = montar_linha(artefato.colunas, ENTRADA_PADRAO)
    b = montar_linha(artefato.colunas, invertido)
    assert list(a.columns) == list(b.columns)
    assert a.equals(b)


def test_campo_ausente_e_recusado_nomeando_o_campo(artefato) -> None:
    sem_peso = {k: v for k, v in ENTRADA_PADRAO.items() if k != "Peso"}
    with pytest.raises(ForaDoDominio) as erro:
        montar_linha(artefato.colunas, sem_peso)
    assert erro.value.detalhes == [{"campo": "Peso"}]


def test_feature_names_in_do_artefato_sao_as_16_colunas(artefato) -> None:
    assert list(artefato.pipeline.feature_names_in_) == COLUNAS
    assert artefato.pipeline.steps[-1][0] == "model"
    assert "sampler" in artefato.pipeline.named_steps
    assert "columns" in artefato.pipeline.named_steps
