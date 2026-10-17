"""Snapshot congelado: ORDER BY, determinismo dos dois sha256, versao_dados e o pin do pyarrow."""

from __future__ import annotations

import hashlib
import json
from pathlib import Path

import pandas as pd
import pyarrow
import pytest

from app.dominio.features import DTYPES_SNAPSHOT, preparar_base
from app.treino import dados

RAIZ = Path(__file__).resolve().parents[2]
MANIFEST = RAIZ / "artifacts" / "manifest.json"
CSV = RAIZ / "data" / "bruto" / "obesity.csv"


def _manifest() -> dict:
    if not MANIFEST.exists():
        pytest.skip("artifacts/manifest.json ainda não existe (rode `congelar`)")
    return json.loads(MANIFEST.read_text(encoding="utf-8"))


def test_consulta_do_snapshot_ordena_pela_chave_total() -> None:
    assert "ORDER BY linha_origem" in dados.CONSULTA_SNAPSHOT
    assert dados.CONSULTA_SNAPSHOT.count("SELECT") == 1
    assert len(dados.COLUNAS_SQL) == 17


def test_escrever_parquet_e_deterministico(tmp_path: Path) -> None:
    quadro = preparar_base(pd.read_csv(CSV)).head(200).astype(DTYPES_SNAPSHOT)
    a = dados.escrever_parquet(quadro, tmp_path / "a.parquet")
    b = dados.escrever_parquet(quadro, tmp_path / "b.parquet")
    assert a == b
    assert len(a[0]) == 64 and len(a[1]) == 64
    assert a[0] == hashlib.sha256((tmp_path / "a.parquet").read_bytes()).hexdigest()
    # Mesmo conteúdo em outra ORDEM de linhas: arquivo e conteúdo mudam — é isso que o
    # ORDER BY evita.
    c = dados.escrever_parquet(quadro.iloc[::-1].reset_index(drop=True), tmp_path / "c.parquet")
    assert c[0] != a[0] and c[1] != a[1]


def test_perfil_numerico_cobre_as_oito_colunas() -> None:
    quadro = preparar_base(pd.read_csv(CSV)).astype(DTYPES_SNAPSHOT)
    perfil = dados.perfil_numerico(quadro)
    assert set(perfil) == {"Idade", "Altura", "Peso", *dados.COLUNAS_ESCALAS}
    assert (
        perfil["Idade"]["n"] == 2111
        and perfil["Idade"]["p01"] <= perfil["Idade"]["p50"] <= perfil["Idade"]["p99"]
    )


def test_pyarrow_pinado_bate_com_o_manifest() -> None:
    m = _manifest()
    assert m["dataset"]["pyarrow"] == pyarrow.__version__, (
        "subir o pyarrow muda versao_dados: regenere o snapshot e o manifest de propósito"
    )


def test_versao_dados_e_o_prefixo_do_sha256_do_arquivo() -> None:
    m = _manifest()
    assert len(m["dataset"]["versao_dados"]) == 12
    assert m["dataset"]["sha256_snapshot"].startswith(m["dataset"]["versao_dados"])
    assert (
        m["dataset"]["snapshot"]
        == f"data/processado/snapshot-{m['dataset']['versao_dados']}.parquet"
    )


def test_snapshot_no_disco_bate_com_o_manifest() -> None:
    m = _manifest()
    caminho = RAIZ / m["dataset"]["snapshot"]
    if not caminho.exists():
        pytest.skip("snapshot não está no disco (é regenerável: python -m app.treino congelar)")
    quadro = dados.carregar_snapshot(caminho, sha256_esperado=m["dataset"]["sha256_snapshot"])
    assert quadro.shape == (m["dataset"]["linhas"], m["dataset"]["colunas"]) == (2111, 17)
    assert quadro.dtypes.astype(str).to_dict() == DTYPES_SNAPSHOT


def test_manifest_nao_tem_metrica_escrita_a_mao() -> None:
    m = _manifest()
    if m["versao"] is None:
        pytest.skip("modelo ainda não treinado")
    for chave in ("acuracia", "f1_macro", "recall_risco"):
        assert isinstance(m["metricas_teste"][chave], float)
    assert isinstance(m["n_features_modelo"], int)
    assert len(m["sha256"]) == 64 and len(m["sha256_predicoes_ouro"]) == 64


@pytest.mark.banco
def test_congelar_duas_vezes_da_o_mesmo_versao_dados(dsn: str, tmp_path: Path) -> None:
    """Determinismo: a segunda execução produz o mesmo sha256_conteudo e NÃO cria linha nova."""
    import psycopg

    def congelar(pasta: Path) -> dados.InfoSnapshot:
        with psycopg.connect(dsn) as con:
            con.isolation_level = psycopg.IsolationLevel.REPEATABLE_READ
            info = dados.gerar_snapshot(con, pasta)
            con.commit()
        return info

    a = congelar(tmp_path / "a")
    b = congelar(tmp_path / "b")
    assert a.versao_dados == b.versao_dados
    assert a.sha256_conteudo == b.sha256_conteudo
    with psycopg.connect(dsn) as con:
        (n,) = con.execute(
            "SELECT count(*) FROM operacao.snapshot_treino WHERE sha256_arquivo = %s",
            (a.sha256_arquivo,),
        ).fetchone()
        (linhas,) = con.execute(
            "SELECT linhas FROM operacao.snapshot_treino WHERE sha256_arquivo = %s",
            (a.sha256_arquivo,),
        ).fetchone()
    assert n == 1 and linhas == 2111
