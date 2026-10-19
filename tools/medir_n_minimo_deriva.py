"""Mede N_MINIMO_DERIVA (plano, §6.8.5): o menor n para o qual o PSI de uma reamostragem do próprio
conjunto de treino contra ele mesmo fica abaixo de 0,10 em TODAS as 16 features.

Método: para cada n da grade, 300 reamostragens com reposição do snapshot congelado; cada feature
é classificada nas faixas de artifacts/distribuicao_treino.json (as mesmas do SQL) e o PSI é
calculado com o mesmo epsilon de 03_indicador_divergencia.sql. O critério usa o percentil 95 do
PSI sobre as reamostragens — uma amostra do próprio treino só pode acusar deriva por ruído, e o
n mínimo é o que torna esse falso alarme raro. O resultado vai para docs/decisoes/0008.

Com `--vertente diabetes`, o MESMO método mede N_MINIMO_DERIVA_DIABETES sobre as dez entradas da
vertente: o snapshot e as faixas são os dela (artifacts/diabetes/), o valor numérico é arredondado
ao inteiro antes de classificar, como em sql/diabetes/deriva/, e o resultado, com a grade inteira,
vai para artifacts/diabetes/metricas/n-minimo-deriva.json — a medição registrada de onde saem o
valor do .env.example e o do docker-compose.yml. Sem a opção, a ferramenta faz o que sempre fez.

Uso (da raiz): uv run --project backend python tools/medir_n_minimo_deriva.py [--vertente diabetes]
"""

from __future__ import annotations

import argparse
import json
import sys
from datetime import UTC, datetime
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
REGISTRO_DIABETES = RAIZ / "artifacts" / "diabetes" / "metricas" / "n-minimo-deriva.json"


def classificar(serie: pd.Series, faixas: list[dict], tipo: str, arredondar: bool = False) -> np.ndarray:
    """Índice da faixa de cada valor, com as mesmas regras do SQL (>= inf AND < sup; rótulo exato).

    `arredondar`: o valor numérico vira o inteiro mais próximo antes (desempate no par, como o
    `round(double precision)` do Postgres e o `np.round` do modelo) — a regra da vertente diabetes.
    """
    if tipo == "numerica":
        bordas = [-np.inf] + [f["limite_sup"] for f in faixas[:-1]] + [np.inf]
        valores = serie.astype("float64").to_numpy()
        if arredondar:
            valores = np.round(valores)
        return np.digitize(valores, bordas[1:-1], right=False)
    rotulos = {f["faixa_rotulo"]: f["faixa_idx"] for f in faixas if f["faixa_rotulo"] is not None}
    nulo = next(f["faixa_idx"] for f in faixas if f["faixa_rotulo"] is None)
    return np.array([rotulos.get(str(v), nulo) for v in serie])


def medir(
    snapshot: pd.DataFrame, dist: dict, numericas: list[str], *, arredondar: bool = False
) -> dict[int, dict[str, float]]:
    """PSI p95 por n da grade e por feature; imprime uma linha por n, como sempre imprimiu."""
    rng = np.random.default_rng(SEMENTE)

    indices: dict[str, np.ndarray] = {}
    p_treino: dict[str, np.ndarray] = {}
    for f in dist["features"]:
        faixas = f["faixas"]
        indices[f["feature"]] = classificar(snapshot[f["feature"]], faixas, f["tipo"], arredondar)
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
              + ", ".join(f"{c}={resultado[n][c]:.3f}" for c in numericas))
    return resultado


def medir_obesidade() -> int:
    """A medição da ADR 0008, sem mudança: imprime o PSI p95 por n e o n mínimo; devolve 0."""
    manifest = json.loads((RAIZ / "artifacts" / "manifest.json").read_text(encoding="utf-8"))
    dist = json.loads((RAIZ / "artifacts" / "distribuicao_treino.json").read_text(encoding="utf-8"))
    snapshot = pd.read_parquet(RAIZ / manifest["dataset"]["snapshot"])[COLUNAS].astype(
        {c: DTYPES_SNAPSHOT[c] for c in COLUNAS}
    )
    assert dist["versao_dados"] == manifest["dataset"]["versao_dados"]
    resultado = medir(snapshot, dist, COLUNAS_NUMERICAS)

    minimo = next((n for n in GRADE if max(resultado[n].values()) < LIMIAR), None)
    print(f"\nN_MINIMO_DERIVA = {minimo} (menor n da grade com PSI p95 < {LIMIAR} em todas as 16 features)")
    return 0


def medir_diabetes(registro: Path) -> int:
    """O mesmo método sobre as dez entradas da vertente diabetes; grava o registro da medição."""
    from app.diabetes.dominio.features import COLUNAS_NUMERICAS as NUMERICAS_DIABETES
    from app.diabetes.dominio.features import DTYPES_SNAPSHOT as DTYPES_DIABETES
    from app.diabetes.dominio.features import ENTRADAS

    pasta = RAIZ / "artifacts" / "diabetes"
    manifest = json.loads((pasta / "manifest.json").read_text(encoding="utf-8"))
    dist = json.loads((pasta / "distribuicao_treino.json").read_text(encoding="utf-8"))
    snapshot = pd.read_parquet(RAIZ / manifest["dataset"]["snapshot"])[ENTRADAS].astype(
        {c: DTYPES_DIABETES[c] for c in ENTRADAS}
    )
    assert dist["versao_dados"] == manifest["dataset"]["versao_dados"]
    assert [f["feature"] for f in dist["features"]] == ENTRADAS
    numericas = [c for c in ENTRADAS if c in NUMERICAS_DIABETES]
    resultado = medir(snapshot, dist, numericas, arredondar=True)

    minimo = next((n for n in GRADE if max(resultado[n].values()) < LIMIAR), None)
    print(f"\nN_MINIMO_DERIVA_DIABETES = {minimo} (menor n da grade com PSI p95 < {LIMIAR} "
          f"em todas as {len(ENTRADAS)} entradas)")
    documento = {
        "medido_em": datetime.now(UTC).date().isoformat(),
        "vertente": "diabetes",
        "metodo": "docs/decisoes/0008-limiares-de-psi.md, decisão 2 (tools/medir_n_minimo_deriva.py)",
        "versao_modelo": dist["versao_modelo"],
        "versao_dados": dist["versao_dados"],
        "linhas_snapshot": int(len(snapshot)),
        "reamostragens": REAMOSTRAGENS,
        "semente": SEMENTE,
        "percentil": 95,
        "limiar_psi": LIMIAR,
        "epsilon": EPS,
        "imc_arredondado": True,
        "grade": GRADE,
        "psi_p95": {str(n): resultado[n] for n in GRADE},
        "pior_por_n": {
            str(n): dict(zip(("feature", "psi_p95"), max(resultado[n].items(), key=lambda kv: kv[1]), strict=True))
            for n in GRADE
        },
        "n_minimo": minimo,
    }
    registro.parent.mkdir(parents=True, exist_ok=True)
    registro.write_text(
        json.dumps(documento, ensure_ascii=False, indent=2, allow_nan=False) + "\n",
        encoding="utf-8",
        newline="\n",
    )
    print(f"registro: {registro.relative_to(RAIZ).as_posix() if registro.is_relative_to(RAIZ) else registro}")
    return 0 if minimo is not None else 1


def main(argv: list[str] | None = None) -> int:
    """Sem argumento, a medição da vertente de obesidade; `--vertente diabetes`, a da outra."""
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--vertente", choices=("obesidade", "diabetes"), default="obesidade")
    parser.add_argument("--registro", type=Path, default=REGISTRO_DIABETES, help="só da vertente diabetes")
    args = parser.parse_args(argv)
    if args.vertente == "diabetes":
        return medir_diabetes(args.registro)
    return medir_obesidade()


if __name__ == "__main__":
    sys.exit(main())
