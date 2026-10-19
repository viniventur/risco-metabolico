"""`python -m app.diabetes.treino.agregar`: os agregados SQL e a base do painel, a partir do banco.

Prova que os JSON commitados em artifacts/diabetes/agregados/ são os que o SQL produz hoje sobre a
carga que o snapshot congelou (só `gerado_em` muda entre execuções), e que a conferência de carga
(§6.7.4) recusa um snapshot que o banco não registrou. Marcado `banco`: o CI semeia a tabela e roda
`python -m app.diabetes.treino snapshot` antes da suíte.
"""

from __future__ import annotations

import json
from pathlib import Path
from typing import Any

import pandas as pd
import pytest

from app.diabetes.treino import agregar
from app.treino.agregar import ContratoViolado
from tests.diabetes.conftest import RAIZ

ARTEFATOS = RAIZ / "artifacts" / "diabetes" / "agregados"


def _sem_carimbo(doc: dict[str, Any]) -> dict[str, Any]:
    return {k: v for k, v in doc.items() if k != "gerado_em"}


@pytest.mark.banco
def test_materializa_os_cinco_iguais_aos_commitados(tmp_path: Path, dsn: str) -> None:
    destino, parquet = tmp_path / "agregados", tmp_path / "base_painel.parquet"
    argumentos = ["--banco-url", dsn, "--agregados", str(destino), "--parquet", str(parquet)]
    assert agregar.main(argumentos) == 0
    escritos = sorted(p.name for p in destino.glob("*.json"))
    assert escritos == sorted(p.name for p in ARTEFATOS.glob("*.json"))
    for nome in escritos:
        novo = json.loads((destino / nome).read_text(encoding="utf-8"))
        commitado = json.loads((ARTEFATOS / nome).read_text(encoding="utf-8"))
        assert _sem_carimbo(novo) == _sem_carimbo(commitado), nome
    oficial = RAIZ / "data" / "processado" / "diabetes" / "base_painel.parquet"
    if oficial.exists():
        pd.testing.assert_frame_equal(pd.read_parquet(parquet), pd.read_parquet(oficial))


@pytest.mark.banco
def test_conferir_carga_recusa_snapshot_que_o_banco_nao_registrou(conexao: Any) -> None:
    with pytest.raises(ContratoViolado, match="sem snapshot registrado"):
        agregar.conferir_carga(conexao, "000000000000")


def test_listar_recusa_pasta_sem_sql(tmp_path: Path) -> None:
    with pytest.raises(ContratoViolado, match="ausentes ou repetidos"):
        agregar.listar(tmp_path)


def test_main_falha_sem_snapshot_no_manifest(tmp_path: Path, capsys: pytest.CaptureFixture) -> None:
    manifesto = tmp_path / "manifest.json"
    manifesto.write_text(json.dumps({"dataset": {}}), encoding="utf-8")
    assert agregar.main(["--manifesto", str(manifesto)]) == 1
    assert "dataset.snapshot" in capsys.readouterr().out
