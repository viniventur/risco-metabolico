"""O perfil de distribuição da vertente diabetes, a referência da deriva, contra manifest e banco.

O perfil não sai do treino (o modelo 1.0.0 já foi publicado), e sim do snapshot: o teste confere
que o JSON commitado é o que o snapshot produz hoje, que ele descreve o modelo e os dados do
manifest — um perfil velho depois de um treino novo falha aqui — e que a carga só toca as tabelas
da vertente.
"""

from __future__ import annotations

import json
from pathlib import Path
from typing import Any

import pytest

from app.diabetes.dominio.features import ENTRADAS
from app.diabetes.dominio.regras import DOMINIOS
from app.diabetes.treino import distribuicao
from tests.diabetes.conftest import RAIZ

PERFIL = RAIZ / "artifacts" / "diabetes" / "distribuicao_treino.json"
TABELAS_OBESIDADE = (
    "operacao.feature_catalogo",
    "operacao.distribuicao_treino_numerica",
    "operacao.distribuicao_treino_faixa",
)


@pytest.fixture(scope="module")
def perfil() -> dict[str, Any]:
    return dict(json.loads(PERFIL.read_text(encoding="utf-8")))


def test_o_perfil_descreve_o_modelo_e_os_dados_do_manifest(
    perfil: dict[str, Any], manifest_diabetes: dict
) -> None:
    assert perfil["versao_modelo"] == manifest_diabetes["versao"]
    assert perfil["versao_dados"] == manifest_diabetes["dataset"]["versao_dados"]
    assert perfil["sha256_snapshot"] == manifest_diabetes["dataset"]["sha256_snapshot"]
    assert perfil["n_treino"] == manifest_diabetes["dataset"]["linhas"]


def test_as_faixas_das_dez_entradas(perfil: dict[str, Any]) -> None:
    assert [f["feature"] for f in perfil["features"]] == ENTRADAS
    for f in perfil["features"]:
        proporcoes = sum(x["proporcao_treino"] for x in f["faixas"])
        assert proporcoes == pytest.approx(1.0, abs=1e-12), f["feature"]
        assert sum(x["n_treino"] for x in f["faixas"]) == perfil["n_treino"], f["feature"]
        if f["tipo"] == "categorica":
            rotulos = [x["faixa_rotulo"] for x in f["faixas"]]
            assert rotulos == [str(v) for v in DOMINIOS[f["feature"]]] + [None], f["feature"]
            assert f["faixas"][-1]["n_treino"] == 0  # a base não tem nulo; a faixa NULL é do log
        else:
            assert f["feature"] == "IMC"
            limites = [x["limite_sup"] for x in f["faixas"][:-1]]
            assert limites == sorted(limites) and all(float(v).is_integer() for v in limites), (
                "o IMC da base é inteiro e as consultas arredondam o do log: cortes inteiros"
            )
            assert f["faixas"][0]["limite_inf"] is None and f["faixas"][-1]["limite_sup"] is None


def test_o_json_commitado_e_o_que_o_snapshot_produz(tmp_path: Path, perfil: dict[str, Any]) -> None:
    destino = tmp_path / "distribuicao_treino.json"
    assert distribuicao.main(["--escrever", "--json", str(destino)]) == 0
    assert json.loads(destino.read_text(encoding="utf-8")) == perfil
    assert destino.read_bytes() == PERFIL.read_bytes().replace(b"\r\n", b"\n")


def test_escrever_falha_sem_snapshot(tmp_path: Path) -> None:
    manifesto = tmp_path / "manifest.json"
    manifesto.write_text(json.dumps({"versao": "9.9.9", "dataset": {}}), encoding="utf-8")
    destino = tmp_path / "perfil.json"
    assert (
        distribuicao.main(["--escrever", "--manifesto", str(manifesto), "--json", str(destino)])
        == 1
    )
    assert not destino.exists()


def _contagens(con: Any, tabelas: tuple[str, ...]) -> dict[str, int]:
    return {t: con.execute(f"SELECT count(*) FROM {t}").fetchone()[0] for t in tabelas}


@pytest.mark.banco
def test_carregar_e_idempotente_e_so_toca_a_vertente(conexao: Any, dsn: str, perfil: dict) -> None:
    antes = _contagens(conexao, TABELAS_OBESIDADE)
    for _ in range(2):
        n_cat, n_num, n_faixa = distribuicao.carregar(dsn, PERFIL)
    assert (n_cat, n_num) == (10, 1)
    assert n_faixa == sum(len(f["faixas"]) for f in perfil["features"])
    conexao.rollback()
    assert _contagens(conexao, TABELAS_OBESIDADE) == antes
    linhas = conexao.execute(
        "SELECT feature, faixa_idx, faixa_rotulo, limite_inf, limite_sup, n_treino "
        "FROM operacao.diabetes_distribuicao_treino_faixa WHERE feature = 'IMC' ORDER BY faixa_idx"
    ).fetchall()
    faixas = next(f for f in perfil["features"] if f["feature"] == "IMC")["faixas"]
    assert [ln[5] for ln in linhas] == [x["n_treino"] for x in faixas]
    assert linhas[0][3] == float("-inf") and linhas[-1][4] == float("inf")
