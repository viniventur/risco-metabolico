"""Fixtures centrais (§10.6): TestClient com artefato REAL, amostra estratificada, banco opcional.

Mock de `predict_proba` esconde justamente os erros de shape; por isso o cliente carrega o
artefato de verdade. A amostra de referência NÃO é "200 linhas quaisquer": `Meio_Transporte` tem
`Moto`=11 e `Bicicleta`=7 em 2.111 linhas e `Consumo_Alcool='Sempre'` tem 1; a amostra
estratificada é COMPLETADA com `groupby(col).head(3)` em cada uma das 13 categóricas.

Os testes marcados `banco` são PULADOS sem BANCO_URL; com ela, o cliente sobe com o banco ligado.
"""

from __future__ import annotations

import json
import os
from collections.abc import Iterator
from pathlib import Path
from typing import Any

import pandas as pd
import pytest

RAIZ = Path(__file__).resolve().parents[2]
DADOS_OURO = Path(__file__).resolve().parent / "dados_ouro"
CSV = RAIZ / "data" / "bruto" / "obesity.csv"

# O ambiente de teste é fixado ANTES de importar `app`: nenhum .env local muda o resultado.
os.environ.setdefault("LIMITE_TAXA_ATIVO", "false")
os.environ.setdefault("EXIGIR_INTEGRIDADE", "true")
os.environ.setdefault("N_MINIMO_DERIVA", "100")
if os.environ.get("BANCO_URL"):
    os.environ.setdefault("BANCO_HABILITADO", "true")
else:
    os.environ["BANCO_HABILITADO"] = "false"

from app.config import recarregar_config  # noqa: E402

recarregar_config()

ENTRADA_PADRAO: dict[str, Any] = json.loads(
    (DADOS_OURO / "entradas.json").read_text(encoding="utf-8")
)[0]


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


@pytest.fixture(scope="session")
def manifest() -> dict[str, Any]:
    caminho = RAIZ / "artifacts" / "manifest.json"
    if not caminho.exists():
        pytest.skip("artifacts/manifest.json ausente: rode python -m app.treino treinar")
    return dict(json.loads(caminho.read_text(encoding="utf-8")))


@pytest.fixture(scope="session")
def cliente() -> Iterator[Any]:
    """TestClient com o lifespan rodando: artefato real, sumidouro e (se houver) banco."""
    from fastapi.testclient import TestClient

    from app.main import criar_app

    with TestClient(criar_app(), raise_server_exceptions=True) as c:
        yield c


@pytest.fixture(scope="session")
def artefato(cliente: Any) -> Any:
    registro = cliente.app.state.registro
    assert registro is not None, (
        "o artefato não carregou: treine o modelo (python -m app.treino treinar)"
    )
    return registro.padrao


@pytest.fixture(scope="session")
def sumidouro(cliente: Any) -> Any:
    return cliente.app.state.sumidouro


def drenar(cliente: Any, sumidouro: Any, timeout: float = 5.0) -> None:
    """Espera a fila do log esvaziar, no loop do app (o TestClient roda num portal próprio)."""
    cliente.portal.call(sumidouro.drenar, timeout)


@pytest.fixture(scope="session")
def base_referencia(artefato: Any, manifest: dict[str, Any]) -> pd.DataFrame:
    """Amostra estratificada no alvo e completada com toda categoria de cada categórica."""
    from sklearn.model_selection import StratifiedShuffleSplit

    from app.dominio.features import ALVO, preparar_base
    from app.treino.pipeline import COLUNAS_CATEGORICAS

    base = preparar_base(pd.read_csv(CSV))
    divisor = StratifiedShuffleSplit(n_splits=1, test_size=200, random_state=42)
    _, idx = next(divisor.split(base, base[ALVO]))
    indices = set(base.index[idx])
    for col in COLUNAS_CATEGORICAS:
        indices |= set(base.groupby(col).head(3).index)
    amostra = base.loc[sorted(indices)].reset_index(drop=True)
    for col in COLUNAS_CATEGORICAS:
        assert set(base[col].unique()) <= set(amostra[col].unique()), col
    largura = artefato.transformar(amostra[artefato.colunas]).shape[1]
    assert largura == manifest["n_features_modelo"], "largura fora do manifest; nunca o literal 43"
    return amostra


@pytest.fixture
def conexao(dsn: str) -> Iterator[Any]:
    """Conexão síncrona (psycopg) para inspecionar o log; jsonb volta como dict."""
    import psycopg

    with psycopg.connect(dsn) as con:
        yield con
