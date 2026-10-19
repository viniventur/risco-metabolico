"""Os domínios que sql/diabetes/agregados/*.sql digita, contra app/diabetes/dominio/ (§10.6).

O portão de tests/test_dominios_sql.py, para a vertente: a base não tem tabela de rótulos (os da
vertente vivem no código), então as faixas etárias, os sexos, as faixas de IMC e as respostas dos
fatores aparecem como VALUES nos .sql — uma segunda cópia do domínio, que este teste confere em
ordem E conteúdo. Os cortes do CASE da faixa de IMC são conferidos contra `classificar_imc`, a
regra única, num passo de 0,05 em toda a faixa aceita pela API.
"""

from __future__ import annotations

import re

import numpy as np
import pytest

from app.diabetes.dominio.agregados import CAMPOS_CATEGORIA, FATORES
from app.diabetes.dominio.regras import DOMINIOS, ORDEM_FAIXA_IMC
from app.diabetes.esquemas.entrada import IMC_MAXIMO, IMC_MINIMO
from app.dominio.regras import classificar_imc
from tests.diabetes.conftest import RAIZ

SQL = RAIZ / "sql" / "diabetes" / "agregados"
INTEIRO = re.compile(r"\(\s*(\d+)\s*\)")
TEXTO_ORDEM = re.compile(r"\(\s*'([^']+)'\s*,\s*(\d+)\s*\)")
TRIPLA = re.compile(r"\(\s*'([^']+)'\s*,\s*'([^']+)'\s*,\s*(\d+)\s*\)")
CORTE = re.compile(r"WHEN imc < (\d+\.\d+) THEN '([^']+)'")
SENAO = re.compile(r"ELSE '([^']+)'")


def _bloco(nome: str, inicio: str, fim: str = r"\n\)") -> str:
    texto = (SQL / nome).read_text(encoding="utf-8")
    achado = re.search(rf"{inicio}(.*?){fim}", texto, re.S)
    assert achado, f"{nome}: bloco {inicio!r} não encontrado"
    return achado.group(1)


def test_faixas_etarias_digitadas_sao_o_dominio() -> None:
    for nome in ("prevalencia-por-idade.sql", "piramide-idade-sexo.sql"):
        bloco = _bloco(nome, r"dominio AS \(")
        idades = [int(v) for v in INTEIRO.findall(bloco.split("AS i (faixa_etaria)")[0])]
        assert idades == DOMINIOS["Faixa_Etaria"], nome


def test_sexos_da_piramide_sao_o_dominio() -> None:
    bloco = _bloco("piramide-idade-sexo.sql", r"dominio AS \(")
    pares = sorted(TEXTO_ORDEM.findall(bloco), key=lambda p: int(p[1]))
    assert [p[0] for p in pares] == DOMINIOS["Sexo"]


def test_faixas_de_imc_na_ordem_da_escala() -> None:
    bloco = _bloco("prevalencia-por-imc.sql", r"dominio AS \(")
    pares = sorted(TEXTO_ORDEM.findall(bloco), key=lambda p: int(p[1]))
    assert [p[0] for p in pares] == ORDEM_FAIXA_IMC


def test_cortes_do_case_reproduzem_classificar_imc() -> None:
    """A segunda cópia da regra (o CASE do .sql) dá a mesma faixa que a primeira, valor a valor."""
    texto = (SQL / "prevalencia-por-imc.sql").read_text(encoding="utf-8")
    cortes = [(float(limite), faixa) for limite, faixa in CORTE.findall(texto)]
    senao = SENAO.findall(texto)
    assert len(cortes) == len(ORDEM_FAIXA_IMC) - 1 and len(senao) == 1

    def pelo_sql(imc: float) -> str:
        return next((faixa for limite, faixa in cortes if imc < limite), senao[0])

    for imc in np.arange(IMC_MINIMO, IMC_MAXIMO + 0.05, 0.05):
        valor = round(float(imc), 2)
        assert pelo_sql(valor) == classificar_imc(valor), valor
    for limite, _ in cortes:  # a fronteira é inclusiva à esquerda nos dois lados
        assert pelo_sql(limite) == classificar_imc(limite), limite


def test_fatores_digitados_sao_os_16_com_o_dominio_de_cada_um() -> None:
    bloco = _bloco("fatores.sql", r"dominio AS \(")
    triplas = sorted(TRIPLA.findall(bloco), key=lambda t: int(t[2]))
    assert [int(t[2]) for t in triplas] == list(range(1, len(triplas) + 1))
    esperado = [(fator, str(valor)) for fator in FATORES for valor in CAMPOS_CATEGORIA[fator][1]]
    assert [(t[0], t[1]) for t in triplas] == esperado
    assert len(FATORES) == 16


@pytest.mark.parametrize("fator", FATORES)
def test_o_unpivot_le_a_coluna_do_proprio_fator(fator: str) -> None:
    """Cada `('fator', r.coluna)` do LATERAL lê a coluna de mesmo nome, e na ordem de FATORES."""
    texto = (SQL / "fatores.sql").read_text(encoding="utf-8")
    pares = re.findall(r"\('([a-z_0-9]+)', r\.([a-z_0-9]+)(?:::text)?\)", texto)
    assert [p[0] for p in pares] == FATORES
    assert dict(pares)[fator] == fator
