"""Fixtures da vertente diabetes, ao lado das de tests/conftest.py: o `cliente` é o mesmo app.

O artefato é o de verdade (models/modelo-diabetes-<versao>.pkl, baixado do release ou treinado),
pelo mesmo motivo da vertente de obesidade: um mock de `predict_proba` esconde os erros de forma.
"""

from __future__ import annotations

import json
from pathlib import Path
from typing import Any

import pytest

RAIZ = Path(__file__).resolve().parents[3]
DADOS_OURO_DIABETES = Path(__file__).resolve().parent / "dados_ouro"
MANIFEST_DIABETES = RAIZ / "artifacts" / "diabetes" / "manifest.json"
URL_DIABETES = "/api/v1/diabetes"

ENTRADA_PADRAO_DIABETES: dict[str, Any] = json.loads(
    (DADOS_OURO_DIABETES / "entradas.json").read_text(encoding="utf-8")
)[0]


@pytest.fixture(scope="session")
def manifest_diabetes() -> dict[str, Any]:
    manifest = dict(json.loads(MANIFEST_DIABETES.read_text(encoding="utf-8")))
    if not manifest.get("versao"):
        pytest.skip("manifest da vertente sem modelo: rode python -m app.diabetes.treino treinar")
    return manifest


@pytest.fixture(scope="session")
def artefato_diabetes(cliente: Any) -> Any:
    registro = cliente.app.state.registro_diabetes
    assert registro is not None, (
        "o artefato da vertente diabetes não carregou: baixe-o do release "
        "(scripts/baixar_modelo.py --manifesto artifacts/diabetes/manifest.json) ou treine "
        "(python -m app.diabetes.treino treinar)"
    )
    return registro.padrao
