"""Os literais das listas VALUES de sql/agregados/*.sql contra dominio/regras.py (§10.6).

É o portão que faltava para as duas cópias de domínio que o SQL ainda digita (a ordem clínica em
por-nivel e os gêneros/álcool/calóricos nos demais): ordem E conteúdo.
"""

from __future__ import annotations

import re
from pathlib import Path

import pytest

from app.dominio.regras import DOMINIOS, ORDEM_CLINICA

SQL = Path(__file__).resolve().parents[2] / "sql" / "agregados"
LITERAL = re.compile(r"\(\s*'([^']+)'\s*,\s*(\d+)\s*\)")


def _values(nome: str) -> list[str]:
    """Os literais `('texto', ordem)` do bloco VALUES do domínio, na ordem declarada."""
    texto = (SQL / nome).read_text(encoding="utf-8")
    # O CTE fecha com ")" na coluna 0 (formato do sqlfluff); os parênteses internos são indentados.
    bloco = re.search(r"dominio AS \((.*?)\n\)", texto, re.S)
    assert bloco, f"{nome}: CTE dominio não encontrado"
    pares = LITERAL.findall(bloco.group(1))
    pares.sort(key=lambda p: int(p[1]))
    return [p[0] for p in pares]


@pytest.mark.parametrize(
    ("arquivo", "esperado"),
    [
        ("por-nivel.sql", list(ORDEM_CLINICA)),
        ("imc-por-genero.sql", DOMINIOS["Genero"]),
        ("genero.sql", DOMINIOS["Genero"]),
        ("imc-por-atividade-genero.sql", DOMINIOS["Genero"]),
        ("imc-por-alcool.sql", DOMINIOS["Consumo_Alcool"]),
        ("caloricos.sql", DOMINIOS["Consumo_Calorico_Frequente"]),
    ],
)
def test_values_batem_com_o_dominio(arquivo: str, esperado: list[str]) -> None:
    assert _values(arquivo) == esperado


def test_atividade_nao_e_digitada_no_sql() -> None:
    """O domínio de atividade vem de dados.rotulos_escala, nunca de um VALUES com 0,1,2,3."""
    texto = (SQL / "imc-por-atividade-genero.sql").read_text(encoding="utf-8")
    assert "rotulos_escala" in texto
    assert not re.search(r"VALUES\s*\(\s*0\s*\)", texto)


def test_nenhum_round_em_agregados() -> None:
    for p in SQL.glob("*.sql"):
        corpo = "\n".join(
            ln
            for ln in p.read_text(encoding="utf-8").splitlines()
            if not ln.strip().startswith("--")
        )
        assert not re.search(r"\bround\s*\(", corpo, re.I), p.name
