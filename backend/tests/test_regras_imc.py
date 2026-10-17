"""Regras: faixas de IMC (fronteiras), ordens das classes, risco acumulado e domínios."""

from __future__ import annotations

from pathlib import Path
from types import SimpleNamespace

import pandas as pd
import pytest

from app.dominio import regras as r
from app.dominio.features import preparar_base

CSV = Path(__file__).resolve().parents[2] / "data" / "bruto" / "obesity.csv"


@pytest.mark.parametrize(
    ("imc", "faixa"),
    [
        (18.49, "Abaixo do Peso"),
        (18.5, "Peso Ideal"),
        (24.99, "Peso Ideal"),
        (24.999, "Peso Ideal"),
        (25.0, "Sobrepeso"),
        (29.99, "Sobrepeso"),
        (30.0, "Obesidade Grau I"),
        (34.99, "Obesidade Grau I"),
        (35.0, "Obesidade Grau II"),
        (39.99, "Obesidade Grau II"),
        (40.0, "Obesidade Grau III"),
    ],
)
def test_classificar_imc(imc: float, faixa: str) -> None:
    assert r.classificar_imc(imc) == faixa


def test_calcular_imc_arredonda_a_duas_casas() -> None:
    assert r.calcular_imc(70.0, 1.70) == 24.22
    assert r.calcular_imc(72.25, 1.70) == 25.0
    assert r.classificar_imc(r.calcular_imc(72.25, 1.70)) == "Sobrepeso"


def test_calcular_imc_recusa_altura_invalida() -> None:
    with pytest.raises(ValueError):
        r.calcular_imc(70.0, 0.0)


def test_as_duas_ordens_sao_permutacoes_das_mesmas_7_classes() -> None:
    assert len(r.ORDEM_ALFABETICA) == len(r.ORDEM_CLINICA) == 7
    assert set(r.ORDEM_ALFABETICA) == set(r.ORDEM_CLINICA)
    assert r.ORDEM_ALFABETICA == tuple(sorted(r.ORDEM_CLINICA))
    assert r.ORDEM_CLINICA[:2] == ("Abaixo do Peso", "Peso Normal")
    assert r.CLASSES_RISCO == r.ORDEM_CLINICA[2:]
    assert set(r.CLASSES_SEGURAS) | set(r.CLASSES_RISCO) == set(r.ORDEM_CLINICA)
    assert [c.value for c in r.ClasseModelo] == list(r.ORDEM_CLINICA)


def test_risco_acumulado_soma_so_as_classes_de_risco() -> None:
    uniforme = {c: 1 / 7 for c in r.ORDEM_CLINICA}
    assert r.calcular_risco_acumulado(uniforme) == pytest.approx(5 / 7)
    objetos = [SimpleNamespace(classe=c, probabilidade=p) for c, p in uniforme.items()]
    assert r.calcular_risco_acumulado(objetos) == pytest.approx(5 / 7)
    pares = list(uniforme.items())
    assert r.calcular_risco_acumulado(pares) == pytest.approx(5 / 7)
    assert r.calcular_risco_acumulado({"Peso Normal": 1.0}) == 0.0
    assert r.calcular_risco_acumulado({"Obesidade III": 1.0000001}) == 1.0


def test_to_risk_flag() -> None:
    assert r.to_risk_flag(
        ["Peso Normal", "Obesidade I", "Abaixo do Peso", "Sobrepeso I"]
    ).tolist() == [0, 1, 0, 1]


def test_mapa_classe_faixa_cobre_as_7_classes() -> None:
    assert set(r.MAPA_CLASSE_FAIXA) == set(r.ClasseModelo)
    assert r.MAPA_CLASSE_FAIXA[r.ClasseModelo.PESO_NORMAL] == r.FaixaImc.PESO_IDEAL
    assert len(r.FaixaImc) == 6


@pytest.fixture(scope="module")
def base() -> pd.DataFrame:
    return preparar_base(pd.read_csv(CSV))


def test_dominios_batem_com_a_base_publica(base: pd.DataFrame) -> None:
    """DOMINIOS é literal; a base pública (o mesmo dado do snapshot) é a referência."""
    assert len(r.DOMINIOS) == 13
    for col, dominio in r.DOMINIOS.items():
        assert sorted(base[col].unique().tolist()) == dominio, col


def test_rotulos_escala_cobrem_os_dominios() -> None:
    for col, rotulos in r.ROTULOS_ESCALA.items():
        assert sorted(rotulos) == r.DOMINIOS[col], col


def test_faixas_de_treino_batem_com_a_base(base: pd.DataFrame) -> None:
    for col, (minimo, maximo) in r.FAIXAS_TREINO.items():
        assert float(base[col].min()) == minimo, col
        assert float(base[col].max()) == maximo, col
