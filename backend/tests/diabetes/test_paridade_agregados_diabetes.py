"""Paridade dos agregados da vertente diabetes: SQL (artifacts/diabetes/agregados) contra pandas.

A prova de tests/test_paridade_agregados.py, para a vertente: quem manda é o SQL de
sql/diabetes/agregados/; `app/diabetes/dominio/agregados.py` é a implementação de runtime que
precisa reproduzi-lo, com filtro vazio. A única folga admitida é a ordem de soma em ponto flutuante
(divergência 9): `abs=1e-9`, sem componente relativa. Proibido: aumentar a tolerância, `xfail` por
id, comentar asserção.
"""

from __future__ import annotations

import json
from typing import Any

import pytest

from app.diabetes.dominio.agregados import BasePainelDiabetes
from app.treino import agregar
from tests.diabetes.conftest import RAIZ

ARTEFATOS = RAIZ / "artifacts" / "diabetes" / "agregados"
BASE = RAIZ / "data" / "processado" / "diabetes" / "base_painel.parquet"
IDS_ESPERADOS = [
    "resumo",
    "prevalencia-por-idade",
    "prevalencia-por-imc",
    "piramide-idade-sexo",
    "fatores",
]
IDS = [p.stem for p in sorted(ARTEFATOS.glob("*.json"))] if ARTEFATOS.exists() else []

TOLERANCIA = {  # a classe vem do cabeçalho @medida (6.7.2)
    "contagem": 0.0,  # comparada como inteiro, igualdade exata
    "media_limitada": 1e-9,
    "proporcao": 1e-9,
    "texto": 0.0,
}


@pytest.fixture(scope="module")
def base() -> BasePainelDiabetes:
    if not BASE.exists():
        pytest.skip(
            "base do painel da vertente ausente: rode python -m app.diabetes.treino.agregar"
        )
    return BasePainelDiabetes.carregar(BASE)


@pytest.fixture(scope="module")
def sem_filtro(base: BasePainelDiabetes) -> dict[str, dict[str, Any]]:
    return {agregado_id: base.agregado(agregado_id) for agregado_id in IDS_ESPERADOS}


def _sql(agregado_id: str) -> dict[str, Any]:
    return json.loads((ARTEFATOS / f"{agregado_id}.json").read_text(encoding="utf-8"))


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


def test_os_cinco_artefatos_existem_nome_a_nome() -> None:
    if not IDS:
        pytest.skip(
            "artifacts/diabetes/agregados vazio: rode python -m app.diabetes.treino.agregar"
        )
    assert sorted(IDS) == sorted(IDS_ESPERADOS)
    sqls = sorted(p.stem for p in (RAIZ / "sql" / "diabetes" / "agregados").glob("*.sql"))
    assert sqls == sorted(IDS_ESPERADOS)
    for p in ARTEFATOS.glob("*.json"):
        assert p.stat().st_size <= agregar.TETO_BYTES, p.name


@pytest.mark.parametrize("agregado_id", IDS)
def test_paridade_agregado(
    agregado_id: str, sem_filtro: dict[str, dict[str, Any]], manifest_diabetes: dict
) -> None:
    sql_doc = _sql(agregado_id)
    pd_doc = sem_filtro[agregado_id]  # dominio/agregados.py com FiltroDiabetes vazio

    assert sql_doc["versao_dados"] == manifest_diabetes["dataset"]["versao_dados"]
    assert sql_doc["medidas"] == pd_doc["medidas"]

    dims_sql, ind_sql, ordem_sql = _indexar(sql_doc)
    dims_pd, ind_pd, ordem_pd = _indexar(pd_doc)
    assert dims_sql == dims_pd
    assert sql_doc["dimensoes"] == pd_doc["dimensoes"]  # o tipo também: texto | inteiro

    # 1. Mesmo conjunto de linhas. Divergência 6: grupo ausente de um lado só.
    so_sql, so_pd = set(ind_sql) - set(ind_pd), set(ind_pd) - set(ind_sql)
    assert not so_sql and not so_pd, (
        f"só no SQL={sorted(so_sql)[:5]}, só no pandas={sorted(so_pd)[:5]}"
    )

    # 2. Mesma ORDEM de linhas. Divergências 4 e 5: GROUP BY e a ordem do domínio.
    assert ordem_sql == ordem_pd

    classes = {m["nome"]: m["classe"] for m in sql_doc["medidas"]}
    for chave in ordem_sql:
        a, b = ind_sql[chave], ind_pd[chave]
        # 3. Suporte e supressão são exatos. Divergência 2: count(col) x count(*).
        assert int(a["n"]) == int(b["n"]), chave
        assert bool(a["suprimido"]) == bool(b["suprimido"]), chave
        if a["suprimido"]:
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


def test_pct_soma_cem(sem_filtro: dict[str, dict[str, Any]]) -> None:
    for agregado_id in ("prevalencia-por-idade", "prevalencia-por-imc", "piramide-idade-sexo"):
        doc = _sql(agregado_id) if IDS else sem_filtro[agregado_id]
        soma = sum(ln["valor"] for ln in doc["linhas"] if ln["medida"] == "pct")
        assert soma == pytest.approx(100.0, abs=1e-9), agregado_id
    fatores = _sql("fatores") if IDS else sem_filtro["fatores"]
    por_fator: dict[str, float] = {}
    for ln in fatores["linhas"]:
        if ln["medida"] == "pct":
            por_fator[ln["fator"]] = por_fator.get(ln["fator"], 0.0) + ln["valor"]
    assert len(por_fator) == 16
    assert all(soma == pytest.approx(100.0, abs=1e-9) for soma in por_fator.values()), por_fator


def test_contagens_fecham_com_o_manifest(
    sem_filtro: dict[str, dict[str, Any]], manifest_diabetes: dict
) -> None:
    """Total e prevalência da base vêm do manifest (linhas e prevalências do split), não à mão."""
    resumo = {ln["medida"]: ln for ln in sem_filtro["resumo"]["linhas"]}
    split = manifest_diabetes["split"]
    linhas = manifest_diabetes["dataset"]["linhas"]
    n_diabetes = round(
        split["prevalencia_treino"] * split["linhas_treino"]
        + split["prevalencia_teste"] * split["linhas_teste"]
    )
    assert resumo["total_registros"]["valor"] == float(linhas)
    assert resumo["n_diabetes"]["valor"] == float(n_diabetes)
    assert resumo["prevalencia"]["valor"] == pytest.approx(100.0 * n_diabetes / linhas, abs=1e-12)
    for agregado_id in ("prevalencia-por-idade", "prevalencia-por-imc", "piramide-idade-sexo"):
        doc = sem_filtro[agregado_id]
        assert sum(ln["n"] for ln in doc["linhas"] if ln["medida"] == "contagem") == linhas
        assert sum(ln["n"] for ln in doc["linhas"] if ln["medida"] == "n_diabetes") == n_diabetes


def test_prevalencia_suprimida_exatamente_abaixo_do_n_minimo(base: BasePainelDiabetes) -> None:
    """A regra de supressão vale linha a linha, com e sem filtro (um recorte pequeno a exercita)."""
    from app.diabetes.dominio.filtros import normalizar_filtros

    pequeno = normalizar_filtros(faixa_etaria=["1"], faixa_imc=["Obesidade Grau III"])
    docs = [base.agregar_por_categoria("escolaridade", "sexo", pequeno), base.fatores(pequeno)]
    suprimidas = 0
    for doc in docs:
        for ln in doc["linhas"]:
            if ln["medida"] != "prevalencia":
                assert ln["suprimido"] is False
                continue
            assert ln["suprimido"] == (ln["n"] < doc["amostra_minima"])
            assert (ln["valor"] is None) == ln["suprimido"]
            suprimidas += ln["suprimido"]
    assert suprimidas > 0, "o recorte pequeno deveria ter grupo abaixo do n mínimo"


def test_nenhum_nan_nos_artefatos() -> None:
    for p in ARTEFATOS.glob("*.json"):
        texto = p.read_text(encoding="utf-8")
        assert "NaN" not in texto and "Infinity" not in texto, p.name
        json.loads(texto)


def test_valor_e_float_nunca_decimal(base: BasePainelDiabetes) -> None:
    doc = base.agregado("prevalencia-por-imc")
    assert all(isinstance(ln["valor"], float) for ln in doc["linhas"] if ln["valor"] is not None)
    assert all(isinstance(ln["n"], int) for ln in doc["linhas"])
