"""O CLI de treino de ponta a ponta, numa pasta temporária: congelar -> treinar -> verificar.

É o aceite de F5 em forma de teste: o mesmo snapshot (mesmo versao_dados), as mesmas métricas
que o manifest publicado e as mesmas predições de ouro — sha256 exato na plataforma do treino,
tolerância medida entre plataformas (ADR 0004).
"""

from __future__ import annotations

import json
import platform
import shutil
from pathlib import Path

import pytest

from app.treino.__main__ import (
    TOLERANCIA_PROBAS_ENTRE_PLATAFORMAS,
    construir_parser,
    main,
    manifest_vazio,
)

DADOS_OURO = Path(__file__).resolve().parent / "dados_ouro"


def test_gramatica_do_cli_tem_os_cinco_subcomandos() -> None:
    parser = construir_parser()
    sub = next(a for a in parser._actions if getattr(a, "choices", None))
    assert set(sub.choices) == {"congelar", "snapshot", "treinar", "agregados", "verificar"}
    args = parser.parse_args(["treinar", "--versao", "9.9.9"])
    assert args.binning is False and args.imc is True  # ADRs 0002 e 0003
    with pytest.raises(SystemExit):
        parser.parse_args(["treinar"])  # --versao é obrigatório


def test_manifest_vazio_nao_tem_metrica_preenchida() -> None:
    m = manifest_vazio()
    assert m["metricas_teste"] == {"acuracia": None, "f1_macro": None, "recall_risco": None}
    assert m["n_features_entrada"] == 16 and m["n_features_modelo"] is None


def test_verificar_sem_manifest_treinado_falha(tmp_path: Path, capsys) -> None:
    assert main(["verificar", "--manifesto", str(tmp_path / "nao-existe.json")]) == 1
    assert "rode" in capsys.readouterr().out


@pytest.mark.banco
def test_congelar_treinar_verificar_em_pasta_temporaria(
    tmp_path: Path, dsn: str, manifest: dict, capsys
) -> None:
    manifesto = tmp_path / "manifest.json"
    comuns = ["--manifesto", str(manifesto), "--banco-url", dsn]
    ouro = tmp_path / "ouro"
    ouro.mkdir()
    shutil.copy(DADOS_OURO / "entradas.json", ouro / "entradas.json")

    assert (
        main(
            [
                "congelar",
                *comuns,
                "--processado",
                str(tmp_path / "proc"),
                "--agregados",
                str(tmp_path / "agg"),
                "--parquet",
                str(tmp_path / "proc" / "base_painel.parquet"),
            ]
        )
        == 0
    )
    congelado = json.loads(manifesto.read_text(encoding="utf-8"))
    assert congelado["dataset"]["versao_dados"] == manifest["dataset"]["versao_dados"]
    assert congelado["dataset"]["sha256_conteudo"] == manifest["dataset"]["sha256_conteudo"]
    assert (tmp_path / "proc" / "base_painel.parquet").exists()

    assert (
        main(
            [
                "treinar",
                "--versao",
                "0.0.0",
                *comuns,
                "--saida",
                str(tmp_path / "models"),
                "--metricas",
                str(tmp_path / "met"),
                "--distribuicao",
                str(tmp_path / "dist.json"),
                "--dados-ouro",
                str(ouro),
                "--sem-anotar-banco",
            ]
        )
        == 0
    )
    treinado = json.loads(manifesto.read_text(encoding="utf-8"))
    assert (tmp_path / "models" / "modelo-0.0.0.pkl").exists()
    assert treinado["algoritmo"] == manifest["algoritmo"]
    assert treinado["n_features_modelo"] == manifest["n_features_modelo"]
    # Na plataforma em que o artefato publicado foi treinado, o retreino é bit a bit igual.
    # Noutra (o CI em Linux contra um treino em Windows), o XGBoost diverge nas probabilidades,
    # com classes e métricas iguais: vale a tolerância medida (ADR 0004).
    if platform.system() == manifest["ambiente"]["sistema"]:
        assert treinado["sha256_predicoes_ouro"] == manifest["sha256_predicoes_ouro"]
    for chave in ("acuracia", "f1_macro", "recall_risco"):
        assert treinado["metricas_teste"][chave] == pytest.approx(
            manifest["metricas_teste"][chave], abs=1e-6
        )
    assert (ouro / "saidas_esperadas.json").exists()
    novas = json.loads((ouro / "saidas_esperadas.json").read_text(encoding="utf-8"))
    oficiais = json.loads((DADOS_OURO / "saidas_esperadas.json").read_text(encoding="utf-8"))
    for nova, oficial in zip(novas, oficiais, strict=True):
        assert nova["classe_prevista"] == oficial["classe_prevista"]
        for classe, p in oficial["probabilidades"].items():
            assert nova["probabilidades"][classe] == pytest.approx(
                p, abs=TOLERANCIA_PROBAS_ENTRE_PLATAFORMAS
            )
    assert (tmp_path / "met" / "comparacao-candidatos.json").exists()
    assert json.loads((tmp_path / "dist.json").read_text(encoding="utf-8"))["n_treino"] == 2111

    assert main(["verificar", *comuns, "--dados-ouro", str(ouro)]) == 0
    assert "OK:" in capsys.readouterr().out


@pytest.mark.banco
def test_agregados_isolado_confere_a_carga(tmp_path: Path, dsn: str) -> None:
    """Fora da transação de `congelar`, o materializador confere a carga contra o snapshot."""
    manifesto = tmp_path / "manifest.json"
    comuns = ["--manifesto", str(manifesto), "--banco-url", dsn]
    assert (
        main(
            [
                "snapshot",
                *comuns,
                "--processado",
                str(tmp_path / "proc"),
                "--agregados",
                str(tmp_path / "agg"),
                "--parquet",
                str(tmp_path / "proc" / "base_painel.parquet"),
            ]
        )
        == 0
    )
    assert (
        main(
            [
                "agregados",
                *comuns,
                "--processado",
                str(tmp_path / "proc"),
                "--agregados",
                str(tmp_path / "agg"),
                "--parquet",
                str(tmp_path / "proc" / "base_painel.parquet"),
            ]
        )
        == 0
    )
    assert (tmp_path / "proc" / "base_painel.parquet").exists()
