"""Fixtures centrais. Os testes marcados `banco` são PULADOS sem BANCO_URL (plano, §10.6)."""

from __future__ import annotations

import os
from pathlib import Path

import pytest

RAIZ = Path(__file__).resolve().parents[2]


def pytest_collection_modifyitems(config: pytest.Config, items: list[pytest.Item]) -> None:
    if os.environ.get("BANCO_URL"):
        return
    pular = pytest.mark.skip(reason="exige BANCO_URL (Postgres do docker compose)")
    for item in items:
        if "banco" in item.keywords:
            item.add_marker(pular)


@pytest.fixture(scope="session")
def dsn() -> str:
    """DSN do banco de teste — o do compose local, nunca a instância publicada."""
    return os.environ["BANCO_URL"]
