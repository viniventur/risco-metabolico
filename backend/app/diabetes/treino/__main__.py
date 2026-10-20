"""CLI de treino da vertente diabetes: `python -m app.diabetes.treino <snapshot|treinar|verificar>`.

A gramática fechada da vertente de obesidade (`python -m app.treino`): nenhum caminho obrigatório,
todo default relativo à raiz do repositório, resolvido em código.

- `snapshot`: congela `dados.registros_diabetes` em data/processado/diabetes/, numa transação
  REPEATABLE READ, e registra o congelado no manifest da vertente
  (artifacts/diabetes/manifest.json) — o `versao_dados` que o treino vai citar.
- `treinar --versao X.Y.Z`: treina sobre o snapshot a configuração que o notebook 02 congelou
  (célula 38 e `CONGELADO_POR_IDADE`) — validação cruzada no treino, os limiares fora da dobra (o
  único, de referência, e o de cada grupo de idade, que classifica), o modelo no treino inteiro e
  a avaliação, uma vez, no teste —, serializa com joblib e escreve o manifest, as métricas e as
  saídas de ouro.
- `verificar`: retreina sobre o MESMO snapshot e compara configuração, limiares, métricas e
  predições de ouro com o manifest. Não escreve nada. É o que roda no CI.

O manifest da vertente é outro arquivo, e não uma chave no da obesidade: as duas vertentes são
versionadas, publicadas (release `diabetes-v<versao>`) e verificadas cada uma por si.
"""

from __future__ import annotations

import argparse
import hashlib
import json
import platform
import sys
import time
from dataclasses import dataclass
from datetime import UTC, datetime
from pathlib import Path
from typing import Any

import joblib
import numpy as np
import pandas as pd
from sklearn.pipeline import Pipeline

from app.config import CONFIG, RAIZ_REPOSITORIO
from app.diabetes.dados.seed import CSV_PADRAO, FONTE_REF
from app.diabetes.dominio.features import ALVO, ENTRADAS
from app.diabetes.dominio.predicao import montar_quadro
from app.diabetes.dominio.regras import classificar
from app.diabetes.treino import avaliacao, dados
from app.diabetes.treino import pipeline as pipe

ARTEFATOS = RAIZ_REPOSITORIO / "artifacts" / "diabetes"
MANIFESTO_PADRAO = ARTEFATOS / "manifest.json"
METRICAS_PADRAO = ARTEFATOS / "metricas"
MODELOS_PADRAO = RAIZ_REPOSITORIO / "models"
DADOS_OURO = RAIZ_REPOSITORIO / "backend" / "tests" / "diabetes" / "dados_ouro"
NOME_PROJETO = "risco-metabolico"
VERTENTE = "diabetes"
PREFIXO_RELEASE = "diabetes-v"
TOLERANCIA_METRICAS = 1e-6
# Reprodutibilidade ENTRE plataformas, medida na F3 da vertente (2026-10-19) por
# tools/medir_reprodutibilidade_diabetes.py e registrada em
# artifacts/diabetes/metricas/reprodutibilidade.json: o mesmo snapshot, os mesmos pacotes e a
# mesma semente dão, em Windows e em Linux, modelos diferentes — nenhuma das 50.736 probabilidades
# do teste sai igual bit a bit —, porque o XGBoost sorteia linhas e colunas com as distribuições
# da biblioteca padrão do C++, que cada compilador implementa a seu modo. A diferença é do tamanho
# da que uma troca de semente produz na mesma plataforma. Na MESMA plataforma do treino o critério
# é o sha256 exato das predições de ouro; noutra, a mesma classificação nos casos de ouro (todos
# longe do limiar do grupo deles) e estas tolerâncias, que cobrem com folga o registro — o teste
# test_tolerancias_cobrem_a_medicao_registrada confere. Os limiares (o único e o de cada grupo de
# idade, remedidos na versão 1.1.0) têm tolerância própria, mais estreita: o de 18 a 44 anos fica
# perto de 0,03, e a das métricas deixaria passar um terço dele; test_limiares_por_idade confere
# que ela cobre o registro.
TOLERANCIA_PROBAS_ENTRE_PLATAFORMAS = 0.10
TOLERANCIA_METRICAS_ENTRE_PLATAFORMAS = 0.01
TOLERANCIA_LIMIARES_ENTRE_PLATAFORMAS = 0.005


def e_limiar(chave: str) -> bool:
    """A chave achatada de `metricas_comparaveis` é o valor de um limiar (único ou de grupo)."""
    return chave == "limiar.valor" or (
        chave.startswith("limiares_por_idade.") and chave.endswith(".valor")
    )


def _relativo(caminho: Path) -> str:
    """Caminho relativo à raiz do repositório; fora dela (pastas temporárias de teste), absoluto."""
    caminho = caminho.resolve()
    try:
        return caminho.relative_to(RAIZ_REPOSITORIO).as_posix()
    except ValueError:
        return caminho.as_posix()


def manifest_vazio() -> dict[str, Any]:
    """O esqueleto do manifest da vertente: todo campo medido fica `null` até o CLI preenchê-lo."""
    return {
        "nome": NOME_PROJETO,
        "vertente": VERTENTE,
        "versao": None,
        "release": None,
        "arquivo": None,
        "sha256": None,
        "sha256_predicoes_ouro": None,
        "treinado_em": None,
        "algoritmo": None,
        "random_state": pipe.RANDOM_STATE,
        "alvo": {"coluna": ALVO, "positivo": "Sim"},
        "entradas": list(ENTRADAS),
        "n_features_entrada": len(ENTRADAS),
        "n_features_modelo": None,
        "dataset": {
            "tabela_origem": dados.TABELA_ORIGEM,
            "insumo_de_semeadura": _relativo(CSV_PADRAO),
            "proveniencia": FONTE_REF,
            "snapshot": None,
            "versao_dados": None,
            "sha256_snapshot": None,
            "sha256_conteudo": None,
            "sha256_carga": None,
            "pyarrow": None,
            "linhas": None,
            "colunas": None,
        },
        "split": {
            "test_size": pipe.TEST_SIZE,
            "stratify": True,
            "random_state": pipe.RANDOM_STATE,
            "linhas_treino": None,
            "linhas_teste": None,
            "prevalencia_treino": None,
            "prevalencia_teste": None,
        },
        "validacao_cruzada": {
            "n_splits": pipe.N_DOBRAS,
            "shuffle": True,
            "random_state": pipe.RANDOM_STATE,
            "roc_auc": None,
            "roc_auc_dp": None,
            "pr_auc": None,
            "pr_auc_dp": None,
            "brier": None,
        },
        "hiperparametros": None,
        "desbalanceamento": None,
        "calibracao": None,
        # O limiar único: o critério da D4 na base inteira. Desde a versão 1.1.0 é referência — a
        # classificação usa `limiares_por_idade`, o mesmo critério dentro de cada grupo de idade.
        "limiar": {
            "criterio": avaliacao.CRITERIO_LIMIAR,
            "recall_alvo": avaliacao.RECALL_ALVO,
            "valor": None,
            "fora_da_dobra": None,
        },
        "limiares_por_idade": {
            "criterio": avaliacao.CRITERIO_LIMIAR_POR_IDADE,
            "recall_alvo": avaliacao.RECALL_ALVO,
            "grupos": [
                {
                    "grupo": grupo,
                    "faixas_etarias": list(faixas),
                    "valor": None,
                    "fora_da_dobra": None,
                }
                for grupo, faixas in avaliacao.FAIXAS_POR_GRUPO.items()
            ],
            "fora_da_dobra": None,
        },
        "metricas_teste": None,
        "ambiente": None,
        "dados_ouro": None,
        "notebook_origem": "study/02_triagem_de_diabetes.ipynb",
    }


def ler_manifest(caminho: Path) -> dict[str, Any]:
    """O manifest existente, ou o esqueleto vazio na primeira execução."""
    if caminho.exists():
        return dict(json.loads(caminho.read_text(encoding="utf-8")))
    return manifest_vazio()


def escrever_json(caminho: Path, conteudo: Any) -> None:
    """Grava JSON em UTF-8, indentado, com LF e sem NaN — manifest, métricas e saídas de ouro."""
    caminho.parent.mkdir(parents=True, exist_ok=True)
    caminho.write_text(
        json.dumps(conteudo, ensure_ascii=False, indent=2, allow_nan=False) + "\n",
        encoding="utf-8",
        newline="\n",
    )


def escrever_manifest(caminho: Path, manifest: dict[str, Any]) -> None:
    """Grava o manifest em UTF-8, indentado, sem NaN."""
    escrever_json(caminho, manifest)


def _abrir_transacao_congelada(dsn: str) -> Any:
    """A transação do congelamento: REPEATABLE READ e as mesmas configurações de sessão."""
    import psycopg

    con = psycopg.connect(dsn)
    con.isolation_level = psycopg.IsolationLevel.REPEATABLE_READ
    con.execute("SET SESSION timezone = 'UTC'")
    con.execute("SET SESSION extra_float_digits = 3")
    con.execute("SET SESSION max_parallel_workers_per_gather = 0")
    return con


def registrar_snapshot_no_manifest(manifesto: Path, info: dados.InfoSnapshot) -> dict[str, Any]:
    """Escreve o bloco `dataset` do manifest a partir do snapshot recém-congelado."""
    import pyarrow

    manifest = ler_manifest(manifesto)
    manifest["dataset"].update(
        {
            "snapshot": _relativo(info.caminho),
            "versao_dados": info.versao_dados,
            "sha256_snapshot": info.sha256_arquivo,
            "sha256_conteudo": info.sha256_conteudo,
            "sha256_carga": info.sha256_carga,
            "pyarrow": pyarrow.__version__,
            "linhas": info.linhas,
            "colunas": info.colunas,
        }
    )
    escrever_manifest(manifesto, manifest)
    return manifest


def cmd_snapshot(args: argparse.Namespace) -> int:
    """Congela a tabela da vertente e registra o snapshot no manifest."""
    con = _abrir_transacao_congelada(args.banco_url or CONFIG.banco_url)
    try:
        info = dados.gerar_snapshot(con, args.processado)
        con.commit()
    finally:
        con.close()
    registrar_snapshot_no_manifest(args.manifesto, info)
    print(
        f"snapshot: {_relativo(info.caminho)} ({info.linhas} x {info.colunas}) "
        f"versao_dados={info.versao_dados}"
    )
    return 0


# ---- treino ----


@dataclass(frozen=True)
class Treino:
    """O que um treino da configuração congelada produz: o mesmo em `treinar` e `verificar`."""

    pipeline: Pipeline
    X_teste: pd.DataFrame
    y_teste: np.ndarray
    p_teste: np.ndarray
    linhas_treino: int
    prevalencia_treino: float
    prevalencia_teste: float
    validacao: dict[str, float]
    # O limiar único (referência) e o ponto dele fora da dobra, com a tabela de cada alvo.
    limiar: float
    no_limiar_fora: dict[str, float | int]
    pontos: list[dict[str, float | int]]
    # As predições fora da dobra do treino e a faixa etária de cada linha: a base dos limiares.
    y_treino: np.ndarray
    fora_da_dobra: np.ndarray
    idade_treino: np.ndarray
    # O limiar de cada grupo de idade (o que classifica), a tabela do manifest, o ponto total
    # fora da dobra com esses limiares e a estabilidade deles entre as dobras.
    limiares_idade: dict[str, float]
    grupos_idade: list[dict[str, Any]]
    no_limiares_idade_fora: dict[str, float | int]
    estabilidade_idade: dict[str, dict[str, list[float]]]
    metricas_teste: dict[str, float]
    probas_ouro: np.ndarray
    limiares_ouro: np.ndarray
    grupos_ouro: list[str]
    segundos: float


def treinar_configuracao(quadro: pd.DataFrame, casos_ouro: list[dict[str, Any]]) -> Treino:
    """Split, validação cruzada, limiares fora da dobra, modelo no treino inteiro e o teste."""
    inicio = time.perf_counter()
    X, y = pipe.separar(quadro)
    X_treino, X_teste, y_treino, y_teste = pipe.dividir(X, y)
    dobras = pipe.dobras(X_treino, y_treino)
    fora_da_dobra, validacao = avaliacao.validar(pipe.montar_pipeline, X_treino, y_treino, dobras)
    limiar = avaliacao.limiar_para_recall(y_treino, fora_da_dobra, avaliacao.RECALL_ALVO)
    idade_treino = X_treino["Faixa_Etaria"].to_numpy()
    limiares_idade = avaliacao.limiares_por_grupo(y_treino, fora_da_dobra, idade_treino)
    modelo = pipe.montar_pipeline().fit(X_treino, y_treino)
    p_teste = np.asarray(modelo.predict_proba(X_teste)[:, 1], dtype="float64")
    prevalencia_treino = float(y_treino.mean())
    quadro_ouro = montar_quadro(casos_ouro)
    probas_ouro = np.asarray(modelo.predict_proba(quadro_ouro)[:, 1], dtype="float64")
    idade_ouro = quadro_ouro["Faixa_Etaria"].to_numpy()
    return Treino(
        pipeline=modelo,
        X_teste=X_teste,
        y_teste=y_teste,
        p_teste=p_teste,
        linhas_treino=int(len(X_treino)),
        prevalencia_treino=prevalencia_treino,
        prevalencia_teste=float(y_teste.mean()),
        validacao=validacao,
        limiar=limiar,
        no_limiar_fora=avaliacao.ponto_de_operacao(y_treino, fora_da_dobra, limiar),
        pontos=avaliacao.pontos_de_operacao(y_treino, fora_da_dobra),
        y_treino=y_treino,
        fora_da_dobra=fora_da_dobra,
        idade_treino=idade_treino,
        limiares_idade=limiares_idade,
        grupos_idade=avaliacao.tabela_por_idade(
            y_treino, fora_da_dobra, idade_treino, limiares_idade
        ),
        no_limiares_idade_fora=avaliacao.contagens(
            y_treino, fora_da_dobra >= avaliacao.limiar_por_linha(idade_treino, limiares_idade)
        ),
        estabilidade_idade=avaliacao.estabilidade_por_idade(
            y_treino, fora_da_dobra, idade_treino, dobras
        ),
        metricas_teste=avaliacao.avaliar_teste(
            y_teste,
            p_teste,
            avaliacao.limiar_por_linha(X_teste["Faixa_Etaria"].to_numpy(), limiares_idade),
            prevalencia_treino,
        ),
        probas_ouro=probas_ouro,
        limiares_ouro=avaliacao.limiar_por_linha(idade_ouro, limiares_idade),
        grupos_ouro=[avaliacao.grupo_da_faixa(int(f)) for f in idade_ouro],
        segundos=round(time.perf_counter() - inicio, 1),
    )


def sha_probas(probas: np.ndarray) -> str:
    """O critério de reprodutibilidade: sha256 das probabilidades arredondadas a 6 casas."""
    return hashlib.sha256(np.round(np.asarray(probas, dtype="float64"), 6).tobytes()).hexdigest()


def saidas_de_ouro(
    probas: np.ndarray, limiares: np.ndarray, grupos: list[str]
) -> list[dict[str, Any]]:
    """O que a API tem de devolver para cada caso de ouro: probabilidade, limiar e classificação.

    O limiar de cada caso é o do grupo de idade dele.
    """
    return [
        {
            "probabilidade": round(float(p), 6),
            "limiar": float(t),
            "grupo_de_idade": grupo,
            "risco_elevado": bool(p >= t),
            "classificacao": classificar(float(p), float(t)),
        }
        for p, t, grupo in zip(probas, limiares, grupos, strict=True)
    ]


def fora_da_dobra_publicado(ponto: dict[str, float | int]) -> dict[str, float]:
    """O ponto de operação fora da dobra como o manifest o publica: só as quatro frações."""
    return {k: float(ponto[k]) for k in avaliacao.FRACOES}


def metricas_comparaveis(manifest: dict[str, Any]) -> dict[str, float]:
    """Os números que `verificar` confere, achatados como `secao.chave` (limiares incluídos)."""
    numeros = {"limiar.valor": float(manifest["limiar"]["valor"])}
    for chave, valor in (manifest["limiar"]["fora_da_dobra"] or {}).items():
        numeros[f"limiar.fora_da_dobra.{chave}"] = float(valor)
    por_idade = manifest.get("limiares_por_idade") or {}
    for grupo in por_idade.get("grupos") or []:
        if grupo.get("valor") is None:
            continue
        numeros[f"limiares_por_idade.{grupo['grupo']}.valor"] = float(grupo["valor"])
        for chave, valor in (grupo.get("fora_da_dobra") or {}).items():
            numeros[f"limiares_por_idade.{grupo['grupo']}.fora_da_dobra.{chave}"] = float(valor)
    for chave, valor in (por_idade.get("fora_da_dobra") or {}).items():
        numeros[f"limiares_por_idade.fora_da_dobra.{chave}"] = float(valor)
    for chave in ("roc_auc", "roc_auc_dp", "pr_auc", "pr_auc_dp", "brier"):
        numeros[f"validacao_cruzada.{chave}"] = float(manifest["validacao_cruzada"][chave])
    for chave, valor in (manifest["metricas_teste"] or {}).items():
        if chave != "precisao_fixa":  # parâmetro de leitura, não medida
            numeros[f"metricas_teste.{chave}"] = float(valor)
    return numeros


def numeros_do_treino(t: Treino) -> dict[str, Any]:
    """O esqueleto do manifest com o que um treino mede: a base de `metricas_comparaveis`."""
    numeros = manifest_vazio()
    numeros["validacao_cruzada"].update(t.validacao)
    numeros["limiar"].update(
        {"valor": t.limiar, "fora_da_dobra": fora_da_dobra_publicado(t.no_limiar_fora)}
    )
    numeros["limiares_por_idade"].update(
        {
            "grupos": t.grupos_idade,
            "fora_da_dobra": fora_da_dobra_publicado(t.no_limiares_idade_fora),
        }
    )
    numeros["metricas_teste"] = t.metricas_teste
    return numeros


def registro_por_idade(t: Treino, versao: str) -> dict[str, Any]:
    """`metricas/limiares-por-idade.json`: a escolha dos limiares por grupo e o preço dela.

    Cada grupo fora da dobra (a base da escolha) e no teste (uma vez, para medir), com o limiar
    único ao lado; a estabilidade entre as dobras; e o preço de cada alvo de recall.
    """
    idade_teste = t.X_teste["Faixa_Etaria"].to_numpy()
    grupos: list[dict[str, Any]] = []
    for linha in t.grupos_idade:
        nome, valor = linha["grupo"], float(linha["valor"])
        no_treino = np.isin(t.idade_treino, linha["faixas_etarias"])
        no_teste = np.isin(idade_teste, linha["faixas_etarias"])
        y_tr, p_tr = t.y_treino[no_treino], t.fora_da_dobra[no_treino]
        y_te, p_te = t.y_teste[no_teste], t.p_teste[no_teste]
        grupos.append(
            {
                "grupo": nome,
                "faixas_etarias": linha["faixas_etarias"],
                "n_treino": int(no_treino.sum()),
                "casos_treino": int(y_tr.sum()),
                "prevalencia_treino": float(y_tr.mean()),
                "probabilidade_media_fora_da_dobra": float(p_tr.mean()),
                "limiar": valor,
                "fora_da_dobra": fora_da_dobra_publicado(avaliacao.contagens(y_tr, p_tr >= valor)),
                "fora_da_dobra_limiar_unico": fora_da_dobra_publicado(
                    avaliacao.contagens(y_tr, p_tr >= t.limiar)
                ),
                "estabilidade": t.estabilidade_idade[nome],
                "teste": fora_da_dobra_publicado(avaliacao.contagens(y_te, p_te >= valor)),
                "teste_limiar_unico": fora_da_dobra_publicado(
                    avaliacao.contagens(y_te, p_te >= t.limiar)
                ),
            }
        )
    limiares_teste = avaliacao.limiar_por_linha(idade_teste, t.limiares_idade)
    return {
        "versao": versao,
        "criterio": avaliacao.CRITERIO_LIMIAR_POR_IDADE,
        "base": "predições fora da dobra do treino (a escolha); o teste, uma vez, para medir",
        "limiar_unico": t.limiar,
        "grupos": grupos,
        "total": {
            "fora_da_dobra": fora_da_dobra_publicado(t.no_limiares_idade_fora),
            "fora_da_dobra_limiar_unico": fora_da_dobra_publicado(t.no_limiar_fora),
            "teste": fora_da_dobra_publicado(
                avaliacao.contagens(t.y_teste, t.p_teste >= limiares_teste)
            ),
            "teste_limiar_unico": fora_da_dobra_publicado(
                avaliacao.contagens(t.y_teste, t.p_teste >= t.limiar)
            ),
        },
        "pontos": avaliacao.pontos_por_idade(t.y_treino, t.fora_da_dobra, t.idade_treino),
    }


def ambiente_do_treino() -> dict[str, str]:
    """Python, sistema e as versões dos pacotes que fazem o modelo, como o manifest os registra."""
    import numpy
    import pandas
    import pyarrow
    import sklearn
    import xgboost

    return {
        "python": platform.python_version(),
        "sistema": platform.system(),
        "scikit-learn": sklearn.__version__,
        "xgboost": xgboost.__version__,
        "numpy": numpy.__version__,
        "pandas": pandas.__version__,
        "pyarrow": pyarrow.__version__,
        "joblib": joblib.__version__,
    }


def _resolver_snapshot(manifest: dict[str, Any], override: Path | None) -> Path:
    """Nunca glob: o caminho vem de `dataset.snapshot` do manifest, e a falha diz qual esperava."""
    if override is not None:
        return override
    relativo = manifest.get("dataset", {}).get("snapshot")
    if not relativo:
        raise SystemExit(
            "manifest sem dataset.snapshot: rode `python -m app.diabetes.treino snapshot` antes"
        )
    caminho = Path(relativo)
    if not caminho.is_absolute():  # pastas temporárias de teste gravam caminho absoluto
        caminho = RAIZ_REPOSITORIO / relativo
    if not caminho.exists():
        raise SystemExit(
            f"snapshot esperado em {relativo} não existe: "
            "rode `python -m app.diabetes.treino snapshot`"
        )
    return caminho


def _carregar(manifest: dict[str, Any], override: Path | None) -> pd.DataFrame:
    caminho = _resolver_snapshot(manifest, override)
    return dados.carregar_snapshot(
        caminho, sha256_esperado=manifest["dataset"].get("sha256_snapshot")
    )


def _casos_de_ouro(pasta: Path) -> list[dict[str, Any]]:
    return list(json.loads((pasta / "entradas.json").read_text(encoding="utf-8")))


def _anotar_versao_no_snapshot(dsn: str, versao: str, versao_dados: str) -> None:
    """`operacao.snapshot_treino.versao_modelo` é preenchido pelo treino; sem banco, só avisa."""
    try:
        import psycopg

        with psycopg.connect(dsn, connect_timeout=5) as con:
            con.execute(
                "UPDATE operacao.snapshot_treino SET versao_modelo = %s WHERE versao_dados = %s",
                (versao, versao_dados),
            )
            con.commit()
    except Exception as erro:  # noqa: BLE001 — o treino não depende do banco
        print(
            f"aviso: versao_modelo não anotada em operacao.snapshot_treino ({type(erro).__name__})"
        )


def cmd_treinar(args: argparse.Namespace) -> int:
    """Treina a configuração congelada, serializa o modelo e escreve manifest e métricas."""
    existente = ler_manifest(args.manifesto)
    quadro = _carregar(existente, args.snapshot)
    casos = _casos_de_ouro(args.dados_ouro)
    print(
        f"snapshot {existente['dataset']['versao_dados']}: {len(quadro)} linhas | "
        f"{len(ENTRADAS)} entradas | {pipe.ALGORITMO} {pipe.HIPERPARAMETROS}"
    )
    t = treinar_configuracao(quadro, casos)

    # O manifest é refeito a partir do esqueleto (a ordem das chaves é a dele); do existente só
    # vem o bloco `dataset`, que `snapshot` escreveu.
    manifest = manifest_vazio()
    manifest["dataset"] = existente["dataset"]
    arquivo = f"modelo-{VERTENTE}-{args.versao}.pkl"
    manifest.update(
        {
            "versao": args.versao,
            "release": f"{PREFIXO_RELEASE}{args.versao}",
            "arquivo": arquivo,
            "sha256": None,  # integridade de transporte: preenchido depois do dump
            "sha256_predicoes_ouro": sha_probas(t.probas_ouro),
            "treinado_em": datetime.now(UTC).isoformat(timespec="seconds"),
            "algoritmo": pipe.ALGORITMO,
            "n_features_modelo": pipe.largura_do_modelo(t.pipeline),
            "hiperparametros": dict(pipe.HIPERPARAMETROS),
            "desbalanceamento": pipe.DESBALANCEAMENTO,
            "calibracao": pipe.CALIBRACAO,
            "metricas_teste": t.metricas_teste,
            "ambiente": ambiente_do_treino(),
            "dados_ouro": {
                "entradas": "backend/tests/diabetes/dados_ouro/entradas.json",
                "n": len(casos),
            },
        }
    )
    manifest["split"].update(
        {
            "linhas_treino": t.linhas_treino,
            "linhas_teste": int(len(t.X_teste)),
            "prevalencia_treino": t.prevalencia_treino,
            "prevalencia_teste": t.prevalencia_teste,
        }
    )
    medidos = numeros_do_treino(t)
    for secao in ("validacao_cruzada", "limiar", "limiares_por_idade"):
        manifest[secao] = medidos[secao]

    escrever_json(
        args.dados_ouro / "saidas_esperadas.json",
        saidas_de_ouro(t.probas_ouro, t.limiares_ouro, t.grupos_ouro),
    )
    # O manifest embutido torna o artefato autodescritivo fora do repositório; ele não pode
    # conter o hash do próprio arquivo (circular), então viaja com `sha256: null`. A tabela dos
    # limiares por idade viaja no artefato: é ela que classifica (o `limiar` único é referência).
    objeto = {
        "pipeline": t.pipeline,
        "colunas": list(ENTRADAS),
        "limiar": t.limiar,
        "limiares_por_idade": [
            {k: g[k] for k in ("grupo", "faixas_etarias", "valor")} for g in t.grupos_idade
        ],
        "manifest": dict(manifest),
    }
    args.saida.mkdir(parents=True, exist_ok=True)
    destino = args.saida / arquivo
    joblib.dump(objeto, destino, compress=3)
    manifest["sha256"] = dados.sha256_de(destino)
    escrever_manifest(args.manifesto, manifest)

    # O limiar único segue com a tabela de preço dele; matriz e grupos medem a regra que
    # classifica (o limiar do grupo de idade de cada pessoa), e a escolha dela tem registro próprio.
    limiares_teste = avaliacao.limiar_por_linha(
        t.X_teste["Faixa_Etaria"].to_numpy(), t.limiares_idade
    )
    escrever_json(
        args.metricas / "pontos-de-operacao.json",
        {"versao": args.versao, "base": "predições fora da dobra do treino", "pontos": t.pontos},
    )
    escrever_json(
        args.metricas / "matriz-confusao.json",
        {
            "versao": args.versao,
            "limiares": t.limiares_idade,
            **avaliacao.matriz_confusao(t.y_teste, t.p_teste, limiares_teste),
        },
    )
    escrever_json(
        args.metricas / "por-grupo.json",
        {
            "versao": args.versao,
            "limiares": t.limiares_idade,
            "grupos": avaliacao.por_grupo(t.X_teste, t.y_teste, t.p_teste, limiares_teste),
        },
    )
    escrever_json(args.metricas / "limiares-por-idade.json", registro_por_idade(t, args.versao))
    if args.anotar_banco:
        _anotar_versao_no_snapshot(
            args.banco_url or CONFIG.banco_url, args.versao, manifest["dataset"]["versao_dados"]
        )
    m = t.metricas_teste
    print(
        f"validação cruzada: roc_auc={t.validacao['roc_auc']:.4f} "
        f"pr_auc={t.validacao['pr_auc']:.4f} brier={t.validacao['brier']:.4f} ({t.segundos}s)"
    )
    print(
        f"limiar único={t.limiar:.6f} (referência) | por idade: "
        + ", ".join(f"{g} {v:.6f}" for g, v in t.limiares_idade.items())
        + f" (recall fora da dobra {t.no_limiares_idade_fora['recall']:.4f})"
    )
    print(
        f"teste: roc_auc={m['roc_auc']:.4f} pr_auc={m['pr_auc']:.4f} brier={m['brier']:.4f} "
        f"recall={m['recall_no_limiar']:.4f} precisao={m['precisao_no_limiar']:.4f} "
        f"encaminhados={m['encaminhados_no_limiar']:.4f}"
    )
    print(
        f"artefato: {_relativo(destino)} sha256={manifest['sha256'][:12]}… "
        f"largura={manifest['n_features_modelo']} | manifest: {_relativo(args.manifesto)} | "
        f"métricas: {_relativo(args.metricas)}"
    )
    return 0


def _comparar_com_saidas_esperadas(
    probas: np.ndarray, limiares: np.ndarray, saidas_esperadas: Path
) -> list[str]:
    """Critério entre plataformas: mesma classificação e probabilidade dentro da tolerância.

    Cada caso é classificado pelo limiar do grupo de idade dele, como a API o classifica.
    """
    if not saidas_esperadas.exists():
        return [f"{saidas_esperadas.name} ausente ao lado de entradas.json: rode `treinar` antes"]
    esperadas = json.loads(saidas_esperadas.read_text(encoding="utf-8"))
    if len(esperadas) != len(probas):
        return [f"saidas_esperadas.json tem {len(esperadas)} casos; entradas.json, {len(probas)}"]
    falhas: list[str] = []
    desvio_max = 0.0
    for i, (p, t, esperado) in enumerate(zip(probas, limiares, esperadas, strict=True)):
        if bool(p >= t) != bool(esperado["risco_elevado"]):
            falhas.append(f"caso {i}: risco_elevado {bool(p >= t)} ≠ esperado")
        desvio_max = max(desvio_max, abs(float(p) - float(esperado["probabilidade"])))
    if desvio_max > TOLERANCIA_PROBAS_ENTRE_PLATAFORMAS:
        falhas.append(
            f"probabilidades de ouro: desvio máximo {desvio_max:.6f} acima da tolerância "
            f"{TOLERANCIA_PROBAS_ENTRE_PLATAFORMAS} entre plataformas"
        )
    else:
        print(f"probabilidades de ouro: desvio máximo {desvio_max:.6f} entre plataformas")
    return falhas


def cmd_verificar(args: argparse.Namespace) -> int:
    """Retreina sobre o MESMO snapshot e compara com o manifest; não escreve nada."""
    manifest = ler_manifest(args.manifesto)
    faltantes = [k for k in ("versao", "algoritmo", "sha256_predicoes_ouro") if not manifest.get(k)]
    if faltantes:
        print(
            f"FALHA: manifest sem {faltantes}: rode `python -m app.diabetes.treino treinar` antes"
        )
        return 1
    falhas: list[str] = []
    configuracao = {
        "algoritmo": pipe.ALGORITMO,
        "hiperparametros": pipe.HIPERPARAMETROS,
        "entradas": ENTRADAS,
        "desbalanceamento": pipe.DESBALANCEAMENTO,
        "calibracao": pipe.CALIBRACAO,
    }
    for chave, no_codigo in configuracao.items():
        if manifest.get(chave) != no_codigo:
            falhas.append(f"{chave}: manifest {manifest.get(chave)!r} ≠ código {no_codigo!r}")
    if manifest["limiar"].get("criterio") != avaliacao.CRITERIO_LIMIAR:
        falhas.append("limiar.criterio do manifest ≠ o critério do código")
    por_idade = manifest.get("limiares_por_idade") or {}
    if por_idade.get("criterio") != avaliacao.CRITERIO_LIMIAR_POR_IDADE:
        falhas.append("limiares_por_idade.criterio do manifest ≠ o critério do código")
    grupos = {g["grupo"]: g["faixas_etarias"] for g in por_idade.get("grupos") or []}
    if grupos != avaliacao.FAIXAS_POR_GRUPO:
        falhas.append(
            f"limiares_por_idade.grupos: manifest {grupos!r} ≠ código "
            f"{avaliacao.FAIXAS_POR_GRUPO!r}"
        )

    t = treinar_configuracao(_carregar(manifest, args.snapshot), _casos_de_ouro(args.dados_ouro))
    sistema_do_treino = str((manifest.get("ambiente") or {}).get("sistema") or "")
    if platform.system() == sistema_do_treino:
        tolerancia = tolerancia_limiares = TOLERANCIA_METRICAS
        criterio = "sha256 exato das predições de ouro (mesma plataforma do treino)"
        sha = sha_probas(t.probas_ouro)
        if sha != manifest["sha256_predicoes_ouro"]:
            falhas.append(
                f"sha256 das predições de ouro: manifest "
                f"{manifest['sha256_predicoes_ouro'][:12]}… ≠ retreino {sha[:12]}…"
            )
    else:
        tolerancia = TOLERANCIA_METRICAS_ENTRE_PLATAFORMAS
        tolerancia_limiares = TOLERANCIA_LIMIARES_ENTRE_PLATAFORMAS
        criterio = (
            f"classificação igual, probabilidades a {TOLERANCIA_PROBAS_ENTRE_PLATAFORMAS}, "
            f"limiares a {TOLERANCIA_LIMIARES_ENTRE_PLATAFORMAS} e métricas a "
            f"{TOLERANCIA_METRICAS_ENTRE_PLATAFORMAS} "
            f"({sistema_do_treino or 'plataforma desconhecida'} → {platform.system()})"
        )
        falhas += _comparar_com_saidas_esperadas(
            t.probas_ouro, t.limiares_ouro, args.dados_ouro / "saidas_esperadas.json"
        )

    publicadas = metricas_comparaveis(manifest)
    refeitas = metricas_comparaveis(numeros_do_treino(t))
    if set(publicadas) != set(refeitas):
        falhas.append(
            f"métricas do manifest ≠ do código: {sorted(set(publicadas) ^ set(refeitas))}"
        )
    for chave in sorted(set(publicadas) & set(refeitas)):
        limite = tolerancia_limiares if e_limiar(chave) else tolerancia
        if abs(publicadas[chave] - refeitas[chave]) > limite:
            falhas.append(
                f"{chave}: manifest {publicadas[chave]:.6f} ≠ retreino {refeitas[chave]:.6f}"
            )
    largura = pipe.largura_do_modelo(t.pipeline)
    if largura != manifest["n_features_modelo"]:
        falhas.append(
            f"n_features_modelo: manifest {manifest['n_features_modelo']} ≠ retreino {largura}"
        )
    if falhas:
        print("FALHA: o modelo servido NÃO é o que o pipeline produz sobre estes dados")
        for f in falhas:
            print(f"  {f}")
        return 1
    print(
        f"OK: {manifest['algoritmo']} v{manifest['versao']} da vertente diabetes "
        f"sobre versao_dados={manifest['dataset']['versao_dados']} reproduz os limiares, as "
        f"métricas e as predições de ouro (tolerância {tolerancia}); critério: {criterio}"
    )
    return 0


def construir_parser() -> argparse.ArgumentParser:
    """A gramática do CLI."""
    parser = argparse.ArgumentParser(
        prog="python -m app.diabetes.treino",
        description=__doc__,
        formatter_class=argparse.RawDescriptionHelpFormatter,
    )
    sub = parser.add_subparsers(dest="comando", required=True)

    def comuns(sp: argparse.ArgumentParser) -> None:
        sp.add_argument("--manifesto", type=Path, default=MANIFESTO_PADRAO)
        sp.add_argument(
            "--banco-url", default=None, help="DSN; padrão BANCO_URL (CONFIG.banco_url)"
        )

    sp = sub.add_parser("snapshot", help="congela dados.registros_diabetes e anota o manifest")
    comuns(sp)
    sp.add_argument("--processado", type=Path, default=dados.PASTA_PADRAO)
    sp.set_defaults(fn=cmd_snapshot)

    sp = sub.add_parser("treinar", help="treina a configuração congelada e escreve o manifest")
    comuns(sp)
    sp.add_argument("--versao", required=True, help="ex.: 1.0.0 (release diabetes-v1.0.0)")
    sp.add_argument(
        "--snapshot", type=Path, default=None, help="padrão: dataset.snapshot do manifest"
    )
    sp.add_argument("--saida", type=Path, default=MODELOS_PADRAO)
    sp.add_argument("--metricas", type=Path, default=METRICAS_PADRAO)
    sp.add_argument("--dados-ouro", type=Path, default=DADOS_OURO, help="pasta com entradas.json")
    sp.add_argument(
        "--sem-anotar-banco",
        dest="anotar_banco",
        action="store_false",
        default=True,
        help="não grava versao_modelo em operacao.snapshot_treino (testes)",
    )
    sp.set_defaults(fn=cmd_treinar)

    sp = sub.add_parser("verificar", help="retreina e compara com o manifest; não escreve nada")
    comuns(sp)
    sp.add_argument("--snapshot", type=Path, default=None)
    sp.add_argument("--dados-ouro", type=Path, default=DADOS_OURO, help="pasta com entradas.json")
    sp.set_defaults(fn=cmd_verificar)
    return parser


def main(argv: list[str] | None = None) -> int:
    """Ponto de entrada."""
    args = construir_parser().parse_args(argv)
    return int(args.fn(args))


if __name__ == "__main__":
    sys.exit(main())
