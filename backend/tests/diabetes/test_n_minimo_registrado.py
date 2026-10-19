"""N_MINIMO_DERIVA_DIABETES: o valor do compose e do .env.example é o da medição registrada.

A medição é a da ADR 0008 (tools/medir_n_minimo_deriva.py --vertente diabetes), registrada em
artifacts/diabetes/metricas/n-minimo-deriva.json com a grade inteira. Este teste é o portão de
"nenhum número escrito à mão": o valor que sobe com a API tem de ser o do registro, o registro tem
de descrever os dados do manifest, e o n escolhido tem de ser o menor da grade que cumpre o
critério.
"""

from __future__ import annotations

import json
import re
from typing import Any

import pytest

from app.diabetes.dominio.features import ENTRADAS
from tests.diabetes.conftest import RAIZ

REGISTRO = RAIZ / "artifacts" / "diabetes" / "metricas" / "n-minimo-deriva.json"


@pytest.fixture(scope="module")
def registro() -> dict[str, Any]:
    return dict(json.loads(REGISTRO.read_text(encoding="utf-8")))


def test_o_registro_descreve_os_dados_do_manifest(
    registro: dict[str, Any], manifest_diabetes: dict
) -> None:
    assert registro["vertente"] == "diabetes"
    assert registro["versao_dados"] == manifest_diabetes["dataset"]["versao_dados"]
    assert registro["versao_modelo"] == manifest_diabetes["versao"]
    assert registro["linhas_snapshot"] == manifest_diabetes["dataset"]["linhas"]
    assert registro["imc_arredondado"] is True


def test_o_n_minimo_e_o_menor_da_grade_que_cumpre_o_criterio(registro: dict[str, Any]) -> None:
    limiar = registro["limiar_psi"]
    cumpre = [n for n in registro["grade"] if max(registro["psi_p95"][str(n)].values()) < limiar]
    assert cumpre and registro["n_minimo"] == cumpre[0]
    for n in registro["grade"]:
        assert set(registro["psi_p95"][str(n)]) == set(ENTRADAS), n


def test_compose_e_env_example_usam_o_valor_registrado(registro: dict[str, Any]) -> None:
    compose = (RAIZ / "docker-compose.yml").read_text(encoding="utf-8")
    exemplo = (RAIZ / ".env.example").read_text(encoding="utf-8")
    no_compose = re.findall(r'^\s*N_MINIMO_DERIVA_DIABETES:\s*"(\d+)"', compose, re.M)
    no_exemplo = re.findall(r"^N_MINIMO_DERIVA_DIABETES=(\d+)$", exemplo, re.M)
    assert no_compose == [str(registro["n_minimo"])]
    assert no_exemplo == [str(registro["n_minimo"])]
