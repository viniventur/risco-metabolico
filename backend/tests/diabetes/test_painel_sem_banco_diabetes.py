"""`python -m app.diabetes.treino.painel`: a base do painel da vertente, do snapshot e sem banco.

É o caminho da imagem publicada (backend/Dockerfile). O que importa provar: o parquet tem o
contrato que `BasePainelDiabetes` exige, é IGUAL ao que `python -m app.diabetes.treino.agregar`
escreveu, e a base em memória recusa valor fora do domínio e guarda poucos recortes.
"""

from __future__ import annotations

import json
from pathlib import Path

import pandas as pd
import pytest

from app.diabetes.dominio.agregados import (
    COLUNAS_BASE,
    RECORTES_EM_CACHE,
    BasePainelDiabetes,
    tipar,
)
from app.diabetes.dominio.filtros import normalizar_filtros
from app.diabetes.dominio.regras import ORDEM_FAIXA_IMC
from app.diabetes.treino import painel
from app.dominio.regras import classificar_imc
from tests.diabetes.conftest import MANIFEST_DIABETES, RAIZ

OFICIAL = RAIZ / "data" / "processado" / "diabetes" / "base_painel.parquet"


def _snapshot_disponivel() -> bool:
    dataset = json.loads(MANIFEST_DIABETES.read_text(encoding="utf-8")).get("dataset") or {}
    return bool(dataset.get("snapshot")) and (RAIZ / dataset["snapshot"]).exists()


pytestmark = pytest.mark.skipif(
    not _snapshot_disponivel(),
    reason="snapshot ausente: rode python -m app.diabetes.treino snapshot",
)


@pytest.fixture(scope="module")
def derivado(tmp_path_factory: pytest.TempPathFactory) -> Path:
    destino = tmp_path_factory.mktemp("painel") / "base_painel.parquet"
    assert painel.main(["--parquet", str(destino)]) == 0
    return destino


def test_deriva_a_base_com_o_contrato(derivado: Path, manifest_diabetes: dict) -> None:
    base = pd.read_parquet(derivado)
    assert list(base.columns) == COLUNAS_BASE
    assert base["linha_origem"].tolist() == list(range(len(base)))
    assert len(base) == manifest_diabetes["dataset"]["linhas"]
    assert list(base["Faixa_IMC"].cat.categories) == ORDEM_FAIXA_IMC
    amostra = base.drop_duplicates("IMC")
    assert all(
        f == classificar_imc(i) for f, i in zip(amostra["Faixa_IMC"], amostra["IMC"], strict=True)
    )
    assert BasePainelDiabetes.carregar(derivado).total_global == len(base)


def test_resultado_igual_ao_do_materializador(derivado: Path) -> None:
    if not OFICIAL.exists():
        pytest.skip("base do painel de `python -m app.diabetes.treino.agregar` ausente")
    pd.testing.assert_frame_equal(pd.read_parquet(derivado), pd.read_parquet(OFICIAL))


def test_falha_sem_snapshot_no_manifest(tmp_path: Path) -> None:
    manifesto = tmp_path / "manifest.json"
    manifesto.write_text(json.dumps({"dataset": {}}), encoding="utf-8")
    saida = tmp_path / "x.parquet"
    assert painel.main(["--manifesto", str(manifesto), "--parquet", str(saida)]) == 1
    assert not saida.exists()


def test_tipar_recusa_valor_fora_do_dominio_e_estouro(derivado: Path) -> None:
    pequena = pd.read_parquet(derivado).head(50)
    texto = pequena.astype({"Diabetes": "object"})
    texto.loc[texto.index[0], "Diabetes"] = "Talvez"
    with pytest.raises(ValueError, match="Diabetes"):
        tipar(texto)
    dias = pequena.astype({"Dias_Saude_Mental_Ruim": "int64"})
    dias.loc[dias.index[0], "Dias_Saude_Mental_Ruim"] = 300
    with pytest.raises(ValueError, match="Dias_Saude_Mental_Ruim"):
        tipar(dias)
    with pytest.raises(ValueError, match="sem as colunas"):
        tipar(pequena.drop(columns=["Faixa_IMC"]))


def test_poucos_recortes_em_cache_e_a_base_nunca_copiada(derivado: Path) -> None:
    base = BasePainelDiabetes.carregar(derivado)
    assert base.filtrar(normalizar_filtros()) is base.quadro
    for idade in range(1, RECORTES_EM_CACHE + 3):
        recorte = base.filtrar(normalizar_filtros(faixa_etaria=[str(idade)]))
        assert set(recorte["Faixa_Etaria"]) == {idade}
    assert len(base._cache) == RECORTES_EM_CACHE
    for _ in range(3):
        base.paginar_registros(1, 5, "IMC", "asc", normalizar_filtros(sexo=["Masculino"]))
    assert len(base._ordens) == 1
