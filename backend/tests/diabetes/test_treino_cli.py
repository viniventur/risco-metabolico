"""O CLI de treino da vertente diabetes de ponta a ponta, em pasta temporária: treinar -> verificar.

Não precisa de banco: `treinar` e `verificar` leem o snapshot congelado do disco (o CI o gera com
`snapshot` antes da suíte). É o aceite da F3 em forma de teste: as mesmas métricas e o mesmo limiar
do manifest publicado e as mesmas predições de ouro — sha256 exato na plataforma do treino, a
tolerância medida (artifacts/diabetes/metricas/reprodutibilidade.json) noutra.
"""

from __future__ import annotations

import json
import platform
import shutil
from pathlib import Path

import pytest

from app.diabetes.dominio.features import ENTRADAS
from app.diabetes.treino import avaliacao
from app.diabetes.treino.__main__ import (
    MODELOS_PADRAO,
    TOLERANCIA_METRICAS,
    TOLERANCIA_METRICAS_ENTRE_PLATAFORMAS,
    TOLERANCIA_PROBAS_ENTRE_PLATAFORMAS,
    construir_parser,
    escrever_manifest,
    main,
    manifest_vazio,
    metricas_comparaveis,
)
from tests.diabetes.conftest import DADOS_OURO_DIABETES, RAIZ

REPRODUTIBILIDADE = RAIZ / "artifacts" / "diabetes" / "metricas" / "reprodutibilidade.json"


def test_gramatica_do_cli_tem_os_tres_subcomandos() -> None:
    parser = construir_parser()
    sub = next(a for a in parser._actions if getattr(a, "choices", None))
    assert set(sub.choices) == {"snapshot", "treinar", "verificar"}
    args = parser.parse_args(["treinar", "--versao", "9.9.9"])
    assert args.saida == MODELOS_PADRAO and args.anotar_banco is True
    with pytest.raises(SystemExit):
        parser.parse_args(["treinar"])  # --versao é obrigatório


def test_manifest_vazio_tem_a_configuracao_e_nada_medido() -> None:
    m = manifest_vazio()
    assert m["entradas"] == ENTRADAS and m["n_features_entrada"] == 10
    assert m["alvo"] == {"coluna": "Diabetes", "positivo": "Sim"}
    assert m["limiar"]["criterio"] == avaliacao.CRITERIO_LIMIAR
    assert m["limiar"]["valor"] is None and m["metricas_teste"] is None
    assert m["versao"] is None and m["release"] is None and m["sha256"] is None


def test_verificar_sem_manifest_treinado_falha(tmp_path: Path, capsys) -> None:
    assert main(["verificar", "--manifesto", str(tmp_path / "nao-existe.json")]) == 1
    assert "rode" in capsys.readouterr().out


def test_tolerancias_cobrem_a_medicao_registrada(manifest_diabetes: dict) -> None:
    """As constantes do `verificar` não são palpite: cobrem o que a ferramenta mediu e registrou."""
    r = json.loads(REPRODUTIBILIDADE.read_text(encoding="utf-8"))
    assert r["versao_dados"] == manifest_diabetes["dataset"]["versao_dados"]
    assert r["base"] == {
        "sistema": manifest_diabetes["ambiente"]["sistema"],
        "semente": manifest_diabetes["hiperparametros"]["random_state"],
    }
    assert r["plataforma"]["sistema"] != r["base"]["sistema"]
    maior_desvio = max(
        r["teste"]["desvio_max_plataforma"],
        r["teste"]["desvio_max_sementes"],
        r["ouro"]["desvio_max_plataforma"],
        r["ouro"]["desvio_max_sementes"],
    )
    assert maior_desvio <= TOLERANCIA_PROBAS_ENTRE_PLATAFORMAS
    assert set(r["metricas"]) == set(metricas_comparaveis(manifest_diabetes))
    maior_metrica = max(max(v["plataforma"], v["sementes"]) for v in r["metricas"].values())
    assert maior_metrica <= TOLERANCIA_METRICAS_ENTRE_PLATAFORMAS
    # Os casos de ouro não mudam de classificação em nenhum dos treinos medidos.
    assert r["ouro"]["n"] == manifest_diabetes["dados_ouro"]["n"]
    assert r["ouro"]["classificacao_estavel"] and r["ouro"]["margem_minima"] > 0


def test_treinar_e_verificar_em_pasta_temporaria(
    tmp_path: Path, manifest_diabetes: dict, capsys
) -> None:
    if not (RAIZ / manifest_diabetes["dataset"]["snapshot"]).exists():
        pytest.skip("snapshot fora do disco: rode python -m app.diabetes.treino snapshot")
    manifesto = tmp_path / "manifest.json"
    esqueleto = manifest_vazio()
    esqueleto["dataset"] = manifest_diabetes["dataset"]  # o que `snapshot` escreveria
    escrever_manifest(manifesto, esqueleto)
    ouro = tmp_path / "ouro"
    ouro.mkdir()
    shutil.copy(DADOS_OURO_DIABETES / "entradas.json", ouro / "entradas.json")
    comuns = ["--manifesto", str(manifesto), "--dados-ouro", str(ouro)]

    argumentos = ["--saida", str(tmp_path / "models"), "--metricas", str(tmp_path / "met")]
    assert main(["treinar", "--versao", "0.0.0", *comuns, *argumentos, "--sem-anotar-banco"]) == 0
    treinado = json.loads(manifesto.read_text(encoding="utf-8"))
    assert (tmp_path / "models" / "modelo-diabetes-0.0.0.pkl").exists()
    assert treinado["release"] == "diabetes-v0.0.0" and treinado["n_features_modelo"] == 10
    assert {p.name for p in (tmp_path / "met").iterdir()} == {
        "pontos-de-operacao.json",
        "matriz-confusao.json",
        "por-grupo.json",
        "limiares-por-idade.json",
    }
    # Na plataforma em que o modelo publicado foi treinado, o retreino é bit a bit igual; noutra
    # (o CI em Linux contra um treino em Windows), vale a tolerância medida.
    mesma_plataforma = platform.system() == manifest_diabetes["ambiente"]["sistema"]
    if mesma_plataforma:
        assert treinado["sha256_predicoes_ouro"] == manifest_diabetes["sha256_predicoes_ouro"]
    tol_metricas = (
        TOLERANCIA_METRICAS if mesma_plataforma else TOLERANCIA_METRICAS_ENTRE_PLATAFORMAS
    )
    tol_probas = TOLERANCIA_METRICAS if mesma_plataforma else TOLERANCIA_PROBAS_ENTRE_PLATAFORMAS
    publicadas, refeitas = metricas_comparaveis(manifest_diabetes), metricas_comparaveis(treinado)
    for chave, valor in publicadas.items():
        assert refeitas[chave] == pytest.approx(valor, abs=tol_metricas), chave
    novas = json.loads((ouro / "saidas_esperadas.json").read_text(encoding="utf-8"))
    oficiais = json.loads(
        (DADOS_OURO_DIABETES / "saidas_esperadas.json").read_text(encoding="utf-8")
    )
    for nova, oficial in zip(novas, oficiais, strict=True):
        assert nova["risco_elevado"] == oficial["risco_elevado"]
        assert nova["probabilidade"] == pytest.approx(oficial["probabilidade"], abs=tol_probas)

    capsys.readouterr()
    assert main(["verificar", *comuns]) == 0
    assert "OK:" in capsys.readouterr().out

    # E acusa o que não é o que o pipeline produz: um limiar e um hiperparâmetro adulterados.
    adulterado = json.loads(manifesto.read_text(encoding="utf-8"))
    adulterado["limiar"]["valor"] += 0.05
    adulterado["hiperparametros"]["max_depth"] = 5
    escrever_manifest(manifesto, adulterado)
    assert main(["verificar", *comuns]) == 1
    saida = capsys.readouterr().out
    assert "FALHA" in saida and "limiar.valor" in saida and "hiperparametros" in saida
