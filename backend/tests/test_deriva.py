"""Deriva (§10.6, §10.9): CTE compartilhada idêntica, tradução de parâmetros, PSI do treino.

A primeira asserção dos testes de banco é `n_faixas > 0`: o teste FALHA, e não pula, se
operacao.distribuicao_treino_faixa estiver vazia — sem isso um LEFT JOIN contra tabela vazia faria
o portão passar por vacuidade.
"""

from __future__ import annotations

import json
import re
from pathlib import Path

import pytest

from app.nucleo.sql_param import para_posicional

RAIZ = Path(__file__).resolve().parents[2]
DERIVA = RAIZ / "sql" / "deriva"
ARQUIVOS = [
    "01_distribuicao_numerica.sql",
    "02_contagem_por_faixa.sql",
    "03_indicador_divergencia.sql",
]
VERSAO_TESTE = "teste-deriva"  # versao_modelo exclusiva do teste: o monitoramento real nunca a vê


def _bloco_compartilhado(nome: str) -> str:
    texto = (DERIVA / nome).read_text(encoding="utf-8")
    m = re.search(r"-- INICIO CTE COMPARTILHADA\n(.*?)-- FIM CTE COMPARTILHADA", texto, re.S)
    assert m, f"{nome} sem o bloco compartilhado"
    return m.group(1)


def test_cte_identica() -> None:
    """A duplicação entre 02 e 03 é intencional e vigiada: byte a byte igual."""
    assert _bloco_compartilhado("02_contagem_por_faixa.sql") == _bloco_compartilhado(
        "03_indicador_divergencia.sql"
    )


def test_traducao_de_parametros() -> None:
    esperado = {
        "01_distribuicao_numerica.sql": ["janela_dias", "versao_modelo", "versao_dados"],
        "02_contagem_por_faixa.sql": ["janela_dias", "versao_modelo", "versao_dados"],
        "03_indicador_divergencia.sql": [
            "janela_dias",
            "versao_modelo",
            "versao_dados",
            "n_minimo",
        ],
    }
    for nome, ordem in esperado.items():
        traduzido, nomes = para_posicional((DERIVA / nome).read_text(encoding="utf-8"), ordem)
        assert nomes == ordem
        assert ":'" not in traduzido and not re.search(r"(?<![:\w]):[a-z_]+", traduzido)
        assert "::text::double precision" in traduzido  # os casts sobrevivem à tradução
        for k in range(1, len(ordem) + 1):
            assert f"${k}" in traduzido


def test_traducao_recusa_ordem_errada() -> None:
    with pytest.raises(ValueError):
        para_posicional("SELECT :a, :b", ["b", "a"])
    assert para_posicional("SELECT :a, :'b', :a")[0] == "SELECT $1, $2, $1"


def test_nenhuma_interpolacao_de_string() -> None:
    for nome in ARQUIVOS:
        texto = (DERIVA / nome).read_text(encoding="utf-8")
        assert "format(" not in texto.lower() and "||" not in texto


def _psycopg(sql: str, nomes: list[str]) -> str:
    """$1..$n -> %(nome)s (psycopg): um parâmetro pode aparecer mais de uma vez (:n_minimo em 03)."""
    for k in range(len(nomes), 0, -1):
        sql = sql.replace(f"${k}", f"%({nomes[k - 1]})s")
    return sql


@pytest.fixture
def log_do_snapshot(dsn: str, manifest: dict):
    """Injeta o snapshot INTEIRO como tráfego 'api' numa versao_modelo exclusiva; limpa depois."""
    import psycopg

    from app.dominio.features import COLUNAS, DTYPES_SNAPSHOT
    from app.treino.dados import carregar_snapshot

    quadro = carregar_snapshot(RAIZ / manifest["dataset"]["snapshot"])[COLUNAS].astype(
        {c: DTYPES_SNAPSHOT[c] for c in COLUNAS}
    )
    linhas = [
        (
            "/predicoes",
            "api",
            json.dumps({c: (v.item() if hasattr(v, "item") else v) for c, v in r.items()}),
            json.dumps({"teste": True}),
            "Peso Normal",
            0.0,
            VERSAO_TESTE,
            manifest["dataset"]["versao_dados"],
            "1",
            1.0,
            200,
        )
        for r in quadro.to_dict(orient="records")
    ]
    with psycopg.connect(dsn) as con:
        con.execute("DELETE FROM operacao.log_predicao WHERE versao_modelo = %s", (VERSAO_TESTE,))
        with con.cursor() as cur:
            cur.executemany(
                "INSERT INTO operacao.log_predicao (rota, origem, entrada, saida, rotulo_saida, "
                "risco_acumulado, versao_modelo, versao_dados, versao_api, latencia_ms, "
                "status_http, "
                "id_correlacao) VALUES (%s, %s, %s::jsonb, %s::jsonb, %s, %s, %s, %s, %s, %s, %s, "
                "gen_random_uuid())",
                linhas,
            )
        con.commit()
    yield len(linhas)
    with psycopg.connect(dsn) as con:
        con.execute("DELETE FROM operacao.log_predicao WHERE versao_modelo = %s", (VERSAO_TESTE,))
        con.commit()


@pytest.mark.banco
def test_psi_do_treino_contra_si_mesmo_e_quase_zero(
    dsn: str, manifest: dict, log_do_snapshot: int
) -> None:
    import psycopg

    with psycopg.connect(dsn) as con:
        (n_faixas,) = con.execute(
            "SELECT count(*) FROM operacao.distribuicao_treino_faixa"
        ).fetchone()
        assert n_faixas > 0, (
            "tabelas de referência vazias: rode scripts/carregar-distribuicao-treino.ps1"
        )
        params = {
            "janela_dias": 30,
            "versao_modelo": VERSAO_TESTE,
            "versao_dados": manifest["dataset"]["versao_dados"],
            "n_minimo": 100,
        }
        resultados = {}
        for nome in ARQUIVOS:
            sql, nomes = para_posicional((DERIVA / nome).read_text(encoding="utf-8"))
            resultados[nome] = con.execute(_psycopg(sql, nomes), params).fetchall()

    psi = {r[0]: (r[1], r[2], r[3]) for r in resultados["03_indicador_divergencia.sql"]}
    assert len(psi) == 16
    for feature, (n_amostra, valor, classificacao) in psi.items():
        assert n_amostra == log_do_snapshot, feature
        assert valor is not None and valor < 0.02, (feature, valor)
        assert classificacao == "estavel", feature

    # 02: a classificação em faixas do SQL reproduz a do Python (distribuicao.py), contagem a
    # contagem.
    for r in resultados["02_contagem_por_faixa.sql"]:
        feature, faixa_idx, n_log, n_treino = r[0], r[1], r[6], r[9]
        assert n_log == n_treino, (feature, faixa_idx, n_log, n_treino)

    # 01: as médias do log são as do treino (o log É o treino), deslocamento zero.
    for r in resultados["01_distribuicao_numerica.sql"]:
        feature, media_log, media_treino, deslocamento = r[0], r[4], r[5], r[14]
        assert media_log == pytest.approx(media_treino, abs=1e-9), feature
        assert deslocamento == pytest.approx(0.0, abs=1e-9), feature
        assert r[15] is False  # não extrapolou a faixa de treino


@pytest.mark.banco
def test_funcao_de_retencao_roda(dsn: str) -> None:
    import psycopg

    with psycopg.connect(dsn) as con:
        linha = con.execute("SELECT * FROM operacao.manutencao_log(90, 100000)").fetchone()
    assert linha is not None and len(linha) == 2


@pytest.mark.banco
def test_endpoint_deriva_com_banco(cliente, log_do_snapshot: int) -> None:
    corpo = cliente.get("/api/v1/monitoramento/deriva?janela_dias=30").json()
    assert corpo["disponivel"] is True
    assert corpo["consultas"] == ARQUIVOS
    assert len(corpo["features"]) == 16 and len(corpo["estatisticas"]) == 3
    assert {f["classificacao"] for f in corpo["features"]} <= {
        "estavel",
        "atencao",
        "deriva significativa",
        "amostra insuficiente",
    }
    so_idade = cliente.get("/api/v1/monitoramento/deriva?feature=Idade").json()
    assert {f["feature"] for f in so_idade["faixas"]} == {"Idade"}
    assert (
        cliente.get("/api/v1/monitoramento/deriva").headers["cache-control"]
        == "public, max-age=300"
    )


def test_endpoint_deriva_degrada_sem_banco(cliente) -> None:
    """Com o banco desligado, 200 com disponivel=false e motivo — nunca tela de erro."""
    banco = cliente.app.state.banco
    if banco.habilitado:
        pytest.skip("suíte com banco: a degradação é coberta por test_log_resiliencia/F10")
    resposta = cliente.get("/api/v1/monitoramento/deriva")
    assert resposta.status_code == 200
    corpo = resposta.json()
    assert corpo["disponivel"] is False and corpo["motivo"]
    assert corpo["features"] == [] and corpo["n_amostra"] == 0
