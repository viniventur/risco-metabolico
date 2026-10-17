"""Features: `preparar_base` e `engineer_features` reproduzem as células 5 e 14(a) do notebook."""

from __future__ import annotations

import pandas as pd
import pytest

from app.dominio import features as f

CSV = (
    f.__file__
    and __import__("pathlib").Path(f.__file__).resolve().parents[3]
    / "data"
    / "bruto"
    / "obesity.csv"
)

COLUNAS_CSV = [
    "Gender",
    "Age",
    "Height",
    "Weight",
    "family_history",
    "FAVC",
    "FCVC",
    "NCP",
    "CAEC",
    "SMOKE",
    "CH2O",
    "SCC",
    "FAF",
    "TUE",
    "CALC",
    "MTRANS",
    "Obesity",
]


@pytest.fixture(scope="module")
def base() -> pd.DataFrame:
    return f.preparar_base(pd.read_csv(CSV))


def test_colunas_map_tem_os_17_pares_na_ordem_do_dicionario() -> None:
    assert list(f.COLUNAS_MAP) == COLUNAS_CSV
    assert len(f.COLUNAS) == 16
    assert f.ALVO not in f.COLUNAS
    assert f.COLUNAS_COM_ALVO[-1] == f.ALVO
    assert set(f.COLUNAS) == set(f.COLUNAS_NUMERICAS) | set(f.COLUNAS_ESCALAS) | set(
        f.COLUNAS_CATEGORICAS_TEXTO
    )


def test_preparar_base_shape_dtypes_e_sem_nulos(base: pd.DataFrame) -> None:
    assert base.shape == (2111, 17)
    assert list(base.columns) == f.COLUNAS_COM_ALVO
    assert not base.isnull().any().any()
    for col in f.COLUNAS_ESCALAS:
        assert str(base[col].dtype) == "int64", col
    for col in f.COLUNAS_NUMERICAS:
        assert str(base[col].dtype) == "float64", col
    for col in [*f.COLUNAS_CATEGORICAS_TEXTO, f.ALVO]:
        assert str(base[col].dtype) == "object", col


def test_traducoes_cobrem_todos_os_valores(base: pd.DataFrame) -> None:
    for col in [*f.COLUNAS_CATEGORICAS_TEXTO, f.ALVO]:
        assert set(base[col].unique()) <= set(f.TRADUCOES_VALORES[col].values()), col
    assert f.TRADUCOES_VALORES["Meio_Transporte"]["Automobile"] == "Carro"
    assert f.TRADUCOES_VALORES["Meio_Transporte"]["Motorbike"] == "Moto"


def test_arredondamento_das_escalas_segue_o_dicionario(base: pd.DataFrame) -> None:
    assert sorted(base["Consumo_Vegetais"].unique()) == [1, 2, 3]
    assert sorted(base["Numero_Refeicoes_Principais"].unique()) == [1, 2, 3, 4]
    assert sorted(base["Atividade_Fisica_Frequencia"].unique()) == [0, 1, 2, 3]
    assert sorted(base["Tempo_Dispositivos_Tecnologicos"].unique()) == [0, 1, 2]


def test_preparar_base_nao_altera_a_entrada() -> None:
    bruto = pd.read_csv(CSV)
    f.preparar_base(bruto)
    assert list(bruto.columns) == COLUNAS_CSV
    assert bruto["Gender"].iloc[0] == "Female"


def test_engineer_features_sem_binning_e_identidade(base: pd.DataFrame) -> None:
    entrada = base[f.COLUNAS]
    saida = f.engineer_features(entrada)
    pd.testing.assert_frame_equal(saida, entrada)
    assert saida is not entrada  # `df = df.copy()` como primeira linha
    assert (
        "IMC" not in saida.columns
    )  # nenhum IMC, nenhum fillna (a variante de app.py foi descartada)


def test_engineer_features_com_binning_usa_os_bins_da_celula_14(base: pd.DataFrame) -> None:
    saida = f.engineer_features(base[f.COLUNAS], binning=True)
    esperado = {
        "Consumo_Vegetais": {1: "baixa", 2: "moderada", 3: "alta"},
        "Numero_Refeicoes_Principais": {1: "1-2", 2: "1-2", 3: "3", 4: "4+"},
        "Consumo_Agua_Diario": {1: "<1L", 2: "1-2L", 3: ">2L"},
        "Atividade_Fisica_Frequencia": {0: "nenhuma", 1: "baixa", 2: "media", 3: "alta"},
        "Tempo_Dispositivos_Tecnologicos": {0: "0-2h", 1: "3-5h", 2: ">5h"},
    }
    for col, mapa in esperado.items():
        assert saida[col].tolist() == base[col].map(mapa).tolist(), col
    for col in f.COLUNAS_NUMERICAS + f.COLUNAS_CATEGORICAS_TEXTO:
        pd.testing.assert_series_equal(saida[col], base[col])
    assert "IMC" not in saida.columns
    assert not (saida == "missing").any().any()


def test_tipos_sql_cobrem_as_17_colunas_sem_numeric_nem_real() -> None:
    assert list(f.TIPOS_SQL) == f.COLUNAS_COM_ALVO
    tipos = {t for t, _ in f.TIPOS_SQL.values()}
    assert tipos == {"double precision", "smallint", "text"}
    assert set(f.DTYPES_SNAPSHOT.values()) == {"float64", "int64", "object"}


def test_colunas_do_banco_sao_minusculas_sem_aspas() -> None:
    import re

    for modelo, banco in f.COLUNAS_BANCO.items():
        assert re.fullmatch(r"[a-z][a-z0-9_]*", banco), banco
        assert banco == modelo.lower()
    assert f.COLUNAS_MAP_BANCO["consumo_vegetais"] == "Consumo_Vegetais"
