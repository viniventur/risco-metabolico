"""`python -m app.treino.painel`: base_painel.parquet derivado do snapshot, sem banco (§11.2).

É o caminho da imagem publicada. O que importa provar: o parquet tem o contrato que
`BasePainel` exige e é IGUAL ao que `python -m app.treino congelar` escreveu.
"""

from __future__ import annotations

import json
from pathlib import Path

import pandas as pd
import pytest

from app.dominio.agregados import BasePainel
from app.dominio.features import COLUNAS_COM_ALVO, COLUNAS_ESCALAS
from app.dominio.regras import ROTULOS_ESCALA
from app.treino import painel

RAIZ = Path(__file__).resolve().parents[2]
MANIFESTO = RAIZ / "artifacts" / "manifest.json"


def _snapshot_disponivel() -> bool:
    if not MANIFESTO.exists():
        return False
    dataset = json.loads(MANIFESTO.read_text(encoding="utf-8")).get("dataset") or {}
    return bool(dataset.get("snapshot")) and (RAIZ / dataset["snapshot"]).exists()


pytestmark = pytest.mark.skipif(
    not _snapshot_disponivel(), reason="snapshot ausente: rode python -m app.treino congelar"
)


def test_deriva_o_parquet_do_painel_sem_banco(tmp_path: Path) -> None:
    destino = tmp_path / "base_painel.parquet"
    assert painel.main(["--parquet", str(destino)]) == 0
    base = pd.read_parquet(destino)
    n = len(COLUNAS_COM_ALVO) + 1
    assert list(base.columns[:n]) == ["linha_origem", *COLUNAS_COM_ALVO]
    assert "IMC" in base.columns
    for col in COLUNAS_ESCALAS:
        rotulo = base[f"{col}_rotulo"]
        assert not rotulo.isnull().any()
        assert set(rotulo) <= set(ROTULOS_ESCALA[col].values())
    assert BasePainel.carregar(destino).total_global == len(base)


def test_resultado_igual_ao_de_congelar(tmp_path: Path) -> None:
    oficial = RAIZ / "data" / "processado" / "base_painel.parquet"
    if not oficial.exists():
        pytest.skip("base_painel.parquet de `congelar` ausente")
    destino = tmp_path / "base_painel.parquet"
    painel.derivar(MANIFESTO, destino)
    pd.testing.assert_frame_equal(pd.read_parquet(destino), pd.read_parquet(oficial))


def test_falha_sem_snapshot_no_manifest(tmp_path: Path) -> None:
    manifesto = tmp_path / "manifest.json"
    manifesto.write_text(json.dumps({"dataset": {}}), encoding="utf-8")
    saida = tmp_path / "x.parquet"
    assert painel.main(["--manifesto", str(manifesto), "--parquet", str(saida)]) == 1
    assert not saida.exists()
