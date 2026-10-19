"""Deriva da vertente diabetes: os .sql de sql/diabetes/deriva, a view da consolidação e a rota.

O desenho de tests/test_deriva.py: CTE compartilhada idêntica entre 02 e 03, tradução de parâmetros,
nenhuma interpolação, e — com banco — a classificação do SQL igual à do Python, faixa a faixa, sobre
uma amostra do snapshot injetada no log numa versao_modelo exclusiva do teste. Duas garantias
próprias: a classificação do bloco compartilhado é a MESMA da view
operacao.diabetes_v_deriva_faixa (a da consolidação), e o IMC é comparado arredondado — o que o
modelo vê —, com o desempate no par.

A primeira asserção dos testes de banco é `n_faixas > 0`: o teste FALHA, e não pula, se
operacao.diabetes_distribuicao_treino_faixa estiver vazia.
"""

from __future__ import annotations

import json
import re
from typing import Any

import numpy as np
import pytest

from app.config import CONFIG
from app.diabetes.api.monitoramento import ARQUIVOS, SEM_N_MINIMO
from app.diabetes.dominio.features import DTYPES_SNAPSHOT, ENTRADAS
from app.diabetes.treino.dados import carregar_snapshot
from app.nucleo.sql_param import para_posicional
from tests.diabetes.conftest import RAIZ, URL_DIABETES

DERIVA = RAIZ / "sql" / "diabetes" / "deriva"
SCHEMA = RAIZ / "sql" / "schema.sql"
PERFIL = RAIZ / "artifacts" / "diabetes" / "distribuicao_treino.json"
REGISTRO_N_MINIMO = RAIZ / "artifacts" / "diabetes" / "metricas" / "n-minimo-deriva.json"
VERSAO_TESTE = "teste-deriva-diabetes"  # versao_modelo exclusiva do teste
AMOSTRA = 6000


def _bloco_compartilhado(nome: str) -> str:
    texto = (DERIVA / nome).read_text(encoding="utf-8")
    m = re.search(r"-- INICIO CTE COMPARTILHADA\n(.*?)-- FIM CTE COMPARTILHADA", texto, re.S)
    assert m, f"{nome} sem o bloco compartilhado"
    return m.group(1)


def _case(texto: str) -> str:
    """O CASE ... END da classificação, sem comentários e com espaço normalizado."""
    sem_comentario = re.sub(r"--[^\n]*", "", texto)
    m = re.search(r"CASE\s+WHEN f\.tipo = 'numerica'.*?\bEND\b", sem_comentario, re.S)
    assert m, "CASE da classificação não encontrado"
    return re.sub(r"\s+", " ", m.group(0)).strip()


def _view(nome: str) -> str:
    texto = SCHEMA.read_text(encoding="utf-8")
    m = re.search(rf"CREATE OR REPLACE VIEW {re.escape(nome)} AS(.*?);", texto, re.S)
    assert m, f"view {nome} não encontrada em sql/schema.sql"
    return m.group(1)


def test_cte_identica() -> None:
    """A duplicação entre 02 e 03 é intencional e vigiada: byte a byte igual."""
    assert _bloco_compartilhado("02_contagem_por_faixa.sql") == _bloco_compartilhado(
        "03_indicador_divergencia.sql"
    )


def test_a_classificacao_e_a_mesma_da_view_da_consolidacao() -> None:
    """Duas classificações divergem em uma semana: a do bloco é, literalmente, a da view."""
    bloco = _case(_bloco_compartilhado("02_contagem_por_faixa.sql")).replace(
        "a.entrada", "l.entrada"
    )
    assert bloco == _case(_view("operacao.diabetes_v_deriva_faixa"))
    assert "round((l.entrada -> f.feature)::text::double precision)" in bloco


def test_a_vertente_e_escolhida_pela_rota_nos_dois_lados() -> None:
    for nome in ARQUIVOS:
        assert "AND l.rota LIKE '/diabetes/%'" in (DERIVA / nome).read_text(encoding="utf-8"), nome
    assert "WHERE l.rota LIKE '/diabetes/%'" in _view("operacao.diabetes_v_deriva_faixa")
    assert "WHERE l.rota NOT LIKE '/diabetes/%'" in _view("operacao.v_deriva_faixa")


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
        assert "::text::double precision" in traduzido and "'/diabetes/%'" in traduzido
        for k in range(1, len(ordem) + 1):
            assert f"${k}" in traduzido


def test_nenhuma_interpolacao_de_string() -> None:
    for nome in ARQUIVOS:
        texto = (DERIVA / nome).read_text(encoding="utf-8")
        assert "format(" not in texto.lower() and "||" not in texto


def _psycopg(sql: str, nomes: list[str]) -> str:
    """$1..$n -> %(nome)s (psycopg); `%` literal (o LIKE) vira `%%`."""
    sql = sql.replace("%", "%%")
    for k in range(len(nomes), 0, -1):
        sql = sql.replace(f"${k}", f"%({nomes[k - 1]})s")
    return sql


def _classificar(valores: list[Any], faixas: list[dict], tipo: str) -> list[int]:
    """A classificação do Python: a de tools/medir_n_minimo_deriva.py, com o IMC arredondado.

    Recebe os valores como o JSON do log os guarda (None para a chave ausente).
    """
    if tipo == "numerica":
        bordas = [f["limite_sup"] for f in faixas[:-1]]
        return np.digitize(np.round(np.asarray(valores, dtype="float64")), bordas).tolist()
    rotulos = {f["faixa_rotulo"]: f["faixa_idx"] for f in faixas if f["faixa_rotulo"] is not None}
    nulo = next(f["faixa_idx"] for f in faixas if f["faixa_rotulo"] is None)
    return [nulo if v is None else rotulos.get(str(v), nulo) for v in valores]


@pytest.fixture
def log_da_amostra(dsn: str, manifest_diabetes: dict):
    """Injeta uma amostra do snapshot como tráfego 'api' da vertente, numa versão exclusiva.

    O IMC de um terço das linhas ganha casas decimais (como o calculado de peso e altura), com
    empates em .5 dos dois lados do par; e algumas linhas perdem uma chave, para a faixa NULL.
    """
    import psycopg

    quadro = carregar_snapshot(RAIZ / manifest_diabetes["dataset"]["snapshot"])[ENTRADAS].astype(
        {c: DTYPES_SNAPSHOT[c] for c in ENTRADAS}
    )
    amostra = quadro.sample(n=AMOSTRA, random_state=7).reset_index(drop=True)
    entradas = [
        {c: (v.item() if hasattr(v, "item") else v) for c, v in r.items()}
        for r in amostra.to_dict(orient="records")
    ]
    deslocamentos = (-0.5, 0.5, 0.49, -0.49, 0.3)
    for i, entrada in enumerate(entradas):
        if i % 3 == 0:
            entrada["IMC"] = float(entrada["IMC"]) + deslocamentos[(i // 3) % len(deslocamentos)]
    for i in range(0, 60, 6):
        del entradas[i]["Escolaridade"]
    linhas = [
        (
            "/diabetes/predicoes",
            "api",
            json.dumps(e),
            json.dumps({"teste": True}),
            "Risco baixo",
            VERSAO_TESTE,
            manifest_diabetes["dataset"]["versao_dados"],
            "1",
            1.0,
            200,
        )
        for e in entradas
    ]
    with psycopg.connect(dsn) as con:
        con.execute("DELETE FROM operacao.log_predicao WHERE versao_modelo = %s", (VERSAO_TESTE,))
        with con.cursor() as cur:
            cur.executemany(
                "INSERT INTO operacao.log_predicao (rota, origem, entrada, saida, rotulo_saida, "
                "versao_modelo, versao_dados, versao_api, latencia_ms, status_http, "
                "id_correlacao) VALUES (%s, %s, %s::jsonb, %s::jsonb, %s, %s, %s, %s, %s, %s, "
                "gen_random_uuid())",
                linhas,
            )
        con.commit()
    yield entradas
    with psycopg.connect(dsn) as con:
        con.execute("DELETE FROM operacao.log_predicao WHERE versao_modelo = %s", (VERSAO_TESTE,))
        con.commit()


@pytest.mark.banco
def test_round_do_postgres_desempata_no_par_como_o_numpy(conexao: Any) -> None:
    valores = [26.5, 27.5, 24.49, 24.51, 98.5, 12.5]
    sql = "SELECT " + ", ".join(f"round({v}::double precision)" for v in valores)
    assert list(conexao.execute(sql).fetchone()) == [float(np.round(v)) for v in valores]


@pytest.mark.banco
def test_classificacao_do_sql_e_a_do_python_e_o_psi_da_amostra_e_quase_zero(
    dsn: str, manifest_diabetes: dict, log_da_amostra: list[dict[str, Any]]
) -> None:
    import psycopg

    perfil = json.loads(PERFIL.read_text(encoding="utf-8"))
    with psycopg.connect(dsn) as con:
        (n_faixas,) = con.execute(
            "SELECT count(*) FROM operacao.diabetes_distribuicao_treino_faixa"
        ).fetchone()
        assert n_faixas > 0, (
            "referência vazia: rode python -m app.diabetes.treino.distribuicao --carregar"
        )
        params = {
            "janela_dias": 30,
            "versao_modelo": VERSAO_TESTE,
            "versao_dados": manifest_diabetes["dataset"]["versao_dados"],
            "n_minimo": 300,
        }
        resultados = {}
        for nome in ARQUIVOS:
            sql, nomes = para_posicional((DERIVA / nome).read_text(encoding="utf-8"))
            resultados[nome] = con.execute(_psycopg(sql, nomes), params).fetchall()

    # 02: faixa a faixa, a contagem do SQL é a do Python sobre as mesmas entradas.
    contagem_sql = {(r[0], r[1]): r[6] for r in resultados["02_contagem_por_faixa.sql"]}
    for f in perfil["features"]:
        valores = [e.get(f["feature"]) for e in log_da_amostra]
        indices = _classificar(valores, f["faixas"], f["tipo"])
        for faixa in f["faixas"]:
            esperado = indices.count(faixa["faixa_idx"])
            assert contagem_sql[(f["feature"], faixa["faixa_idx"])] == esperado, (
                f["feature"],
                faixa,
            )
    ausentes = sum("Escolaridade" not in e for e in log_da_amostra)
    faixa_nula = next(
        r
        for r in resultados["02_contagem_por_faixa.sql"]
        if r[0] == "Escolaridade" and r[3] is None
    )
    assert ausentes > 0 and faixa_nula[6] == ausentes, "a chave ausente cai na faixa NULL"

    # 03: uma amostra do próprio treino não acusa deriva.
    psi = {r[0]: (r[1], r[2], r[3]) for r in resultados["03_indicador_divergencia.sql"]}
    assert set(psi) == set(ENTRADAS)
    for feature, (n_amostra, valor, classificacao) in psi.items():
        assert n_amostra == AMOSTRA, feature
        assert valor is not None and valor < 0.02, (feature, valor)
        assert classificacao == "estavel", feature

    # 01: a média do log é a do IMC arredondado da amostra.
    (estatistica,) = resultados["01_distribuicao_numerica.sql"]
    assert estatistica[0] == "IMC"
    arredondado = np.round(np.asarray([e["IMC"] for e in log_da_amostra], dtype="float64"))
    assert estatistica[4] == pytest.approx(float(arredondado.mean()), abs=1e-9)
    assert estatistica[15] is False  # não extrapolou a faixa de treino


@pytest.mark.banco
def test_endpoint_deriva_com_banco(cliente: Any, monkeypatch: pytest.MonkeyPatch) -> None:
    n_minimo = json.loads(REGISTRO_N_MINIMO.read_text(encoding="utf-8"))["n_minimo"]
    monkeypatch.setattr(CONFIG, "n_minimo_deriva_diabetes", n_minimo)
    resposta = cliente.get(f"{URL_DIABETES}/monitoramento/deriva?janela_dias=30")
    corpo = resposta.json()
    assert corpo["disponivel"] is True and corpo["n_minimo"] == n_minimo
    assert corpo["consultas"] == list(ARQUIVOS)
    assert {f["feature"] for f in corpo["features"]} == set(ENTRADAS)
    assert [e["feature"] for e in corpo["estatisticas"]] == ["IMC"]
    assert corpo["versao_modelo"] == cliente.app.state.registro_diabetes.padrao.versao
    assert resposta.headers["cache-control"] == "public, max-age=300"
    so_imc = cliente.get(f"{URL_DIABETES}/monitoramento/deriva?feature=IMC").json()
    assert {f["feature"] for f in so_imc["faixas"]} == {"IMC"}


@pytest.mark.banco
def test_sem_n_minimo_a_deriva_da_vertente_fica_indisponivel(
    cliente: Any, monkeypatch: pytest.MonkeyPatch
) -> None:
    """Sem a variável, a API não cai: só esta rota diz o que falta (a da obesidade segue)."""
    monkeypatch.setattr(CONFIG, "n_minimo_deriva_diabetes", None)
    corpo = cliente.get(f"{URL_DIABETES}/monitoramento/deriva").json()
    assert corpo["disponivel"] is False and corpo["motivo"] == SEM_N_MINIMO
    assert cliente.get("/api/v1/monitoramento/deriva").json()["disponivel"] is True


def test_endpoint_deriva_degrada_sem_banco(cliente: Any) -> None:
    """Com o banco desligado, 200 com disponivel=false e motivo — nunca tela de erro."""
    if cliente.app.state.banco.habilitado:
        pytest.skip("suíte com banco: a degradação é coberta por test_log_resiliencia")
    resposta = cliente.get(f"{URL_DIABETES}/monitoramento/deriva")
    assert resposta.status_code == 200
    corpo = resposta.json()
    assert corpo["disponivel"] is False and corpo["motivo"]
    assert corpo["features"] == [] and corpo["n_amostra"] == 0
