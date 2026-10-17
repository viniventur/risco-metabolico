"""Seed: citação obrigatória, schema nominal, nome sem caminho, idempotência por sha256."""

from __future__ import annotations

from pathlib import Path

import pytest

from app.dados import seed
from app.dominio.features import COLUNAS_BANCO, COLUNAS_COM_ALVO

CSV = seed.RAIZ_REPOSITORIO / "data" / "bruto" / "obesity.csv"


def _fonte(tmp_path: Path, bloco: str) -> Path:
    f = tmp_path / "FONTE.md"
    f.write_text(f"# x\n<!-- citacao-inicio -->\n{bloco}\n<!-- citacao-fim -->\n", encoding="utf-8")
    return f


def test_citacao_ausente_e_recusada(tmp_path: Path) -> None:
    with pytest.raises(seed.CitacaoAusente):
        seed.conferir_citacao(tmp_path / "nao-existe.md")


def test_citacao_vazia_e_recusada(tmp_path: Path) -> None:
    with pytest.raises(seed.CitacaoAusente):
        seed.conferir_citacao(_fonte(tmp_path, "   "))


def test_citacao_pendente_e_recusada(tmp_path: Path) -> None:
    with pytest.raises(seed.CitacaoAusente):
        seed.conferir_citacao(_fonte(tmp_path, "Autor X. Título. PENDENTE"))


def test_citacao_do_repositorio_e_aceita() -> None:
    seed.conferir_citacao(seed.FONTE_MD)


def test_nome_de_origem_nunca_carrega_caminho() -> None:
    nome = seed.nome_de_origem(Path("C:/qualquer/pasta/obesity.csv"))
    assert nome == "obesity.csv"
    assert "/" not in nome and "\\" not in nome


def test_quadro_preparado_tem_18_colunas_na_ordem_do_banco() -> None:
    quadro = seed.preparar_quadro(CSV)
    assert list(quadro.columns) == ["linha_origem"] + [COLUNAS_BANCO[c] for c in COLUNAS_COM_ALVO]
    assert quadro.shape == (2111, 18)
    assert quadro["linha_origem"].tolist() == list(range(2111))
    assert not quadro.isnull().any().any()
    assert str(quadro["consumo_vegetais"].dtype) == "int64"
    assert str(quadro["idade"].dtype) == "float64"


def test_rotulos_cobrem_as_cinco_escalas() -> None:
    linhas = seed._linhas_rotulos()
    assert {ln[0] for ln in linhas} == {
        "Consumo_Vegetais",
        "Numero_Refeicoes_Principais",
        "Consumo_Agua_Diario",
        "Atividade_Fisica_Frequencia",
        "Tempo_Dispositivos_Tecnologicos",
    }
    assert len(linhas) == 3 + 4 + 3 + 4 + 3


@pytest.mark.banco
def test_seed_e_idempotente(dsn: str) -> None:
    """Primeira execução garante a carga; a segunda não escreve nada e devolve 0."""
    import psycopg

    seed.semear(CSV, seed.TABELA_PADRAO, dsn)
    with psycopg.connect(dsn) as con:
        antes = con.execute("SELECT count(*) FROM dados.registros_triagem").fetchone()[0]
        cargas_antes = con.execute("SELECT count(*) FROM operacao.carga_fonte").fetchone()[0]
    assert seed.semear(CSV, seed.TABELA_PADRAO, dsn) == 0
    with psycopg.connect(dsn) as con:
        depois = con.execute("SELECT count(*) FROM dados.registros_triagem").fetchone()[0]
        cargas_depois = con.execute("SELECT count(*) FROM operacao.carga_fonte").fetchone()[0]
        origem = con.execute(
            "SELECT arquivo_origem FROM operacao.carga_fonte ORDER BY id DESC LIMIT 1"
        ).fetchone()[0]
    assert antes == depois == 2111
    assert cargas_antes == cargas_depois
    assert origem == "obesity.csv"


@pytest.mark.banco
def test_conferir_sai_zero_com_a_base_carregada(dsn: str) -> None:
    assert seed.semear(CSV, seed.TABELA_PADRAO, dsn, conferir=True) == 0
