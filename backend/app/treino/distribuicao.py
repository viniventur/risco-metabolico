"""Perfil de distribuição do snapshot congelado: a referência contra a qual a deriva é medida.

Escrito no mesmo passo que produz o manifest, sempre a partir do SNAPSHOT, nunca da tabela
mutável. Para as 13 categóricas (as 5 escalas inclusive) as faixas são os níveis de `DOMINIOS`
mais uma faixa `NULL`; para `Idade`, `Altura` e `Peso`, decis do snapshot, calculados uma vez e
gravados — recalcular quantis a cada consulta faria a referência andar junto com o dado. A
primeira e a última faixa numérica abrem para -infinity e infinity (JSON: `null`).

Uso (carga nas tabelas de referência): python -m app.treino.distribuicao --carregar [--banco-url]
"""

from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path
from typing import Any

import numpy as np
import pandas as pd

from app.config import CONFIG, RAIZ_REPOSITORIO
from app.dominio.features import COLUNAS, COLUNAS_NUMERICAS
from app.dominio.regras import DOMINIOS

ARQUIVO_PADRAO = RAIZ_REPOSITORIO / "artifacts" / "distribuicao_treino.json"
N_DECIS = 10


def _faixas_numericas(serie: pd.Series) -> list[dict[str, Any]]:
    valores = serie.astype("float64").to_numpy()
    cortes = np.unique(np.quantile(valores, np.linspace(0.0, 1.0, N_DECIS + 1)[1:-1]))
    bordas = [-np.inf, *[float(c) for c in cortes], np.inf]
    # [a, b): fechada à esquerda, aberta à direita — a mesma regra do SQL (>= inf AND < sup).
    contagens, _ = np.histogram(valores, bins=bordas)
    n = len(valores)
    return [
        {
            "faixa_idx": i,
            "faixa_rotulo": None,
            "limite_inf": None if i == 0 else bordas[i],
            "limite_sup": None if i == len(contagens) - 1 else bordas[i + 1],
            "n_treino": int(c),
            "proporcao_treino": float(c) / n,
        }
        for i, c in enumerate(contagens)
    ]


def _faixas_categoricas(serie: pd.Series, dominio: list[Any]) -> list[dict[str, Any]]:
    n = len(serie)
    faixas = [
        {
            "faixa_idx": i,
            "faixa_rotulo": str(nivel),
            "limite_inf": None,
            "limite_sup": None,
            "n_treino": int((serie == nivel).sum()),
            "proporcao_treino": float((serie == nivel).sum()) / n,
        }
        for i, nivel in enumerate(dominio)
    ]
    nulos = int(serie.isnull().sum())
    faixas.append(
        {
            "faixa_idx": len(dominio),
            "faixa_rotulo": None,  # chave ausente ou nula na entrada real cai aqui (§6.8.5)
            "limite_inf": None,
            "limite_sup": None,
            "n_treino": nulos,
            "proporcao_treino": float(nulos) / n,
        }
    )
    return faixas


def perfil(
    quadro: pd.DataFrame, *, versao_modelo: str, versao_dados: str, sha256_snapshot: str
) -> dict[str, Any]:
    """O documento de `artifacts/distribuicao_treino.json` para as 16 features de entrada."""
    features: list[dict[str, Any]] = []
    for ordem, col in enumerate(COLUNAS):
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


def escrever(caminho: Path, documento: dict[str, Any]) -> None:
    """Grava o JSON (UTF-8, sem NaN: `allow_nan=False` transforma um NaN que escapou em erro)."""
    caminho.parent.mkdir(parents=True, exist_ok=True)
    caminho.write_text(
        json.dumps(documento, ensure_ascii=False, indent=2, allow_nan=False) + "\n",
        encoding="utf-8",
    )


def carregar(dsn: str, caminho: Path = ARQUIVO_PADRAO) -> tuple[int, int, int]:
    """JSON -> as três tabelas de referência, numa transação, TRUNCATE + INSERT (idempotente).

    `null` nos limites vira -infinity / infinity no banco: é o que impede um valor fora da faixa
    de treino de desaparecer da contagem.
    """
    import psycopg

    doc = json.loads(caminho.read_text(encoding="utf-8"))
    n_cat = n_num = n_faixa = 0
    with psycopg.connect(dsn) as con, con.transaction(), con.cursor() as cur:
        cur.execute(
            "TRUNCATE operacao.distribuicao_treino_faixa, operacao.distribuicao_treino_numerica, "
            "operacao.feature_catalogo"
        )
        for f in doc["features"]:
            cur.execute(
                "INSERT INTO operacao.feature_catalogo (feature, tipo, ordem) VALUES (%s, %s, %s)",
                (f["feature"], f["tipo"], f["ordem"]),
            )
            n_cat += 1
            if f["tipo"] == "numerica":
                cur.execute(
                    "INSERT INTO operacao.distribuicao_treino_numerica "
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
                    "INSERT INTO operacao.distribuicao_treino_faixa "
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
    """Ponto de entrada: só a carga; o perfil é escrito por `python -m app.treino treinar`."""
    parser = argparse.ArgumentParser(
        description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter
    )
    parser.add_argument("--carregar", action="store_true", required=True)
    parser.add_argument("--json", type=Path, default=ARQUIVO_PADRAO)
    parser.add_argument("--banco-url", default=None)
    args = parser.parse_args(argv)
    n_cat, n_num, n_faixa = carregar(args.banco_url or CONFIG.banco_url, args.json)
    print(f"referência de deriva: {n_cat} features, {n_num} numéricas, {n_faixa} faixas")
    return 0


if __name__ == "__main__":
    sys.exit(main())
