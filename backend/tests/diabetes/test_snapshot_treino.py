"""Snapshot da vertente diabetes: ORDER BY, pasta própria, determinismo e o manifest da vertente."""

from __future__ import annotations

import hashlib
import json
from pathlib import Path

import pandas as pd
import pyarrow
import pytest

from app.diabetes.dominio.features import (
    COLUNAS_COM_ALVO,
    COLUNAS_INTEIRAS,
    DTYPES_SNAPSHOT,
    preparar_base,
)
from app.diabetes.treino import dados
from app.diabetes.treino.__main__ import main, manifest_vazio
from app.treino.__main__ import PROCESSADO_PADRAO

RAIZ = Path(__file__).resolve().parents[3]
MANIFEST = RAIZ / "artifacts" / "diabetes" / "manifest.json"
CSV = RAIZ / "data" / "bruto" / "diabetes" / "cdc_diabetes_health_indicators.csv"


def _manifest() -> dict:
    if not MANIFEST.exists():
        pytest.skip("artifacts/diabetes/manifest.json ainda não existe (rode `snapshot`)")
    return json.loads(MANIFEST.read_text(encoding="utf-8"))


def _amostra(n: int = 500) -> pd.DataFrame:
    return preparar_base(pd.read_csv(CSV, nrows=n))[COLUNAS_COM_ALVO]


def test_consulta_le_a_tabela_da_vertente_e_ordena_pela_chave_total() -> None:
    assert "FROM dados.registros_diabetes" in dados.CONSULTA_SNAPSHOT
    assert "ORDER BY linha_origem" in dados.CONSULTA_SNAPSHOT
    assert dados.CONSULTA_SNAPSHOT.count("SELECT") == 1
    assert len(dados.COLUNAS_SQL) == 22


def test_pasta_propria_dentro_de_data_processado() -> None:
    """`app.treino.dados.gerar_snapshot` apaga snapshot-*.parquet da pasta dela, sem recursão."""
    assert dados.PASTA_PADRAO.parent == PROCESSADO_PADRAO
    assert dados.PASTA_PADRAO.name == "diabetes"


def test_escrever_parquet_e_deterministico(tmp_path: Path) -> None:
    quadro = _amostra(300)
    a = dados.escrever_parquet(quadro, tmp_path / "a.parquet")
    b = dados.escrever_parquet(quadro, tmp_path / "b.parquet")
    assert a == b
    assert a[0] == hashlib.sha256((tmp_path / "a.parquet").read_bytes()).hexdigest()
    c = dados.escrever_parquet(quadro.iloc[::-1].reset_index(drop=True), tmp_path / "c.parquet")
    assert c[0] != a[0] and c[1] != a[1]


def test_perfil_numerico_cobre_o_imc_e_as_seis_inteiras() -> None:
    perfil = dados.perfil_numerico(_amostra())
    assert set(perfil) == {"IMC", *COLUNAS_INTEIRAS}
    assert perfil["IMC"]["p01"] <= perfil["IMC"]["p50"] <= perfil["IMC"]["p99"]


def test_resumo_e_separacao_do_alvo() -> None:
    quadro = _amostra()
    resumo = dados.resumo_do_snapshot(quadro)
    assert resumo["linhas"] == 500 and resumo["colunas"] == 22 and resumo["nulos"] == 0
    assert sum(resumo["alvo"].values()) == 500
    X, y = dados.separar_alvo(quadro)
    assert list(X.columns) == COLUNAS_COM_ALVO[1:] and y.name == "Diabetes"


def test_manifest_vazio_e_da_vertente_e_nao_tem_nada_medido() -> None:
    m = manifest_vazio()
    assert m["vertente"] == "diabetes" and m["versao"] is None
    assert m["dataset"]["tabela_origem"] == "dados.registros_diabetes"
    assert m["dataset"]["proveniencia"] == "data/bruto/diabetes/FONTE.md"
    assert all(m["dataset"][k] is None for k in ("snapshot", "versao_dados", "linhas"))


def test_carregar_snapshot_ausente_explica_como_gerar(tmp_path: Path) -> None:
    with pytest.raises(FileNotFoundError, match="app.diabetes.treino snapshot"):
        dados.carregar_snapshot(tmp_path / "snapshot-000000000000.parquet")


def test_versao_dados_do_manifest_e_o_prefixo_do_sha256() -> None:
    m = _manifest()
    versao = m["dataset"]["versao_dados"]
    assert m["vertente"] == "diabetes" and len(versao) == 12
    assert m["dataset"]["sha256_snapshot"].startswith(versao)
    assert m["dataset"]["snapshot"] == f"data/processado/diabetes/snapshot-{versao}.parquet"
    assert (m["dataset"]["linhas"], m["dataset"]["colunas"]) == (253_680, 22)
    assert m["dataset"]["pyarrow"] == pyarrow.__version__, (
        "subir o pyarrow muda versao_dados: regenere o snapshot e o manifest de propósito"
    )


def test_snapshot_no_disco_bate_com_o_manifest() -> None:
    m = _manifest()
    caminho = RAIZ / m["dataset"]["snapshot"]
    if not caminho.exists():
        pytest.skip("snapshot não está no disco (é regenerável: python -m app.diabetes.treino)")
    quadro = dados.carregar_snapshot(caminho, sha256_esperado=m["dataset"]["sha256_snapshot"])
    assert quadro.shape == (253_680, 22)
    assert quadro.dtypes.astype(str).to_dict() == DTYPES_SNAPSHOT
    with pytest.raises(RuntimeError, match="não bate"):
        dados.carregar_snapshot(caminho, sha256_esperado="0" * 64)


@pytest.mark.banco
def test_snapshot_duas_vezes_e_deterministico_e_nao_toca_a_pasta_mae(
    dsn: str, tmp_path: Path
) -> None:
    import psycopg

    vizinho = tmp_path / "snapshot-000000000000.parquet"  # um congelado da outra vertente
    vizinho.write_bytes(b"outra vertente")

    def congelar(pasta: Path) -> dados.InfoSnapshot:
        with psycopg.connect(dsn) as con:
            con.isolation_level = psycopg.IsolationLevel.REPEATABLE_READ
            info = dados.gerar_snapshot(con, pasta)
            con.commit()
        return info

    a = congelar(tmp_path / "diabetes")
    b = congelar(tmp_path / "diabetes")
    assert (a.versao_dados, a.sha256_conteudo) == (b.versao_dados, b.sha256_conteudo)
    assert vizinho.exists(), "o congelado da outra vertente não pode ser apagado"
    assert len(list((tmp_path / "diabetes").glob("snapshot-*.parquet"))) == 1
    with psycopg.connect(dsn) as con:
        n, linhas, tabela = con.execute(
            "SELECT count(*) OVER (), linhas, tabela_origem FROM operacao.snapshot_treino "
            "WHERE sha256_arquivo = %s",
            (a.sha256_arquivo,),
        ).fetchone()
    assert (n, linhas, tabela) == (1, 253_680, "dados.registros_diabetes")


@pytest.mark.banco
def test_cli_snapshot_anota_o_manifest_da_vertente(dsn: str, tmp_path: Path, capsys) -> None:
    manifesto = tmp_path / "manifest.json"
    pasta = tmp_path / "diabetes"
    args = [
        "snapshot",
        "--manifesto",
        str(manifesto),
        "--banco-url",
        dsn,
        "--processado",
        str(pasta),
    ]
    assert main(args) == 0
    m = json.loads(manifesto.read_text(encoding="utf-8"))
    assert m["vertente"] == "diabetes"
    assert (m["dataset"]["linhas"], m["dataset"]["colunas"]) == (253_680, 22)
    assert m["dataset"]["snapshot"].endswith(f"snapshot-{m['dataset']['versao_dados']}.parquet")
    assert "versao_dados=" in capsys.readouterr().out
