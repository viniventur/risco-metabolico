"""Perfil de distribuição (§6.8.4): 16 features, decis abertos nas pontas, faixa NULL, carga."""

from __future__ import annotations

import json
from pathlib import Path

import pandas as pd
import pytest

from app.dominio.features import COLUNAS, COLUNAS_NUMERICAS, preparar_base
from app.dominio.regras import DOMINIOS
from app.treino import distribuicao

RAIZ = Path(__file__).resolve().parents[2]


@pytest.fixture(scope="module")
def perfil() -> dict:
    base = preparar_base(pd.read_csv(RAIZ / "data" / "bruto" / "obesity.csv"))
    return distribuicao.perfil(
        base, versao_modelo="t", versao_dados="000000000000", sha256_snapshot="x" * 64
    )


def test_perfil_cobre_as_16_features_na_ordem(perfil: dict) -> None:
    assert [f["feature"] for f in perfil["features"]] == COLUNAS
    assert perfil["n_treino"] == 2111
    for f in perfil["features"]:
        assert sum(x["n_treino"] for x in f["faixas"]) == 2111
        assert sum(x["proporcao_treino"] for x in f["faixas"]) == pytest.approx(1.0, abs=1e-9)


def test_numericas_tem_decis_abertos_nas_pontas(perfil: dict) -> None:
    for f in perfil["features"]:
        if f["feature"] in COLUNAS_NUMERICAS:
            assert (
                f["tipo"] == "numerica"
                and f["media"] is not None
                and f["minimo"] <= f["p50"] <= f["maximo"]
            )
            faixas = f["faixas"]
            assert 2 <= len(faixas) <= 10
            assert faixas[0]["limite_inf"] is None and faixas[-1]["limite_sup"] is None
            for a, b in zip(faixas, faixas[1:], strict=False):
                assert a["limite_sup"] == b["limite_inf"]


def test_categoricas_tem_os_niveis_do_dominio_mais_a_faixa_nula(perfil: dict) -> None:
    for f in perfil["features"]:
        if f["feature"] not in COLUNAS_NUMERICAS:
            rotulos = [x["faixa_rotulo"] for x in f["faixas"]]
            assert rotulos == [str(v) for v in DOMINIOS[f["feature"]]] + [None]
            assert f["faixas"][-1]["n_treino"] == 0


def test_escrever_recusa_nan(tmp_path: Path, perfil: dict) -> None:
    distribuicao.escrever(tmp_path / "ok.json", perfil)
    assert json.loads((tmp_path / "ok.json").read_text(encoding="utf-8"))["n_treino"] == 2111
    with pytest.raises(ValueError):
        distribuicao.escrever(tmp_path / "nan.json", {"x": float("nan")})


def test_artefato_publicado_bate_com_o_manifest(manifest: dict) -> None:
    caminho = RAIZ / "artifacts" / "distribuicao_treino.json"
    doc = json.loads(caminho.read_text(encoding="utf-8"))
    assert doc["versao_dados"] == manifest["dataset"]["versao_dados"]
    assert doc["versao_modelo"] == manifest["versao"]
    assert len(doc["features"]) == 16


@pytest.mark.banco
def test_carregar_e_idempotente_e_abre_as_pontas(dsn: str) -> None:
    import psycopg

    a = distribuicao.carregar(dsn)
    b = distribuicao.carregar(dsn)
    assert a == b and a[0] == 16 and a[1] == 3
    with psycopg.connect(dsn) as con:
        (n_faixas,) = con.execute(
            "SELECT count(*) FROM operacao.distribuicao_treino_faixa"
        ).fetchone()
        assert n_faixas == a[2]
        (inf, sup) = con.execute(
            "SELECT min(limite_inf), max(limite_sup) FROM operacao.distribuicao_treino_faixa "
            "WHERE feature = 'Idade'"
        ).fetchone()
        assert inf == float("-inf") and sup == float("inf")
