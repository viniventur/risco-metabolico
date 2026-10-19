"""Pipeline e avaliação da vertente diabetes: o que o CLI treina é o que o notebook 02 congelou.

A célula 38 do notebook imprime a configuração congelada; o notebook commitado traz essa saída, e
este teste a lê de lá — se o estudo mudar a escolha, o CLI não pode continuar treinando a antiga
em silêncio (nem o contrário).
"""

from __future__ import annotations

import json
from pathlib import Path

import numpy as np
import pandas as pd
import pytest

from app.diabetes.dominio.features import ENTRADAS, arredondar_imc
from app.diabetes.dominio.regras import DOMINIOS
from app.diabetes.treino import avaliacao
from app.diabetes.treino import pipeline as pipe
from app.diabetes.treino.__main__ import TOLERANCIA_METRICAS_ENTRE_PLATAFORMAS

RAIZ = Path(__file__).resolve().parents[3]
NOTEBOOK = RAIZ / "study" / "02_triagem_de_diabetes.ipynb"


def _congelado_no_notebook() -> dict:
    """A saída da célula que imprime o CONGELADO (a 38), lida do notebook commitado."""
    celulas = json.loads(NOTEBOOK.read_text(encoding="utf-8"))["cells"]
    celula = next(c for c in celulas if "CONGELADO = {" in "".join(c["source"]))
    texto = "".join(
        "".join(s["text"]) for s in celula["outputs"] if s.get("output_type") == "stream"
    )
    return json.loads(texto)


def test_configuracao_do_cli_e_a_da_celula_38() -> None:
    congelado = _congelado_no_notebook()
    assert congelado["entradas"] == ENTRADAS
    assert congelado["split"] == {
        "test_size": pipe.TEST_SIZE,
        "stratify": True,
        "random_state": pipe.RANDOM_STATE,
    }
    assert congelado["validacao_cruzada"] == {
        "n_splits": pipe.N_DOBRAS,
        "shuffle": True,
        "random_state": pipe.RANDOM_STATE,
    }
    assert congelado["algoritmo"] == pipe.ALGORITMO
    assert congelado["hiperparametros"] == pipe.HIPERPARAMETROS
    assert congelado["desbalanceamento"] == pipe.DESBALANCEAMENTO
    assert congelado["calibracao"] == pipe.CALIBRACAO
    assert congelado["limiar"]["criterio"] == avaliacao.CRITERIO_LIMIAR
    assert congelado["limiar"]["recall_alvo"] == avaliacao.RECALL_ALVO


def test_limiar_publicado_e_o_que_o_notebook_mediu(manifest_diabetes: dict) -> None:
    """O notebook rodou no Windows: um modelo publicado de lá tem o limiar nas 6 casas impressas."""
    no_notebook = _congelado_no_notebook()["limiar"]["valor_nesta_execucao"]
    publicado = manifest_diabetes["limiar"]["valor"]
    if manifest_diabetes["ambiente"]["sistema"] == "Windows":
        assert round(publicado, 6) == no_notebook
    else:
        assert abs(publicado - no_notebook) <= TOLERANCIA_METRICAS_ENTRE_PLATAFORMAS


def test_passos_e_colunas_sao_os_do_notebook() -> None:
    p = pipe.montar_pipeline()
    assert [nome for nome, _ in p.steps] == ["imc", "colunas", "modelo"]
    assert p.named_steps["imc"].func is arredondar_imc
    assert pipe.COLUNAS_TEXTO == [
        "Sexo",
        "Pressao_Alta",
        "Colesterol_Alto",
        "Fumou_100_Cigarros",
        "Atividade_Fisica_30_Dias",
        "Fruta_Diaria",
        "Verdura_Diaria",
    ]
    assert pipe.COLUNAS_NUMERICAS == ["Faixa_Etaria", "IMC", "Escolaridade"]
    texto = p.named_steps["colunas"].transformers[0][1]
    assert texto.handle_unknown == "error"
    assert texto.categories == [DOMINIOS[c] for c in pipe.COLUNAS_TEXTO]
    assert p.named_steps["modelo"].get_params()["max_depth"] == 3


def test_split_e_dobras_sao_estratificados_e_deterministicos() -> None:
    y = np.array([1] * 30 + [0] * 170)
    X = pd.DataFrame({c: range(200) for c in ENTRADAS})
    a = pipe.dividir(X, y)
    b = pipe.dividir(X, y)
    assert list(a[0].index) == list(b[0].index)
    assert (len(a[0]), len(a[1])) == (160, 40)
    assert a[3].mean() == pytest.approx(y.mean())
    dobras = pipe.dobras(a[0], a[2])
    assert len(dobras) == pipe.N_DOBRAS
    assert sorted(np.concatenate([v for _, v in dobras]).tolist()) == list(range(160))


def test_separar_usa_as_dez_entradas_e_o_alvo_em_0_1() -> None:
    quadro = pd.DataFrame({**{c: [1, 2] for c in ENTRADAS}, "Diabetes": ["Sim", "Não"]})
    X, y = pipe.separar(quadro)
    assert list(X.columns) == ENTRADAS
    assert y.tolist() == [1, 0] and y.dtype == "int64"


# ---- o critério do limiar ----


def test_limiar_para_recall_e_o_maior_que_atinge_o_alvo() -> None:
    gerador = np.random.default_rng(3)
    for _ in range(200):
        n = int(gerador.integers(5, 60))
        alvo = gerador.integers(0, 2, n)
        if alvo.sum() == 0:
            continue
        p = np.round(gerador.uniform(0, 1, n), 2)  # arredondado: força empates
        r = float(gerador.uniform(0.1, 1.0))
        t = avaliacao.limiar_para_recall(alvo, p, r)
        assert avaliacao.ponto_de_operacao(alvo, p, t)["recall"] >= r
        acima = p > t
        assert (alvo[acima].sum() / alvo.sum()) < r, "um limiar maior também atingiria o alvo"


def test_empate_no_limiar_entra_inteiro_no_encaminhamento() -> None:
    alvo = np.array([1, 1, 0, 1])
    p = np.array([0.9, 0.7, 0.7, 0.2])
    t = avaliacao.limiar_para_recall(alvo, p, 0.5)
    assert t == 0.7
    ponto = avaliacao.ponto_de_operacao(alvo, p, t)
    assert (ponto["vp"], ponto["fp"], ponto["vn"], ponto["fn"]) == (2, 1, 0, 1)
    assert ponto["encaminhados"] == 0.75


def test_pontos_de_operacao_cobrem_a_tabela_da_celula_29() -> None:
    alvo = np.array([1, 0, 1, 0, 1, 0, 0, 1, 0, 0])
    p = np.linspace(0.95, 0.05, 10)
    pontos = avaliacao.pontos_de_operacao(alvo, p)
    assert [x["recall_alvo"] for x in pontos] == list(avaliacao.RECALLS_DA_TABELA)
    assert all(x["recall"] >= x["recall_alvo"] for x in pontos)
    assert [x["limiar"] for x in pontos] == sorted((x["limiar"] for x in pontos), reverse=True)


def test_avaliacao_do_teste_e_por_grupo() -> None:
    gerador = np.random.default_rng(5)
    n = 400
    X = pd.DataFrame(
        {
            "Faixa_Etaria": gerador.integers(1, 14, n),
            "Sexo": gerador.choice(["Feminino", "Masculino"], n),
        }
    )
    y = gerador.integers(0, 2, n)
    p = np.clip(y * 0.3 + gerador.uniform(0, 0.7, n), 0, 1)
    m = avaliacao.avaliar_teste(y, p, 0.5, float(y.mean()))
    assert set(m) == {
        "roc_auc",
        "pr_auc",
        "brier",
        "brier_da_prevalencia",
        "precisao_fixa",
        "recall_na_precisao_fixa",
        "recall_no_limiar",
        "precisao_no_limiar",
        "especificidade_no_limiar",
        "encaminhados_no_limiar",
    }
    assert 0.5 < m["roc_auc"] <= 1.0
    grupos = avaliacao.por_grupo(X, y, p, 0.5)
    assert [(g["grupo"], g["valor"]) for g in grupos] == [
        ("idade", "18 a 44 anos"),
        ("idade", "45 a 64 anos"),
        ("idade", "65 anos ou mais"),
        ("sexo", "Feminino"),
        ("sexo", "Masculino"),
    ]
    assert sum(g["n"] for g in grupos if g["grupo"] == "sexo") == n
    matriz = avaliacao.matriz_confusao(y, p, 0.5)
    assert sum(map(sum, matriz["matriz"])) == n
