"""Mede N_MINIMO_DERIVA (plano, §6.8.5): o menor n para o qual o PSI de uma reamostragem do próprio
conjunto de treino contra ele mesmo fica abaixo de 0,10 em TODAS as 16 features.

Método: para cada n da grade, 300 reamostragens com reposição do snapshot congelado; cada feature
é classificada nas faixas de artifacts/distribuicao_treino.json (as mesmas do SQL) e o PSI é
calculado com o mesmo epsilon de 03_indicador_divergencia.sql. O critério usa o percentil 95 do
PSI sobre as reamostragens — uma amostra do próprio treino só pode acusar deriva por ruído, e o
n mínimo é o que torna esse falso alarme raro. O resultado vai para docs/decisoes/0008.

Uso (da raiz): uv run --project backend python tools/medir_n_minimo_deriva.py
"""

from __future__ import annotations

import json
import sys
from pathlib import Path

import numpy as np
import pandas as pd

RAIZ = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(RAIZ / "backend"))

from app.dominio.features import COLUNAS, COLUNAS_NUMERICAS, DTYPES_SNAPSHOT  # noqa: E402

GRADE = [25, 50, 75, 100, 150, 200, 300, 400, 500, 750, 1000]
REAMOSTRAGENS = 300
EPS = 1e-6
LIMIAR = 0.10
SEMENTE = 42


def classificar(serie: pd.Series, faixas: list[dict], tipo: str) -> np.ndarray:
    """Índice da faixa de cada valor, com as mesmas regras do SQL (>= inf AND < sup; rótulo exato)."""
    if tipo == "numerica":
        bordas = [-np.inf] + [f["limite_sup"] for f in faixas[:-1]] + [np.inf]
        return np.digitize(serie.astype("float64").to_numpy(), bordas[1:-1], right=False)
    rotulos = {f["faixa_rotulo"]: f["faixa_idx"] for f in faixas if f["faixa_rotulo"] is not None}
    nulo = next(f["faixa_idx"] for f in faixas if f["faixa_rotulo"] is None)
    return np.array([rotulos.get(str(v), nulo) for v in serie])


def main() -> int:
    """Imprime o PSI p95 por n e o n mínimo; devolve 0."""
    manifest = json.loads((RAIZ / "artifacts" / "manifest.json").read_text(encoding="utf-8"))
    dist = json.loads((RAIZ / "artifacts" / "distribuicao_treino.json").read_text(encoding="utf-8"))
    snapshot = pd.read_parquet(RAIZ / manifest["dataset"]["snapshot"])[COLUNAS].astype(
        {c: DTYPES_SNAPSHOT[c] for c in COLUNAS}
    )
    assert dist["versao_dados"] == manifest["dataset"]["versao_dados"]
    rng = np.random.default_rng(SEMENTE)

    indices: dict[str, np.ndarray] = {}
    p_treino: dict[str, np.ndarray] = {}
    for f in dist["features"]:
        faixas = f["faixas"]
        indices[f["feature"]] = classificar(snapshot[f["feature"]], faixas, f["tipo"])
        p_treino[f["feature"]] = np.maximum(np.array([x["proporcao_treino"] for x in faixas]), EPS)
        assert len(faixas) == len(p_treino[f["feature"]])

    n_total = len(snapshot)
    resultado: dict[int, dict[str, float]] = {}
    for n in GRADE:
        piores: dict[str, list[float]] = {f: [] for f in indices}
        for _ in range(REAMOSTRAGENS):
            sorteio = rng.integers(0, n_total, size=n)
            for feature, idx in indices.items():
                k = len(p_treino[feature])
                contagens = np.bincount(idx[sorteio], minlength=k)[:k]
                p_log = np.maximum(contagens / n, EPS)
                piores[feature].append(float(np.sum((p_log - p_treino[feature]) * np.log(p_log / p_treino[feature]))))
        resultado[n] = {f: float(np.percentile(v, 95)) for f, v in piores.items()}
        pior = max(resultado[n].items(), key=lambda kv: kv[1])
        print(f"n={n:>5}: pior PSI p95 = {pior[1]:.4f} ({pior[0]}); numéricas: "
              + ", ".join(f"{c}={resultado[n][c]:.3f}" for c in COLUNAS_NUMERICAS))

    minimo = next((n for n in GRADE if max(resultado[n].values()) < LIMIAR), None)
    print(f"\nN_MINIMO_DERIVA = {minimo} (menor n da grade com PSI p95 < {LIMIAR} em todas as 16 features)")
    return 0


if __name__ == "__main__":
    sys.exit(main())
