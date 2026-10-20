"""O limiar por grupo de idade (versão 1.1.0): o critério, o artefato, a API e o estudo de acordo.

O critério do limiar único aplicado dentro de cada grupo de idade (notebook 02, seção "Limiar por
faixa etária"; `avaliacao.CRITERIO_LIMIAR_POR_IDADE`). O CLI grava a tabela no manifest e no
artefato, a API classifica cada pessoa pelo limiar do grupo dela, e o `limiar` único fica como
referência.
"""

from __future__ import annotations

import copy
import hashlib
import json
import logging
from pathlib import Path
from typing import Any

import joblib
import numpy as np
import pytest

from app.diabetes.dominio.features import ENTRADAS
from app.diabetes.nucleo.artefato import ArtefatoDiabetes
from app.diabetes.treino import avaliacao
from app.diabetes.treino.__main__ import (
    TOLERANCIA_LIMIARES_ENTRE_PLATAFORMAS,
    TOLERANCIA_METRICAS_ENTRE_PLATAFORMAS,
    e_limiar,
)
from app.nucleo.erros import ArtefatoIndisponivel
from tests.diabetes.conftest import DADOS_OURO_DIABETES, ENTRADA_PADRAO_DIABETES, RAIZ, URL_DIABETES

NOTEBOOK = RAIZ / "study" / "02_triagem_de_diabetes.ipynb"
REGISTRO = RAIZ / "artifacts" / "diabetes" / "metricas" / "limiares-por-idade.json"
REPRODUTIBILIDADE = RAIZ / "artifacts" / "diabetes" / "metricas" / "reprodutibilidade.json"


def _congelado_por_idade() -> dict[str, Any]:
    """A saída da célula que imprime o CONGELADO_POR_IDADE, lida do notebook commitado."""
    celulas = json.loads(NOTEBOOK.read_text(encoding="utf-8"))["cells"]
    celula = next(c for c in celulas if "CONGELADO_POR_IDADE = {" in "".join(c["source"]))
    texto = "".join(
        "".join(s["text"]) for s in celula["outputs"] if s.get("output_type") == "stream"
    )
    return dict(json.loads(texto))


def _grupo_da_tabela(manifest: dict[str, Any], faixa: int) -> dict[str, Any]:
    return next(g for g in manifest["limiares_por_idade"]["grupos"] if faixa in g["faixas_etarias"])


# ---- o critério ----


def test_os_grupos_cobrem_as_13_faixas_uma_vez_e_saem_dos_cortes() -> None:
    faixas = [f for grupo in avaliacao.FAIXAS_POR_GRUPO.values() for f in grupo]
    assert sorted(faixas) == list(range(1, 14)) and len(faixas) == 13
    assert list(avaliacao.FAIXAS_POR_GRUPO) == avaliacao.GRUPOS_IDADE
    for grupo, faixas_do_grupo in avaliacao.FAIXAS_POR_GRUPO.items():
        assert all(avaliacao.grupo_da_faixa(f) == grupo for f in faixas_do_grupo)
    with pytest.raises(ValueError, match="fora dos grupos"):
        avaliacao.grupo_da_faixa(14)


def test_o_limiar_de_cada_grupo_e_o_maior_que_atinge_o_alvo_no_grupo() -> None:
    gerador = np.random.default_rng(7)
    n = 3000
    idade = gerador.integers(1, 14, n)
    alvo = (gerador.uniform(0, 1, n) < 0.05 + idade / 40).astype("int64")
    p = np.round(np.clip(alvo * 0.2 + idade / 60 + gerador.uniform(0, 0.4, n), 0, 1), 3)
    limiares = avaliacao.limiares_por_grupo(alvo, p, idade)
    assert list(limiares) == avaliacao.GRUPOS_IDADE
    t = avaliacao.limiar_por_linha(idade, limiares)
    for grupo, faixas in avaliacao.FAIXAS_POR_GRUPO.items():
        m = np.isin(idade, faixas)
        assert (t[m] == limiares[grupo]).all()
        assert avaliacao.contagens(alvo[m], p[m] >= limiares[grupo])["recall"] >= 0.8
        acima = p[m] > limiares[grupo]
        assert alvo[m][acima].sum() / alvo[m].sum() < 0.8, "um limiar maior também atingiria"
    assert avaliacao.contagens(alvo, p >= t)["recall"] >= 0.8
    with pytest.raises(ValueError, match="fora dos grupos"):
        avaliacao.limiar_por_linha(np.array([0]), limiares)


def test_grupo_sem_caso_positivo_e_erro_explicito() -> None:
    idade = np.array([1, 2, 6, 7, 10, 11])
    alvo = np.array([0, 0, 1, 0, 1, 0])
    with pytest.raises(ValueError, match="sem nenhum caso positivo"):
        avaliacao.limiares_por_grupo(alvo, np.linspace(0.1, 0.6, 6), idade)


def test_avaliacao_com_limiar_por_linha_e_a_mesma_de_cada_grupo() -> None:
    gerador = np.random.default_rng(11)
    n = 2000
    idade = gerador.integers(1, 14, n)
    alvo = gerador.integers(0, 2, n)
    p = gerador.uniform(0, 1, n)
    limiares = {g: 0.3 + 0.1 * i for i, g in enumerate(avaliacao.GRUPOS_IDADE)}
    t = avaliacao.limiar_por_linha(idade, limiares)
    m = avaliacao.avaliar_teste(alvo, p, t, float(alvo.mean()))
    esperado = avaliacao.contagens(alvo, p >= t)
    assert m["recall_no_limiar"] == esperado["recall"]
    assert m["encaminhados_no_limiar"] == esperado["encaminhados"]
    matriz = avaliacao.matriz_confusao(alvo, p, t)
    assert "limiar" not in matriz and sum(map(sum, matriz["matriz"])) == n
    pontos = avaliacao.pontos_por_idade(alvo, p, idade)
    assert [x["recall_alvo"] for x in pontos] == list(avaliacao.RECALLS_DA_TABELA)
    assert all(x["recall"] >= x["recall_alvo"] for x in pontos)


# ---- o estudo, o CLI e o manifest ----


def test_o_criterio_e_os_grupos_sao_os_do_notebook() -> None:
    congelado = _congelado_por_idade()
    assert congelado["criterio"] == avaliacao.CRITERIO_LIMIAR_POR_IDADE
    assert congelado["recall_alvo"] == avaliacao.RECALL_ALVO
    assert {g["grupo"]: g["faixas_etarias"] for g in congelado["grupos"]} == (
        avaliacao.FAIXAS_POR_GRUPO
    )


def test_os_limiares_publicados_sao_os_que_o_notebook_mediu(manifest_diabetes: dict) -> None:
    """O notebook rodou no Windows: um modelo publicado de lá tem os limiares nas 6 casas."""
    no_notebook = _congelado_por_idade()["valores_nesta_execucao"]
    publicados = {g["grupo"]: g["valor"] for g in manifest_diabetes["limiares_por_idade"]["grupos"]}
    assert set(publicados) == set(no_notebook)
    for grupo, valor in publicados.items():
        if manifest_diabetes["ambiente"]["sistema"] == "Windows":
            assert round(valor, 6) == no_notebook[grupo], grupo
        else:
            assert abs(valor - no_notebook[grupo]) <= TOLERANCIA_METRICAS_ENTRE_PLATAFORMAS


def test_o_manifest_traz_a_tabela_que_cumpre_o_alvo(manifest_diabetes: dict) -> None:
    por_idade = manifest_diabetes["limiares_por_idade"]
    assert por_idade["criterio"] == avaliacao.CRITERIO_LIMIAR_POR_IDADE
    assert [g["grupo"] for g in por_idade["grupos"]] == avaliacao.GRUPOS_IDADE
    for grupo in por_idade["grupos"]:
        assert grupo["faixas_etarias"] == avaliacao.FAIXAS_POR_GRUPO[grupo["grupo"]]
        assert 0.0 < grupo["valor"] < 1.0
        assert grupo["fora_da_dobra"]["recall"] >= por_idade["recall_alvo"]
    assert por_idade["fora_da_dobra"]["recall"] >= por_idade["recall_alvo"]


def test_o_registro_da_escolha_e_o_do_manifest(manifest_diabetes: dict) -> None:
    registro = json.loads(REGISTRO.read_text(encoding="utf-8"))
    assert registro["versao"] == manifest_diabetes["versao"]
    assert registro["criterio"] == avaliacao.CRITERIO_LIMIAR_POR_IDADE
    assert registro["limiar_unico"] == manifest_diabetes["limiar"]["valor"]
    for no_registro, no_manifest in zip(
        registro["grupos"], manifest_diabetes["limiares_por_idade"]["grupos"], strict=True
    ):
        assert no_registro["grupo"] == no_manifest["grupo"]
        assert no_registro["limiar"] == no_manifest["valor"]
        assert no_registro["fora_da_dobra"] == no_manifest["fora_da_dobra"]
        assert len(no_registro["estabilidade"]["recall_cruzado"]) == 5
    assert (
        registro["total"]["fora_da_dobra"]
        == (manifest_diabetes["limiares_por_idade"]["fora_da_dobra"])
    )
    assert [p["recall_alvo"] for p in registro["pontos"]] == list(avaliacao.RECALLS_DA_TABELA)


def test_os_casos_de_ouro_ficam_longe_do_limiar_do_grupo() -> None:
    """Cada caso de ouro a pelo menos 0,33 do limiar do grupo dele, em log da chance.

    É a distância do caso mais perto do limiar único na 1.0.0. A condição é necessária, não
    suficiente: um perfil raro varia mais entre treinos. Quem garante que nenhum caso muda de
    classe é o registro de reprodutibilidade (`classificacao_estavel`, em todos os treinos medidos),
    conferido em test_treino_cli.
    """
    esperadas = json.loads(
        (DADOS_OURO_DIABETES / "saidas_esperadas.json").read_text(encoding="utf-8")
    )

    def log_chance(x: float) -> float:
        return float(np.log(x / (1 - x)))

    for i, saida in enumerate(esperadas):
        margem = abs(log_chance(saida["probabilidade"]) - log_chance(saida["limiar"]))
        assert margem >= 0.33, (i, margem)


def test_a_tolerancia_dos_limiares_cobre_a_medicao_registrada() -> None:
    """Entre plataformas, cada limiar tem a tolerância dele, mais estreita que a das métricas."""
    r = json.loads(REPRODUTIBILIDADE.read_text(encoding="utf-8"))
    limiares = [k for k in r["metricas"] if e_limiar(k)]
    assert set(limiares) == {"limiar.valor"} | {
        f"limiares_por_idade.{g}.valor" for g in avaliacao.GRUPOS_IDADE
    }
    maior = max(max(r["metricas"][k]["plataforma"], r["metricas"][k]["sementes"]) for k in limiares)
    assert maior <= TOLERANCIA_LIMIARES_ENTRE_PLATAFORMAS < TOLERANCIA_METRICAS_ENTRE_PLATAFORMAS
    assert not e_limiar("limiares_por_idade.18 a 44 anos.fora_da_dobra.recall")
    assert not e_limiar("metricas_teste.recall_no_limiar")


# ---- o artefato ----


def _gravar(pasta: Path, objeto: Any, manifest: dict) -> dict:
    pasta.mkdir(parents=True, exist_ok=True)
    caminho = pasta / manifest["arquivo"]
    joblib.dump(objeto, caminho)
    return {**manifest, "sha256": hashlib.sha256(caminho.read_bytes()).hexdigest()}


@pytest.fixture
def objeto(artefato_diabetes: Any, manifest_diabetes: dict) -> dict:
    return {
        "pipeline": artefato_diabetes.pipeline,
        "colunas": list(ENTRADAS),
        "limiar": artefato_diabetes.limiar,
        "limiares_por_idade": [
            {k: g[k] for k in ("grupo", "faixas_etarias", "valor")}
            for g in manifest_diabetes["limiares_por_idade"]["grupos"]
        ],
    }


def test_o_artefato_servido_classifica_pela_tabela(
    artefato_diabetes: Any, manifest_diabetes: dict
) -> None:
    assert artefato_diabetes.limiar == manifest_diabetes["limiar"]["valor"]
    for faixa in range(1, 14):
        grupo = _grupo_da_tabela(manifest_diabetes, faixa)
        assert artefato_diabetes.limiar_de(faixa) == (grupo["valor"], grupo["grupo"])


def test_artefato_sem_tabela_aplica_o_limiar_unico(
    tmp_path: Path, objeto: dict, manifest_diabetes: dict, caplog
) -> None:
    sem_tabela = {k: v for k, v in objeto.items() if k != "limiares_por_idade"}
    manifest = _gravar(tmp_path, sem_tabela, manifest_diabetes)
    with caplog.at_level(logging.WARNING):
        carregado = ArtefatoDiabetes.carregar(tmp_path, manifest, exigir_integridade=True)
    assert "limiar único vale para todas as idades" in caplog.text
    assert all(carregado.limiar_de(f) == (carregado.limiar, None) for f in range(1, 14))


@pytest.mark.parametrize(
    ("mudanca", "mensagem"),
    [
        (lambda t, m: t.pop(), "não cobre as 13 faixas"),
        (lambda t, m: t[0]["faixas_etarias"].append(6), "em mais de um grupo"),
        (lambda t, m: t[1].update(valor=1.5), "fora de"),
        (lambda t, m: t[2].pop("valor"), "sem grupo/faixas_etarias/valor"),
        (lambda t, m: t[0].update(valor=t[0]["valor"] + 0.01), "não são os do manifest"),
        (lambda t, m: m.pop("limiares_por_idade"), "não são os do manifest"),
    ],
)
def test_cada_defeito_da_tabela_e_recusado(
    tmp_path: Path, objeto: dict, manifest_diabetes: dict, mudanca, mensagem: str
) -> None:
    objeto = copy.deepcopy(objeto)
    manifest = copy.deepcopy(manifest_diabetes)
    mudanca(objeto["limiares_por_idade"], manifest)
    manifest = _gravar(tmp_path, objeto, manifest)
    with pytest.raises(ArtefatoIndisponivel, match=mensagem):
        ArtefatoDiabetes.carregar(tmp_path, manifest, exigir_integridade=True)


# ---- a API ----


@pytest.mark.parametrize("faixa", range(1, 14))
def test_a_predicao_usa_o_limiar_do_grupo_da_pessoa(
    cliente, manifest_diabetes: dict, faixa: int
) -> None:
    corpo = cliente.post(
        f"{URL_DIABETES}/predicoes", json=ENTRADA_PADRAO_DIABETES | {"Faixa_Etaria": faixa}
    ).json()
    grupo = _grupo_da_tabela(manifest_diabetes, faixa)
    assert corpo["limiar"] == grupo["valor"] and corpo["grupo_de_idade"] == grupo["grupo"]
    assert corpo["risco_elevado"] == (corpo["probabilidade"] >= grupo["valor"])


def test_ouro_e_lote_trazem_o_limiar_e_o_grupo_esperados(cliente) -> None:
    entradas = json.loads((DADOS_OURO_DIABETES / "entradas.json").read_text(encoding="utf-8"))
    esperadas = json.loads(
        (DADOS_OURO_DIABETES / "saidas_esperadas.json").read_text(encoding="utf-8")
    )
    lote = cliente.post(f"{URL_DIABETES}/predicoes/lote", json={"itens": entradas}).json()
    assert lote["sucesso"] == len(entradas)
    for resultado, esperado in zip(lote["resultados"], esperadas, strict=True):
        assert resultado["limiar"] == esperado["limiar"]
        assert resultado["grupo_de_idade"] == esperado["grupo_de_idade"]
        assert resultado["classificacao"] == esperado["classificacao"]


def test_model_info_traz_a_tabela_do_manifest(cliente, manifest_diabetes: dict) -> None:
    corpo = cliente.get(f"{URL_DIABETES}/model/info").json()
    assert corpo["limiares_por_idade"] == manifest_diabetes["limiares_por_idade"]
    assert corpo["limiar"] == manifest_diabetes["limiar"]


def test_o_relatorio_diz_o_limiar_do_grupo(cliente, manifest_diabetes: dict) -> None:
    html = cliente.post(
        f"{URL_DIABETES}/predicoes/relatorio", json={"entrada": ENTRADA_PADRAO_DIABETES}
    ).text
    grupo = _grupo_da_tabela(manifest_diabetes, ENTRADA_PADRAO_DIABETES["Faixa_Etaria"])
    assert f"Limiar de triagem ({grupo['grupo']}): {grupo['valor'] * 100:.1f}%" in html
