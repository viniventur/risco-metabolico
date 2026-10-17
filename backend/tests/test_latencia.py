"""Latência local de `POST /predicoes` (plano, F18): p95 abaixo de 50 ms em 200 chamadas.

Marcado com `latencia` e FORA da suíte do CI (`addopts = -m 'not latencia'`): num runner
compartilhado um critério de p95 falha por ruído de máquina, não por regressão. Roda com
`uv run pytest -m latencia -q` e grava `artifacts/metricas/latencia.json` com os percentis e o
modelo da máquina em que foi medido — o número publicado, não prometido.
"""

from __future__ import annotations

import datetime as dt
import json
import platform
import statistics
import time
from pathlib import Path

import pytest

from app.config import CONFIG

pytestmark = pytest.mark.latencia

N_AQUECIMENTO = 20
N_CHAMADAS = 200
LIMITE_P95_MS = 50.0


def _modelo_da_maquina() -> str:
    """Nome comercial do processador no Windows (registro); senão, o que a plataforma souber."""
    try:
        import winreg  # noqa: PLC0415

        chave = r"HARDWARE\DESCRIPTION\System\CentralProcessor\0"
        with winreg.OpenKey(winreg.HKEY_LOCAL_MACHINE, chave) as k:
            return str(winreg.QueryValueEx(k, "ProcessorNameString")[0]).strip()
    except Exception:  # noqa: BLE001 - qualquer falha cai no fallback
        return platform.processor() or platform.machine() or "desconhecido"


def _percentil(amostras: list[float], p: int) -> float:
    return statistics.quantiles(amostras, n=100, method="inclusive")[p - 1]


def test_p95_de_predicao_local(cliente) -> None:
    casos = json.loads((Path(__file__).parent / "dados_ouro" / "entradas.json").read_text(encoding="utf-8"))
    entradas = [c["entrada"] if isinstance(c, dict) and "entrada" in c else c for c in casos]
    assert entradas, "dados_ouro/entradas.json vazio"

    for i in range(N_AQUECIMENTO):
        assert cliente.post("/api/v1/predicoes", json=entradas[i % len(entradas)]).status_code == 200

    tempos_ms: list[float] = []
    for i in range(N_CHAMADAS):
        inicio = time.perf_counter()
        resposta = cliente.post("/api/v1/predicoes", json=entradas[i % len(entradas)])
        tempos_ms.append((time.perf_counter() - inicio) * 1000)
        assert resposta.status_code == 200

    medicao = {
        "endpoint": "POST /api/v1/predicoes",
        "n_chamadas": N_CHAMADAS,
        "n_aquecimento": N_AQUECIMENTO,
        "p50_ms": round(_percentil(tempos_ms, 50), 2),
        "p95_ms": round(_percentil(tempos_ms, 95), 2),
        "p99_ms": round(_percentil(tempos_ms, 99), 2),
        "media_ms": round(statistics.fmean(tempos_ms), 2),
        "maximo_ms": round(max(tempos_ms), 2),
        "limite_p95_ms": LIMITE_P95_MS,
        "versao_modelo": resposta.json()["versao_modelo"],
        "maquina": _modelo_da_maquina(),
        "sistema": f"{platform.system()} {platform.release()}",
        "python": platform.python_version(),
        "modo": "TestClient em processo, sem rede; inclui validação, pipeline e serialização",
        "medido_em": dt.datetime.now(dt.UTC).replace(microsecond=0).isoformat(),
    }
    destino = Path(CONFIG.artefatos_dir) / "metricas" / "latencia.json"
    destino.parent.mkdir(parents=True, exist_ok=True)
    destino.write_text(json.dumps(medicao, ensure_ascii=False, indent=2) + "\n", encoding="utf-8", newline="\n")

    assert medicao["p95_ms"] < LIMITE_P95_MS, f"p95 = {medicao['p95_ms']} ms (limite {LIMITE_P95_MS} ms)"
