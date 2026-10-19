"""Preparação da base da vertente diabetes: nomes, tipos, domínios e o dicionário contra o CSV."""

from __future__ import annotations

import re
from functools import lru_cache
from pathlib import Path

import numpy as np
import pandas as pd
import pytest

from app.diabetes.dominio import features, regras
from app.dominio.features import COLUNAS_COM_ALVO as COLUNAS_DA_OBESIDADE

RAIZ = Path(__file__).resolve().parents[3]
CSV = RAIZ / "data" / "bruto" / "diabetes" / "cdc_diabetes_health_indicators.csv"
DICIONARIO = RAIZ / "docs" / "dicionario-de-dados-diabetes.md"
N_LINHAS = 253_680


@lru_cache(maxsize=1)
def _bruto() -> pd.DataFrame:
    return pd.read_csv(CSV)


@pytest.fixture(scope="module")
def base() -> pd.DataFrame:
    return features.preparar_base(_bruto())


def _texto_do_dicionario() -> str:
    return DICIONARIO.read_text(encoding="utf-8").replace("\r\n", "\n")


def test_csv_tem_o_id_e_as_22_colunas_na_ordem() -> None:
    assert list(_bruto().columns) == [features.COLUNA_ID, *features.COLUNAS_MAP]
    assert len(_bruto()) == N_LINHAS


def test_cada_coluna_tem_uma_familia_so() -> None:
    assert len(features.COLUNAS_COM_ALVO) == 22 and len(features.COLUNAS) == 21
    assert features.COLUNAS_COM_ALVO[0] == features.ALVO
    familias = features.COLUNAS_TEXTO + features.COLUNAS_INTEIRAS + features.COLUNAS_NUMERICAS
    assert sorted(familias) == sorted(features.COLUNAS_COM_ALVO)
    assert list(features.TIPOS_SQL) == features.COLUNAS_COM_ALVO


def test_nenhuma_coluna_coincide_com_as_da_vertente_de_obesidade() -> None:
    """As duas vertentes dividem o log: o mesmo nome com sentidos diferentes misturaria a deriva."""
    diabetes = {c.lower() for c in features.COLUNAS_COM_ALVO}
    assert not diabetes & {c.lower() for c in COLUNAS_DA_OBESIDADE}


def test_id_e_a_posicao_da_linha() -> None:
    assert np.array_equal(_bruto()[features.COLUNA_ID].to_numpy(), np.arange(N_LINHAS))


def test_dtypes_seguem_o_contrato(base: pd.DataFrame) -> None:
    tipos = base[features.COLUNAS_COM_ALVO].dtypes.astype(str).to_dict()
    assert tipos == features.DTYPES_SNAPSHOT


def test_sem_nulo_e_dentro_dos_dominios(base: pd.DataFrame) -> None:
    assert not base[features.COLUNAS_COM_ALVO].isnull().any().any()
    for coluna, dominio in regras.DOMINIOS.items():
        assert set(base[coluna].unique()) <= set(dominio), coluna
    minimo, maximo = regras.FAIXAS_TREINO["IMC"]
    assert (base["IMC"].min(), base["IMC"].max()) == (minimo, maximo)
    assert (base["IMC"] == base["IMC"].round()).all(), "o IMC do arquivo é inteiro"


def test_traducao_preserva_as_contagens(base: pd.DataFrame) -> None:
    bruto = _bruto()
    for csv, modelo in features.COLUNAS_MAP.items():
        if modelo in features.TRADUCOES_VALORES:
            esperado = bruto[csv].map(features.TRADUCOES_VALORES[modelo]).value_counts()
            assert base[modelo].value_counts().to_dict() == esperado.to_dict(), modelo
    assert int((base[features.ALVO] == "Sim").sum()) == int(bruto["Diabetes_binary"].sum())


def test_codigo_fora_do_dominio_vira_nulo_sem_sumir() -> None:
    estranho = _bruto().head(3).copy()
    estranho.loc[0, "HighBP"] = 2
    preparado = features.preparar_base(estranho)
    assert int(preparado["Pressao_Alta"].isnull().sum()) == 1
    assert len(preparado) == 3


def test_arredondar_imc_empata_no_par_como_a_limpeza_da_origem(base: pd.DataFrame) -> None:
    entrada = pd.DataFrame({"IMC": [26.5, 27.5, 26.49, 26.51, 30.0], "Sexo": ["Feminino"] * 5})
    saida = features.arredondar_imc(entrada)
    assert saida["IMC"].tolist() == [26.0, 28.0, 26.0, 27.0, 30.0]
    assert str(saida["IMC"].dtype) == "float64"
    assert saida["Sexo"].tolist() == entrada["Sexo"].tolist() and entrada["IMC"].iloc[0] == 26.5
    # Na base o passo é neutro: o IMC do arquivo já é inteiro.
    pd.testing.assert_frame_equal(features.arredondar_imc(base.head(1000)), base.head(1000))


def test_rotulos_cobrem_as_escalas() -> None:
    for coluna, rotulos in regras.ROTULOS_ESCALA.items():
        assert sorted(rotulos) == regras.DOMINIOS[coluna], coluna


# ---- o dicionário contra o CSV: nenhuma contagem nem rótulo escrito à mão ----


def _contagens_das_categoricas() -> dict[str, dict[str, int]]:
    """A tabela 'Domínios e contagens': {coluna: {valor: n}}."""
    contagens: dict[str, dict[str, int]] = {}
    for coluna, celula in re.findall(r"^\| `(\w+)` \| ([^|]+?) \|$", _texto_do_dicionario(), re.M):
        pares = re.findall(r"(\S+) ([\d.]+)", celula)
        contagens[coluna] = {valor: int(n.replace(".", "")) for valor, n in pares}
    return contagens


def _tabelas_das_escalas() -> dict[str, list[tuple[int, str, int]]]:
    """As tabelas `#### `Coluna``: {coluna: [(valor, rótulo, n)]}."""
    tabelas: dict[str, list[tuple[int, str, int]]] = {}
    for coluna, corpo in re.findall(
        r"^#### `(\w+)`\n\n(.*?)(?:\n\n|\Z)", _texto_do_dicionario(), re.M | re.S
    ):
        linhas = re.findall(r"^\| (\d+) \| ([^|]+?) \| ([\d.]+) \|$", corpo, re.M)
        tabelas[coluna] = [(int(v), r, int(n.replace(".", ""))) for v, r, n in linhas]
    return tabelas


def test_contagens_das_categoricas_no_dicionario_batem_com_o_csv(base: pd.DataFrame) -> None:
    contagens = _contagens_das_categoricas()
    assert set(contagens) == set(features.COLUNAS_TEXTO)
    for coluna, por_valor in contagens.items():
        assert list(por_valor) == regras.DOMINIOS[coluna], coluna
        assert por_valor == base[coluna].value_counts().to_dict(), coluna
        assert sum(por_valor.values()) == N_LINHAS


def test_escalas_do_dicionario_batem_com_o_csv_e_com_os_rotulos(base: pd.DataFrame) -> None:
    tabelas = _tabelas_das_escalas()
    assert set(tabelas) == set(regras.ROTULOS_ESCALA)
    for coluna, linhas in tabelas.items():
        assert {v: r for v, r, _ in linhas} == regras.ROTULOS_ESCALA[coluna], coluna
        contagens = base[coluna].value_counts().to_dict()
        assert {v: n for v, _, n in linhas} == {int(k): int(n) for k, n in contagens.items()}
