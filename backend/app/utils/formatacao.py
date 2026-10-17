"""Formatação herdada do legado: `:.1f` para percentual e `round(x, 2)` para IMC."""

from __future__ import annotations


def formatar_percentual(fracao: float) -> str:
    """0.413 -> "41,3%" (vírgula decimal, uma casa, como no app legado)."""
    return f"{fracao * 100:.1f}%".replace(".", ",")


def arredondar_imc(imc: float) -> float:
    """IMC com 2 casas — `round(peso / (altura ** 2), 2)` do legado."""
    return round(imc, 2)
