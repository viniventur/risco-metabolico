"""Perfil de distribuição da vertente diabetes: a referência contra a qual a deriva dela é medida.

O desenho de `app.treino.distribuicao`, sobre as dez ENTRADAS do modelo e o snapshot congelado da
vertente, nunca a tabela mutável: para o IMC, decis do snapshot, calculados uma vez e gravados; para
as nove categóricas (as duas escalas inclusive), os níveis de `regras.DOMINIOS` mais uma faixa
`NULL`, que captura a chave ausente na entrada real. As funções que montam as faixas são as da
vertente de obesidade, por import e sem edição. O IMC do snapshot já é inteiro, e as
consultas de sql/diabetes/deriva/ arredondam o do log antes de classificar: as faixas valem para o
IMC que o modelo vê.

O perfil não depende do treino, só do snapshot: `--escrever` o tira do snapshot que o manifest da
vertente aponta (sha256 conferido), com a versão do modelo publicado — o modelo 1.0.0 não é
retreinado para isso. Depois de um treino novo, rode `--escrever` de novo
(tests/diabetes/test_distribuicao_diabetes.py falha se o perfil e o manifest divergirem).
`--carregar` materializa o JSON nas três tabelas operacao.diabetes_* (TRUNCATE + INSERT numa
transação, idempotente) — no deploy e no CI, como a referência da outra vertente.

Uso: python -m app.diabetes.treino.distribuicao --escrever [--manifesto ...] [--json ...]
     python -m app.diabetes.treino.distribuicao --carregar [--json ...] [--banco-url <dsn>]
"""

from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path
from typing import Any

import pandas as pd

from app.config import CONFIG, RAIZ_REPOSITORIO
from app.diabetes.dominio.features import COLUNAS_NUMERICAS, ENTRADAS
from app.diabetes.dominio.regras import DOMINIOS
from app.diabetes.treino import dados
from app.treino.distribuicao import _faixas_categoricas, _faixas_numericas

MANIFESTO_PADRAO = RAIZ_REPOSITORIO / "artifacts" / "diabetes" / "manifest.json"
ARQUIVO_PADRAO = RAIZ_REPOSITORIO / "artifacts" / "diabetes" / "distribuicao_treino.json"


def escrever(caminho: Path, documento: dict[str, Any]) -> None:
    """Grava o JSON em UTF-8, com LF e sem NaN (`allow_nan=False` transforma um NaN em erro)."""
    caminho.parent.mkdir(parents=True, exist_ok=True)
    caminho.write_text(
        json.dumps(documento, ensure_ascii=False, indent=2, allow_nan=False) + "\n",
        encoding="utf-8",
        newline="\n",
    )


def perfil(
    quadro: pd.DataFrame, *, versao_modelo: str, versao_dados: str, sha256_snapshot: str
) -> dict[str, Any]:
    """O documento de artifacts/diabetes/distribuicao_treino.json para as dez entradas."""
    features: list[dict[str, Any]] = []
    for ordem, col in enumerate(ENTRADAS):
        serie = quadro[col]
        if col in COLUNAS_NUMERICAS:
            valores = serie.astype("float64")
            features.append(
                {
                    "feature": col,
                    "tipo": "numerica",
                    "ordem": ordem,
                    "media": float(valores.mean()),
                    "desvio": float(valores.std(ddof=1)),
                    "p50": float(valores.quantile(0.5)),
                    "minimo": float(valores.min()),
                    "maximo": float(valores.max()),
                    "faixas": _faixas_numericas(valores),
                }
            )
        else:
            features.append(
                {
                    "feature": col,
                    "tipo": "categorica",
                    "ordem": ordem,
                    "media": None,
                    "desvio": None,
                    "p50": None,
                    "minimo": None,
                    "maximo": None,
                    "faixas": _faixas_categoricas(serie, DOMINIOS[col]),
                }
            )
    return {
        "versao_modelo": versao_modelo,
        "versao_dados": versao_dados,
        "sha256_snapshot": sha256_snapshot,
        "n_treino": int(len(quadro)),
        "features": features,
    }


def escrever_do_manifest(
    manifesto: Path = MANIFESTO_PADRAO, destino: Path = ARQUIVO_PADRAO
) -> Path:
    """Lê o snapshot que o manifest da vertente aponta (sha256 conferido) e grava o perfil."""
    manifest = json.loads(manifesto.read_text(encoding="utf-8"))
    dataset = manifest.get("dataset") or {}
    if not manifest.get("versao") or not dataset.get("snapshot"):
        raise FileNotFoundError(
            "manifest da vertente sem versao ou dataset.snapshot: rode `snapshot` e `treinar` antes"
        )
    caminho = Path(dataset["snapshot"])
    if not caminho.is_absolute():  # pastas temporárias de teste gravam caminho absoluto
        caminho = RAIZ_REPOSITORIO / caminho
    quadro = dados.carregar_snapshot(caminho, sha256_esperado=dataset["sha256_snapshot"])
    escrever(
        destino,
        perfil(
            quadro,
            versao_modelo=str(manifest["versao"]),
            versao_dados=str(dataset["versao_dados"]),
            sha256_snapshot=str(dataset["sha256_snapshot"]),
        ),
    )
    return destino


def carregar(dsn: str, caminho: Path = ARQUIVO_PADRAO) -> tuple[int, int, int]:
    """JSON -> as três tabelas operacao.diabetes_*, numa transação, TRUNCATE + INSERT.

    `null` nos limites vira -infinity / infinity no banco: é o que impede um valor fora da faixa
    de treino de desaparecer da contagem. Só as tabelas desta vertente são tocadas.
    """
    import psycopg

    doc = json.loads(caminho.read_text(encoding="utf-8"))
    n_cat = n_num = n_faixa = 0
    with psycopg.connect(dsn) as con, con.transaction(), con.cursor() as cur:
        cur.execute(
            "TRUNCATE operacao.diabetes_distribuicao_treino_faixa, "
            "operacao.diabetes_distribuicao_treino_numerica, operacao.diabetes_feature_catalogo"
        )
        for f in doc["features"]:
            cur.execute(
                "INSERT INTO operacao.diabetes_feature_catalogo (feature, tipo, ordem) "
                "VALUES (%s, %s, %s)",
                (f["feature"], f["tipo"], f["ordem"]),
            )
            n_cat += 1
            if f["tipo"] == "numerica":
                cur.execute(
                    "INSERT INTO operacao.diabetes_distribuicao_treino_numerica "
                    "(feature, n_treino, media, desvio, p50, minimo, maximo) "
                    "VALUES (%s, %s, %s, %s, %s, %s, %s)",
                    (
                        f["feature"],
                        doc["n_treino"],
                        f["media"],
                        f["desvio"],
                        f["p50"],
                        f["minimo"],
                        f["maximo"],
                    ),
                )
                n_num += 1
            for faixa in f["faixas"]:
                inf = float("-inf") if faixa["limite_inf"] is None else float(faixa["limite_inf"])
                sup = float("inf") if faixa["limite_sup"] is None else float(faixa["limite_sup"])
                cur.execute(
                    "INSERT INTO operacao.diabetes_distribuicao_treino_faixa "
                    "(feature, faixa_idx, tipo, faixa_rotulo, limite_inf, limite_sup, "
                    "n_treino, proporcao_treino) "
                    "VALUES (%s, %s, %s, %s, %s, %s, %s, %s)",
                    (
                        f["feature"],
                        faixa["faixa_idx"],
                        f["tipo"],
                        faixa["faixa_rotulo"],
                        inf if f["tipo"] == "numerica" else None,
                        sup if f["tipo"] == "numerica" else None,
                        faixa["n_treino"],
                        faixa["proporcao_treino"],
                    ),
                )
                n_faixa += 1
    return n_cat, n_num, n_faixa


def main(argv: list[str] | None = None) -> int:
    """Ponto de entrada: `--escrever` (do snapshot) ou `--carregar` (nas tabelas de referência)."""
    parser = argparse.ArgumentParser(
        description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter
    )
    acao = parser.add_mutually_exclusive_group(required=True)
    acao.add_argument("--escrever", action="store_true", help="grava o perfil a partir do snapshot")
    acao.add_argument("--carregar", action="store_true", help="carrega o perfil nas tabelas")
    parser.add_argument("--manifesto", type=Path, default=MANIFESTO_PADRAO)
    parser.add_argument("--json", type=Path, default=ARQUIVO_PADRAO)
    parser.add_argument("--banco-url", default=None)
    args = parser.parse_args(argv)
    if args.escrever:
        try:
            escrito = escrever_do_manifest(args.manifesto, args.json)
        except (FileNotFoundError, RuntimeError) as erro:
            print(f"FALHA: {erro}")
            return 1
        print(f"perfil da vertente diabetes: {escrito.name}")
        return 0
    n_cat, n_num, n_faixa = carregar(args.banco_url or CONFIG.banco_url, args.json)
    print(
        f"referência de deriva da vertente diabetes: {n_cat} features, {n_num} numéricas, "
        f"{n_faixa} faixas"
    )
    return 0


if __name__ == "__main__":
    sys.exit(main())
