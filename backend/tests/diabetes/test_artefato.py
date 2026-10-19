"""O artefato da vertente diabetes: carga conferida e cada recusa explícita (503, não silêncio)."""

from __future__ import annotations

import copy
import hashlib
import json
import logging
from pathlib import Path
from typing import Any

import joblib
import pytest

from app.diabetes.dominio.features import ENTRADAS
from app.diabetes.nucleo.artefato import ArtefatoDiabetes, RegistroDiabetes, ler_manifest
from app.nucleo.erros import ArtefatoIndisponivel, NaoEncontrado


def _gravar(pasta: Path, objeto: Any, manifest: dict) -> dict:
    """Grava o objeto como o .pkl do manifest e devolve o manifest com o sha256 dele."""
    pasta.mkdir(parents=True, exist_ok=True)
    caminho = pasta / manifest["arquivo"]
    joblib.dump(objeto, caminho)
    return {**manifest, "sha256": hashlib.sha256(caminho.read_bytes()).hexdigest()}


@pytest.fixture
def objeto(artefato_diabetes) -> dict:
    return {
        "pipeline": artefato_diabetes.pipeline,
        "colunas": list(ENTRADAS),
        "limiar": artefato_diabetes.limiar,
    }


def test_o_artefato_servido_e_o_do_manifest(artefato_diabetes, manifest_diabetes: dict) -> None:
    assert artefato_diabetes.versao == manifest_diabetes["versao"]
    assert artefato_diabetes.sha256_arquivo == manifest_diabetes["sha256"]
    assert artefato_diabetes.limiar == manifest_diabetes["limiar"]["valor"]
    assert artefato_diabetes.versao_dados == manifest_diabetes["dataset"]["versao_dados"]
    assert artefato_diabetes.colunas == ENTRADAS
    assert artefato_diabetes.n_features_modelo == manifest_diabetes["n_features_modelo"]
    assert artefato_diabetes.algoritmo == "XGBClassifier"
    assert artefato_diabetes.treinado_em == manifest_diabetes["treinado_em"]


def test_carga_conferida_a_partir_do_disco(tmp_path: Path, objeto: dict, manifest_diabetes) -> None:
    manifest = _gravar(tmp_path, objeto, manifest_diabetes)
    carregado = ArtefatoDiabetes.carregar(tmp_path, manifest, exigir_integridade=True)
    assert carregado.limiar == objeto["limiar"]
    registro = RegistroDiabetes(carregado)
    assert registro.obter() is carregado and registro.obter(carregado.versao) is carregado
    assert registro.versoes == [carregado.versao]
    with pytest.raises(NaoEncontrado):
        registro.obter("9.9.9")


def test_sha256_divergente_e_503_em_producao_e_aviso_em_desenvolvimento(
    tmp_path: Path, objeto: dict, manifest_diabetes: dict, caplog
) -> None:
    manifest = _gravar(tmp_path, objeto, manifest_diabetes) | {"sha256": "0" * 64}
    with pytest.raises(ArtefatoIndisponivel, match="sha256"):
        ArtefatoDiabetes.carregar(tmp_path, manifest, exigir_integridade=True)
    with caplog.at_level(logging.WARNING):
        ArtefatoDiabetes.carregar(tmp_path, manifest, exigir_integridade=False)
    assert "EXIGIR_INTEGRIDADE=false" in caplog.text


@pytest.mark.parametrize(
    ("mudanca", "mensagem"),
    [
        (lambda o, m: m.update(vertente="obesidade"), "vertente diabetes"),
        (lambda o, m: m.update(arquivo=None), "nenhum modelo"),
        (lambda o, m: o.pop("limiar"), "pipeline/colunas/limiar"),
        (lambda o, m: o.update(pipeline=object()), "predict_proba"),
        (lambda o, m: o.update(colunas=ENTRADAS[::-1]), "dez entradas"),
        (lambda o, m: o.update(limiar=0.5), "limiar"),
    ],
)
def test_cada_defeito_de_forma_e_recusado(
    tmp_path: Path, objeto: dict, manifest_diabetes: dict, mudanca, mensagem: str
) -> None:
    objeto = dict(objeto)
    manifest = copy.deepcopy(manifest_diabetes)
    mudanca(objeto, manifest)
    if manifest.get("arquivo"):
        manifest = _gravar(tmp_path, objeto, manifest)
    with pytest.raises(ArtefatoIndisponivel, match=mensagem):
        ArtefatoDiabetes.carregar(tmp_path, manifest, exigir_integridade=True)


def test_arquivo_ausente_e_manifest_ausente(tmp_path: Path, manifest_diabetes: dict) -> None:
    with pytest.raises(ArtefatoIndisponivel, match="não encontrado em MODELOS_DIR"):
        ArtefatoDiabetes.carregar(tmp_path, manifest_diabetes, exigir_integridade=True)
    with pytest.raises(ArtefatoIndisponivel, match="manifest da vertente diabetes"):
        ler_manifest(tmp_path)
    with pytest.raises(ArtefatoIndisponivel):
        RegistroDiabetes.carregar(tmp_path, tmp_path, exigir_integridade=True)
    (tmp_path / "manifest.json").write_text(json.dumps(manifest_diabetes), encoding="utf-8")
    assert ler_manifest(tmp_path)["vertente"] == "diabetes"
