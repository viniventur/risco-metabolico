"""Mede a reprodutibilidade do treino da vertente diabetes entre plataformas e entre sementes.

O XGBoost sorteia as linhas (`subsample`) e as colunas (`colsample_bytree`) de cada árvore com as
distribuições aleatórias da biblioteca padrão do C++, que cada compilador implementa a seu modo
(MSVC no Windows, libstdc++ no Linux): o mesmo snapshot, os mesmos pacotes e a mesma semente dão,
em cada plataforma, um modelo diferente. Esta ferramenta mede o tamanho dessa diferença e o compara
com o da que uma simples troca de semente produz na mesma plataforma. O registro vai para
artifacts/diabetes/metricas/reprodutibilidade.json; as tolerâncias do `verificar`
(backend/app/diabetes/treino/__main__.py) são conferidas contra ele por teste
(backend/tests/diabetes/test_treino_cli.py).

Uso (da raiz), em duas etapas:

  1. `treinar`: um treino da configuração congelada por plataforma e semente.
       uv run --project backend python tools/medir_reprodutibilidade_diabetes.py treinar \
           --saida <pasta>/windows-42.npz
       uv run --project backend python tools/medir_reprodutibilidade_diabetes.py treinar \
           --semente 43 --saida <pasta>/windows-43.npz          (e 44, 45, 46, 47)
     No Linux, a imagem da API (mesmo uv.lock), com o código montado à frente do pacote instalado:
       docker run --rm -e PYTHONPATH=/app/backend -v <raiz>/backend/app:/app/backend/app:ro \
           -v <raiz>/tools:/app/tools:ro -v <raiz>/artifacts:/app/artifacts:ro \
           -v <raiz>/data/processado:/app/data/processado:ro \
           -v <raiz>/backend/tests/diabetes/dados_ouro:/app/backend/tests/diabetes/dados_ouro:ro \
           -v <pasta>:/saida --entrypoint python risco-metabolico-api \
           /app/tools/medir_reprodutibilidade_diabetes.py treinar --saida /saida/linux-42.npz
  2. `comparar`: a base (Windows, semente 42 — a do modelo publicado), a outra plataforma com a
     mesma semente e as outras sementes na plataforma da base.
       uv run --project backend python tools/medir_reprodutibilidade_diabetes.py comparar \
           --base <pasta>/windows-42.npz --plataforma <pasta>/linux-42.npz \
           --sementes <pasta>/windows-43.npz ... <pasta>/windows-47.npz
"""

from __future__ import annotations

import argparse
import json
import platform
import sys
from datetime import UTC, datetime
from pathlib import Path
from typing import Any

import numpy as np

RAIZ = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(RAIZ / "backend"))

from app.diabetes.treino import dados  # noqa: E402
from app.diabetes.treino import pipeline as pipe  # noqa: E402
from app.diabetes.treino.__main__ import (  # noqa: E402
    DADOS_OURO,
    MANIFESTO_PADRAO,
    ambiente_do_treino,
    metricas_comparaveis,
    numeros_do_treino,
    treinar_configuracao,
)

REGISTRO_PADRAO = RAIZ / "artifacts" / "diabetes" / "metricas" / "reprodutibilidade.json"


def cmd_treinar(args: argparse.Namespace) -> int:
    """Treina a configuração congelada (com outra semente do XGBoost, se pedida) e grava o .npz."""
    manifest = json.loads(MANIFESTO_PADRAO.read_text(encoding="utf-8"))
    quadro = dados.carregar_snapshot(
        RAIZ / manifest["dataset"]["snapshot"],
        sha256_esperado=manifest["dataset"]["sha256_snapshot"],
    )
    casos = json.loads((DADOS_OURO / "entradas.json").read_text(encoding="utf-8"))
    pipe.HIPERPARAMETROS["random_state"] = args.semente  # só o XGBoost; split e dobras ficam em 42
    t = treinar_configuracao(quadro, casos)
    descricao = {
        "sistema": platform.system(),
        "semente": args.semente,
        "versao_dados": manifest["dataset"]["versao_dados"],
        "ambiente": ambiente_do_treino(),
        "metricas": metricas_comparaveis(numeros_do_treino(t)),
    }
    args.saida.parent.mkdir(parents=True, exist_ok=True)
    np.savez(
        args.saida,
        p_teste=t.p_teste,
        p_ouro=t.probas_ouro,
        limiar=np.array([t.limiar]),
        limiares_ouro=t.limiares_ouro,
        descricao=np.array(json.dumps(descricao)),
    )
    print(
        f"{descricao['sistema']} semente {args.semente}: limiar único {t.limiar:.6f}, por idade "
        + ", ".join(f"{v:.6f}" for v in t.limiares_idade.values())
        + f" -> {args.saida}"
    )
    return 0


def _ler(caminho: Path) -> dict[str, Any]:
    with np.load(caminho) as npz:
        return {
            "p_teste": npz["p_teste"],
            "p_ouro": npz["p_ouro"],
            "limiar": float(npz["limiar"][0]),
            "limiares_ouro": npz["limiares_ouro"],
            **json.loads(str(npz["descricao"])),
        }


def cmd_comparar(args: argparse.Namespace) -> int:
    """Compara a base com a outra plataforma e com as outras sementes; grava o registro."""
    base, outra = _ler(args.base), _ler(args.plataforma)
    sementes = [_ler(c) for c in args.sementes]
    todos = [base, outra, *sementes]
    if len({t["versao_dados"] for t in todos}) != 1:
        print("FALHA: os treinos não são do mesmo snapshot")
        return 1
    if outra["semente"] != base["semente"] or outra["sistema"] == base["sistema"]:
        print("FALHA: --plataforma precisa ser outro sistema com a MESMA semente da base")
        return 1
    if any(s["sistema"] != base["sistema"] or s["semente"] == base["semente"] for s in sementes):
        print("FALHA: --sementes precisam ser da plataforma da base, com outras sementes")
        return 1

    def desvio(a: np.ndarray, b: np.ndarray) -> np.ndarray:
        return np.abs(np.asarray(a) - np.asarray(b))

    d_plataforma = desvio(base["p_teste"], outra["p_teste"])
    d_sementes = max(float(desvio(base["p_teste"], s["p_teste"]).max()) for s in sementes)
    # Ouro: a classificação de cada caso, em cada treino, pelo limiar DESSE treino para o grupo de
    # idade do caso — o que a API aplica.
    acima = np.vstack([t["p_ouro"] >= t["limiares_ouro"] for t in todos])
    margens = np.vstack([np.abs(t["p_ouro"] - t["limiares_ouro"]) for t in todos])
    metricas = {
        chave: {
            "plataforma": abs(base["metricas"][chave] - outra["metricas"][chave]),
            "sementes": max(abs(base["metricas"][chave] - s["metricas"][chave]) for s in sementes),
        }
        for chave in base["metricas"]
    }
    registro = {
        "medido_em": datetime.now(UTC).date().isoformat(),
        "versao_dados": base["versao_dados"],
        "base": {"sistema": base["sistema"], "semente": base["semente"]},
        "plataforma": {"sistema": outra["sistema"], "semente": outra["semente"]},
        "sementes": [s["semente"] for s in sementes],
        "ambientes": {base["sistema"]: base["ambiente"], outra["sistema"]: outra["ambiente"]},
        "teste": {
            "n": len(d_plataforma),
            "iguais_bit_a_bit_plataforma": int((d_plataforma == 0).sum()),
            "desvio_max_plataforma": float(d_plataforma.max()),
            "desvio_p999_plataforma": float(np.quantile(d_plataforma, 0.999)),
            "desvio_mediano_plataforma": float(np.median(d_plataforma)),
            "desvio_max_sementes": d_sementes,
        },
        "metricas": metricas,
        "ouro": {
            "n": int(acima.shape[1]),
            "classificacao_estavel": bool((acima.all(axis=0) | (~acima).all(axis=0)).all()),
            "margem_minima": float(margens.min()),
            "desvio_max_plataforma": float(desvio(base["p_ouro"], outra["p_ouro"]).max()),
            "desvio_max_sementes": max(
                float(desvio(base["p_ouro"], s["p_ouro"]).max()) for s in sementes
            ),
        },
    }
    args.saida.parent.mkdir(parents=True, exist_ok=True)
    args.saida.write_text(
        json.dumps(registro, ensure_ascii=False, indent=2, allow_nan=False) + "\n",
        encoding="utf-8",
        newline="\n",
    )
    t = registro["teste"]
    print(
        f"teste: desvio máximo {t['desvio_max_plataforma']:.4f} entre plataformas, "
        f"{t['desvio_max_sementes']:.4f} entre sementes; métricas: até "
        f"{max(m['plataforma'] for m in metricas.values()):.4f} entre plataformas e "
        f"{max(m['sementes'] for m in metricas.values()):.4f} entre sementes; ouro estável: "
        f"{registro['ouro']['classificacao_estavel']} (margem mínima "
        f"{registro['ouro']['margem_minima']:.4f}) -> {args.saida}"
    )
    return 0


def main(argv: list[str] | None = None) -> int:
    """Ponto de entrada."""
    parser = argparse.ArgumentParser(
        description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter
    )
    sub = parser.add_subparsers(dest="comando", required=True)
    sp = sub.add_parser("treinar", help="um treino da configuração congelada, gravado em .npz")
    sp.add_argument("--semente", type=int, default=pipe.RANDOM_STATE)
    sp.add_argument("--saida", type=Path, required=True)
    sp.set_defaults(fn=cmd_treinar)
    sp = sub.add_parser("comparar", help="compara os treinos e grava o registro")
    sp.add_argument("--base", type=Path, required=True)
    sp.add_argument("--plataforma", type=Path, required=True)
    sp.add_argument("--sementes", type=Path, nargs="+", required=True)
    sp.add_argument("--saida", type=Path, default=REGISTRO_PADRAO)
    sp.set_defaults(fn=cmd_comparar)
    args = parser.parse_args(argv)
    return int(args.fn(args))


if __name__ == "__main__":
    sys.exit(main())
