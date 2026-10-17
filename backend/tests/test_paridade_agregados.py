"""Paridade dos agregados: SQL (artifacts/agregados) contra pandas (dominio/agregados.py).

É a prova de que trocar a origem dos agregados (§4.3.2) não mudou um número do painel. Quem manda
é o SQL; `dominio/agregados.py` é a implementação de runtime que precisa reproduzi-lo. A única
folga admitida é a ordem de soma em ponto flutuante (divergência 9): `abs=1e-9`, sem componente
relativa. Proibido: aumentar a tolerância, `xfail` por id, comentar asserção.
"""

from __future__ import annotations

import json
from pathlib import Path
from typing import Any

import pandas as pd
import pytest

from app.dominio.agregados import BasePainel
from app.treino import agregar

RAIZ = Path(__file__).resolve().parents[2]
ARTEFATOS = RAIZ / "artifacts" / "agregados"
IDS_ESPERADOS = [
    "resumo",
    "por-nivel",
    "imc-por-genero",
    "imc-por-atividade-genero",
    "imc-por-alcool",
    "caloricos",
    "genero",
    "pontos-altura-peso",
]
IDS = [p.stem for p in sorted(ARTEFATOS.glob("*.json"))] if ARTEFATOS.exists() else []

TOLERANCIA = {  # a classe vem do cabeçalho @medida (6.7.2)
    "contagem": 0.0,  # comparada como inteiro, igualdade exata
    "media_limitada": 1e-9,
    "proporcao": 1e-9,
    "texto": 0.0,
}


@pytest.fixture(scope="module")
def base() -> BasePainel:
    caminho = RAIZ / "data" / "processado" / "base_painel.parquet"
    if not caminho.exists():
        pytest.skip("base_painel.parquet ausente: rode python -m app.treino congelar")
    return BasePainel.carregar(caminho)


@pytest.fixture(scope="module")
def sem_filtro(base: BasePainel) -> dict[str, dict[str, Any]]:
    return {agregado_id: base.agregado(agregado_id) for agregado_id in IDS_ESPERADOS}


def _num(v: Any) -> float | None:
    return None if v is None else float(v)


def _indexar(doc: dict[str, Any]) -> tuple[tuple[str, ...], dict[tuple, dict], list[tuple]]:
    dims = tuple(d["nome"] for d in doc["dimensoes"])
    indice: dict[tuple, dict] = {}
    ordem: list[tuple] = []
    for ln in doc["linhas"]:
        chave = tuple(ln.get(d) for d in dims) + (None,) * (2 - len(dims)) + (ln["medida"],)
        indice[chave] = ln
        ordem.append(chave)
    return dims, indice, ordem


def test_os_oito_artefatos_existem_nome_a_nome() -> None:
    if not IDS:
        pytest.skip("artifacts/agregados vazio: rode python -m app.treino congelar")
    assert sorted(IDS) == sorted(IDS_ESPERADOS)
    sqls = sorted(p.stem for p in (RAIZ / "sql" / "agregados").glob("*.sql"))
    assert sqls == sorted(i for i in IDS_ESPERADOS if not i.startswith("pontos-"))
    for p in ARTEFATOS.glob("*.json"):
        assert p.stat().st_size <= agregar.TETO_BYTES, p.name


@pytest.mark.parametrize("agregado_id", [i for i in IDS if not i.startswith("pontos-")])
def test_paridade_agregado(
    agregado_id: str, sem_filtro: dict[str, dict[str, Any]], manifest: dict
) -> None:
    sql_doc = json.loads((ARTEFATOS / f"{agregado_id}.json").read_text(encoding="utf-8"))
    pd_doc = sem_filtro[agregado_id]  # dominio/agregados.py com FiltroPainel vazio

    assert sql_doc["versao_dados"] == manifest["dataset"]["versao_dados"]
    assert sql_doc["versao_dados"] != "PREENCHIDO_PELO_TREINO"
    assert sql_doc["medidas"] == pd_doc["medidas"]

    dims_sql, ind_sql, ordem_sql = _indexar(sql_doc)
    dims_pd, ind_pd, ordem_pd = _indexar(pd_doc)
    assert dims_sql == dims_pd

    # 1. Mesmo conjunto de linhas. Divergência 6: grupo ausente de um lado só.
    so_sql, so_pd = set(ind_sql) - set(ind_pd), set(ind_pd) - set(ind_sql)
    assert not so_sql and not so_pd, (
        f"só no SQL={sorted(so_sql)[:5]}, só no pandas={sorted(so_pd)[:5]}"
    )

    # 2. Mesma ORDEM de linhas. Divergências 4 e 5: GROUP BY e collation.
    assert ordem_sql == ordem_pd

    classes = {m["nome"]: m["classe"] for m in sql_doc["medidas"]}
    for chave in ordem_sql:
        a, b = ind_sql[chave], ind_pd[chave]
        # 3. Suporte e supressão são exatos. Divergência 2: count(col) x count(*).
        assert int(a["n"]) == int(b["n"]), chave
        assert bool(a["suprimido"]) == bool(b["suprimido"]), chave
        if a["suprimido"]:
            continue
        if "valor_texto" in a or "valor_texto" in b:
            assert a.get("valor_texto") == b.get("valor_texto"), chave
            continue
        va, vb = _num(a.get("valor")), _num(b.get("valor"))
        # 4. Ausência é valor, não aproximação. Divergências 1 e 3.
        assert (va is None) == (vb is None), chave
        if va is None:
            continue
        tol = TOLERANCIA[classes[chave[-1]]]
        if tol == 0.0:
            assert va == vb, chave
        else:
            # 5. Única folga admitida: ordem de soma em float. Divergência 9.
            assert va == pytest.approx(vb, abs=tol), chave


@pytest.mark.skipif("pontos-altura-peso" not in IDS, reason="projeção não materializada")
def test_paridade_pontos(sem_filtro: dict[str, dict[str, Any]]) -> None:
    sql_doc = json.loads((ARTEFATOS / "pontos-altura-peso.json").read_text(encoding="utf-8"))
    pd_doc = sem_filtro["pontos-altura-peso"]
    assert sql_doc["total_linhas"] == pd_doc["total_linhas"] == 2111
    for a, b in zip(sql_doc["linhas"], pd_doc["linhas"], strict=True):
        assert a["altura"] == b["altura"] and a["peso"] == b["peso"] and a["nivel"] == b["nivel"]
        assert a["imc"] == pytest.approx(b["imc"], abs=1e-9)


def test_pct_soma_cem_por_dimensao(sem_filtro: dict[str, dict[str, Any]]) -> None:
    for agregado_id in ("por-nivel", "caloricos"):
        doc = (
            json.loads((ARTEFATOS / f"{agregado_id}.json").read_text(encoding="utf-8"))
            if IDS
            else sem_filtro[agregado_id]
        )
        soma = sum(ln["valor"] for ln in doc["linhas"] if ln["medida"] == "pct")
        assert soma == pytest.approx(100.0, abs=1e-9), agregado_id


def test_nenhum_nan_nos_artefatos() -> None:
    for p in ARTEFATOS.glob("*.json"):
        texto = p.read_text(encoding="utf-8")
        assert "NaN" not in texto and "Infinity" not in texto, p.name
        json.loads(texto)


def test_valor_e_float_nunca_decimal(base: BasePainel) -> None:
    doc = base.agregado("imc-por-genero")
    assert all(isinstance(ln["valor"], float) for ln in doc["linhas"] if ln["valor"] is not None)
    assert isinstance(
        pd.read_parquet(RAIZ / "data" / "processado" / "base_painel.parquet")["IMC"].dtype, object
    )
