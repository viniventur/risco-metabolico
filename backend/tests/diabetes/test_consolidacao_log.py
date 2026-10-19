"""A consolidação semanal do log (operacao.manutencao_log) com as duas vertentes no mesmo log.

Antes do filtro de vertente, operacao.v_deriva_faixa classificava TODA linha do log nas faixas da
obesidade, e uma linha da vertente diabetes — que não tem nenhuma daquelas chaves — caía, pelo
IS NOT DISTINCT FROM, na faixa NULL ("chave ausente") de cada uma das 13 categóricas. O teste
prova as três coisas que a correção promete, num dia do passado que só ele usa:

1. a definição anterior da view (copiada aqui, literal) contaminava as faixas NULL;
2. com o filtro, a série da obesidade em operacao.deriva_diaria é EXATAMENTE a que a definição
   anterior daria para um log só com as linhas da obesidade — o resultado delas não muda;
3. as linhas da vertente diabetes vão para operacao.diabetes_deriva_diaria, com a classificação
   dela (o IMC arredondado), e a função relata a soma das duas consolidações.
"""

from __future__ import annotations

import json
from datetime import date
from typing import Any

import numpy as np
import pytest

from app.diabetes.dominio.features import DTYPES_SNAPSHOT as DTYPES_DIABETES
from app.diabetes.dominio.features import ENTRADAS
from app.diabetes.treino.dados import carregar_snapshot as carregar_snapshot_diabetes
from app.dominio.features import COLUNAS, DTYPES_SNAPSHOT
from app.treino.dados import carregar_snapshot
from tests.diabetes.conftest import RAIZ

pytestmark = pytest.mark.banco

DIA = date(2001, 1, 2)  # nenhum outro teste grava nesse dia
VERSAO = "teste-consolidacao"
N_OBESIDADE, N_DIABETES, SEM_CHAVE = 300, 250, 5
PERFIL_DIABETES = RAIZ / "artifacts" / "diabetes" / "distribuicao_treino.json"

# operacao.v_deriva_faixa ANTES do filtro de vertente — a definição de sql/schema.sql até a F3.
VIEW_ANTERIOR = """
SELECT l.criado_em, f.feature, f.faixa_idx
FROM operacao.log_predicao AS l
INNER JOIN operacao.distribuicao_treino_faixa AS f
    ON (
        CASE
            WHEN f.tipo = 'numerica' THEN
                jsonb_typeof(l.entrada -> f.feature) = 'number'
                AND (l.entrada -> f.feature)::text::double precision >= f.limite_inf
                AND (l.entrada -> f.feature)::text::double precision < f.limite_sup
            ELSE
                l.entrada ->> f.feature IS NOT DISTINCT FROM f.faixa_rotulo
        END
    )
"""
SERIE_ANTERIOR = (
    "SELECT feature, faixa_idx, count(*) FROM (" + VIEW_ANTERIOR + ") AS v "
    "WHERE criado_em::date = %s GROUP BY 1, 2"
)


def _registros(quadro: Any, n: int, semente: int) -> list[dict[str, Any]]:
    amostra = quadro.sample(n=n, random_state=semente)
    return [
        {c: (v.item() if hasattr(v, "item") else v) for c, v in r.items()}
        for r in amostra.to_dict(orient="records")
    ]


def _inserir(con: Any, rota: str, entradas: list[dict[str, Any]], versao_dados: str) -> None:
    with con.cursor() as cur:
        cur.executemany(
            "INSERT INTO operacao.log_predicao (criado_em, rota, origem, entrada, saida, "
            "rotulo_saida, versao_modelo, versao_dados, versao_api, latencia_ms, status_http, "
            "id_correlacao) VALUES (%s, %s, 'api', %s::jsonb, '{}'::jsonb, 'teste', %s, %s, '1', "
            "1.0, 200, gen_random_uuid())",
            [(DIA, rota, json.dumps(e), VERSAO, versao_dados) for e in entradas],
        )


def _limpar(con: Any) -> None:
    con.execute("DELETE FROM operacao.log_predicao WHERE versao_modelo = %s", (VERSAO,))
    con.execute("DELETE FROM operacao.deriva_diaria WHERE dia = %s", (DIA,))
    con.execute("DELETE FROM operacao.diabetes_deriva_diaria WHERE dia = %s", (DIA,))
    con.commit()


@pytest.fixture
def con(dsn: str) -> Any:
    import psycopg

    with psycopg.connect(dsn) as conexao:
        _limpar(conexao)
        yield conexao
        _limpar(conexao)


def test_a_consolidacao_separa_as_vertentes_sem_mudar_a_obesidade(
    con: Any, manifest: dict, manifest_diabetes: dict
) -> None:
    (n_faixas,) = con.execute("SELECT count(*) FROM operacao.distribuicao_treino_faixa").fetchone()
    (n_faixas_diabetes,) = con.execute(
        "SELECT count(*) FROM operacao.diabetes_distribuicao_treino_faixa"
    ).fetchone()
    assert n_faixas > 0 and n_faixas_diabetes > 0, "carregue as duas referências de deriva antes"

    snapshot = carregar_snapshot(RAIZ / manifest["dataset"]["snapshot"])
    obesidade = _registros(
        snapshot[COLUNAS].astype({c: DTYPES_SNAPSHOT[c] for c in COLUNAS}), N_OBESIDADE, 11
    )
    for entrada in obesidade[:SEM_CHAVE]:  # linhas da própria obesidade com chave ausente
        del entrada["Genero"]
    snapshot_diabetes = carregar_snapshot_diabetes(RAIZ / manifest_diabetes["dataset"]["snapshot"])
    diabetes = _registros(
        snapshot_diabetes[ENTRADAS].astype({c: DTYPES_DIABETES[c] for c in ENTRADAS}),
        N_DIABETES,
        13,
    )
    for i, entrada in enumerate(diabetes[::4]):  # IMC com casas, como o calculado de peso e altura
        entrada["IMC"] = float(entrada["IMC"]) + (0.5 if i % 2 else -0.5)

    _inserir(con, "/predicoes", obesidade, manifest["dataset"]["versao_dados"])
    con.commit()
    so_obesidade = {(f, i): n for f, i, n in con.execute(SERIE_ANTERIOR, (DIA,)).fetchall()}

    _inserir(con, "/diabetes/predicoes", diabetes, manifest_diabetes["dataset"]["versao_dados"])
    con.commit()

    # 1. A definição anterior contaminava: cada categórica ganhava as N_DIABETES linhas na faixa
    #    NULL, e as numéricas, nenhuma (o jsonb_typeof falha sem a chave).
    misturado = {(f, i): n for f, i, n in con.execute(SERIE_ANTERIOR, (DIA,)).fetchall()}
    faixas_nulas = con.execute(
        "SELECT feature, faixa_idx FROM operacao.distribuicao_treino_faixa "
        "WHERE tipo = 'categorica' AND faixa_rotulo IS NULL"
    ).fetchall()
    assert len(faixas_nulas) == 13
    for chave in faixas_nulas:
        assert misturado[chave] - so_obesidade.get(chave, 0) == N_DIABETES, chave

    consolidadas, removidas = con.execute(
        "SELECT * FROM operacao.manutencao_log(%s, %s)", (3650, 10**9)
    ).fetchone()
    con.commit()

    # 2. A série da obesidade é a de um log só com a obesidade, faixa a faixa.
    serie = {
        (f, i): n
        for f, i, n in con.execute(
            "SELECT feature, faixa_idx, n FROM operacao.deriva_diaria WHERE dia = %s", (DIA,)
        ).fetchall()
    }
    assert serie == so_obesidade
    assert serie[("Genero", max(i for f, i in serie if f == "Genero"))] == SEM_CHAVE

    # 3. A vertente diabetes, na série dela, com a classificação dela.
    perfil = json.loads(PERFIL_DIABETES.read_text(encoding="utf-8"))
    serie_diabetes = {
        (f, i): n
        for f, i, n in con.execute(
            "SELECT feature, faixa_idx, n FROM operacao.diabetes_deriva_diaria WHERE dia = %s",
            (DIA,),
        ).fetchall()
    }
    esperado: dict[tuple[str, int], int] = {}
    for feature in perfil["features"]:
        faixas = feature["faixas"]
        if feature["tipo"] == "numerica":
            bordas = [x["limite_sup"] for x in faixas[:-1]]
            imc = np.round(np.asarray([e["IMC"] for e in diabetes], dtype="float64"))
            indices = np.digitize(imc, bordas).tolist()
        else:
            rotulos = {x["faixa_rotulo"]: x["faixa_idx"] for x in faixas}
            indices = [rotulos[str(e[feature["feature"]])] for e in diabetes]
        for indice in indices:
            chave = (feature["feature"], indice)
            esperado[chave] = esperado.get(chave, 0) + 1
    assert serie_diabetes == esperado
    for entrada in ENTRADAS:
        assert sum(n for (f, _), n in serie_diabetes.items() if f == entrada) == N_DIABETES

    assert consolidadas == len(serie) + len(serie_diabetes)
    assert removidas == N_OBESIDADE + N_DIABETES
    (restantes,) = con.execute(
        "SELECT count(*) FROM operacao.log_predicao WHERE versao_modelo = %s", (VERSAO,)
    ).fetchone()
    assert restantes == 0


def test_a_funcao_mantem_a_assinatura(con: Any) -> None:
    """A retenção (docker-compose.yml) chama `select *`: as duas colunas de sempre, nesta ordem."""
    cursor = con.execute("SELECT * FROM operacao.manutencao_log(3650, 1000000000)")
    assert [d.name for d in cursor.description] == ["consolidadas", "removidas"]
    con.rollback()
