"""Seed da vertente diabetes: citação própria, ID como posição, domínios, COPY e idempotência."""

from __future__ import annotations

from pathlib import Path

import pandas as pd
import pytest

from app.diabetes.dados import seed
from app.diabetes.dominio.features import COLUNAS_BANCO, COLUNAS_COM_ALVO


def _amostra() -> pd.DataFrame:
    return pd.read_csv(seed.CSV_PADRAO, nrows=50)


def _gravar(tmp_path: Path, quadro: pd.DataFrame, nome: str) -> Path:
    caminho = tmp_path / nome
    quadro.to_csv(caminho, index=False)
    return caminho


def test_citacao_da_vertente_e_aceita() -> None:
    seed.conferir_citacao(seed.FONTE_MD)


def test_fonte_ref_aponta_o_fonte_md_da_vertente() -> None:
    assert (seed.RAIZ_REPOSITORIO / seed.FONTE_REF).resolve() == seed.FONTE_MD.resolve()


def test_quadro_preparado_tem_linha_origem_e_as_22_colunas_do_banco() -> None:
    quadro = seed.preparar_quadro(seed.CSV_PADRAO)
    assert list(quadro.columns) == ["linha_origem"] + [COLUNAS_BANCO[c] for c in COLUNAS_COM_ALVO]
    assert quadro.shape == (253_680, 23)
    assert quadro["linha_origem"].iloc[0] == 0 and quadro["linha_origem"].is_monotonic_increasing
    assert str(quadro["imc"].dtype) == "float64"
    assert str(quadro["faixa_etaria"].dtype) == "int64"
    assert set(quadro["diabetes"].unique()) == {"Não", "Sim"}
    assert set(quadro["sexo"].unique()) == {"Feminino", "Masculino"}


def test_linhas_fora_de_ordem_sao_recusadas(tmp_path: Path) -> None:
    invertido = _amostra().iloc[::-1]
    with pytest.raises(ValueError, match="posição da linha"):
        seed.preparar_quadro(_gravar(tmp_path, invertido, "invertido.csv"))


def test_faixa_etaria_fora_do_dominio_e_recusada_pelo_nome(tmp_path: Path) -> None:
    amostra = _amostra()
    amostra.loc[3, "Age"] = 14  # o "não sabe" do _AGEG5YR, que a limpeza da origem tirou
    with pytest.raises(ValueError, match="Faixa_Etaria"):
        seed.preparar_quadro(_gravar(tmp_path, amostra, "idade.csv"))


def test_binaria_com_codigo_novo_e_recusada_pelo_nome(tmp_path: Path) -> None:
    amostra = _amostra()
    amostra.loc[3, "Smoker"] = 9
    with pytest.raises(ValueError, match="Fumou_100_Cigarros"):
        seed.preparar_quadro(_gravar(tmp_path, amostra, "fumo.csv"))


def test_csv_sem_id_e_recusado(tmp_path: Path) -> None:
    sem_id = _amostra().drop(columns=["ID"])
    with pytest.raises(ValueError, match="ID"):
        seed.preparar_quadro(_gravar(tmp_path, sem_id, "sem-id.csv"))


def test_cli_devolve_1_com_o_motivo_sem_abrir_conexao(tmp_path: Path, capsys) -> None:
    invertido = _gravar(tmp_path, _amostra().iloc[::-1], "invertido.csv")
    codigo = seed.main(["--arquivo", str(invertido), "--banco-url", "postgresql://ninguem@x:1/y"])
    assert codigo == 1
    assert "FALHA" in capsys.readouterr().out


def test_tabela_invalida_e_recusada() -> None:
    with pytest.raises(ValueError, match="tabela"):
        seed.semear(seed.CSV_PADRAO, "dados; DROP TABLE x", "postgresql://ninguem@x:1/y")


@pytest.mark.banco
def test_seed_e_idempotente_e_aponta_a_propria_citacao(dsn: str) -> None:
    """Primeira execução garante a carga; a segunda não escreve nada; a outra base não muda."""
    import psycopg

    seed.semear(seed.CSV_PADRAO, seed.TABELA_PADRAO, dsn)
    with psycopg.connect(dsn) as con:
        cargas_antes = con.execute("SELECT count(*) FROM operacao.carga_fonte").fetchone()[0]
    assert seed.semear(seed.CSV_PADRAO, seed.TABELA_PADRAO, dsn) == 0
    with psycopg.connect(dsn) as con:
        cargas_depois = con.execute("SELECT count(*) FROM operacao.carga_fonte").fetchone()[0]
        (n,) = con.execute("SELECT count(*) FROM dados.registros_diabetes").fetchone()
        (n_sim,) = con.execute(
            "SELECT count(*) FROM dados.registros_diabetes WHERE diabetes = 'Sim'"
        ).fetchone()
        origem, fonte_ref = con.execute(
            "SELECT arquivo_origem, fonte_ref FROM operacao.carga_fonte "
            "WHERE tabela_destino = 'dados.registros_diabetes' ORDER BY id DESC LIMIT 1"
        ).fetchone()
        (n_obesidade,) = con.execute("SELECT count(*) FROM dados.registros_triagem").fetchone()
    assert (n, n_sim) == (253_680, 35_346)
    assert cargas_antes == cargas_depois
    assert origem == "cdc_diabetes_health_indicators.csv"
    assert fonte_ref == "data/bruto/diabetes/FONTE.md"
    assert n_obesidade == 2_111, "a base da vertente de obesidade não pode mudar"


@pytest.mark.banco
def test_conferir_sai_zero_com_a_base_carregada(dsn: str) -> None:
    assert seed.semear(seed.CSV_PADRAO, seed.TABELA_PADRAO, dsn, conferir=True) == 0
    assert seed.main(["--conferir", "--banco-url", dsn]) == 0
