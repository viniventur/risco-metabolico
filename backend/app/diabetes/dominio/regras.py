"""Regras de domínio da vertente diabetes: domínios fechados, rótulos das escalas e faixa do IMC.

Tudo aqui é constante explícita, derivada uma vez da base (data/bruto/diabetes/) e conferida por
teste contra ela — nenhuma leitura de arquivo em runtime. Os rótulos das escalas traduzem os do
codebook do BRFSS 2015; a correspondência com os termos brasileiros (escolaridade) e a renda em
dólares de 2015 estão explicadas em docs/dicionario-de-dados-diabetes.md.
"""

from __future__ import annotations

from typing import Any

from app.diabetes.dominio.features import ALVO, COLUNAS_SIM_NAO

# 1. Domínio de cada coluna, na ordem lexicográfica que um encoder usaria sozinho para o texto e
#    na ordem da escala para as inteiras. O IMC não tem domínio fechado: tem a faixa observada.
SIM_NAO: list[str] = ["Não", "Sim"]
DOMINIOS: dict[str, list[Any]] = {
    ALVO: list(SIM_NAO),
    **{c: list(SIM_NAO) for c in COLUNAS_SIM_NAO},
    "Sexo": ["Feminino", "Masculino"],
    "Saude_Geral": list(range(1, 6)),
    "Dias_Saude_Mental_Ruim": list(range(0, 31)),
    "Dias_Saude_Fisica_Ruim": list(range(0, 31)),
    "Faixa_Etaria": list(range(1, 14)),
    "Escolaridade": list(range(1, 7)),
    "Faixa_Renda": list(range(1, 9)),
}

# 2. Faixa do IMC observada na base (conferida em tests/diabetes/test_features.py).
FAIXAS_TREINO: dict[str, tuple[float, float]] = {"IMC": (12.0, 98.0)}

# 3. Rótulos de exibição das escalas — de APRESENTAÇÃO (painel, formulário, relatório), nunca do
#    modelo. Faixa etária e renda seguem as faixas do codebook; escolaridade, a série concluída.
ROTULOS_ESCALA: dict[str, dict[int, str]] = {
    "Faixa_Etaria": {
        1: "18 a 24 anos",
        2: "25 a 29 anos",
        3: "30 a 34 anos",
        4: "35 a 39 anos",
        5: "40 a 44 anos",
        6: "45 a 49 anos",
        7: "50 a 54 anos",
        8: "55 a 59 anos",
        9: "60 a 64 anos",
        10: "65 a 69 anos",
        11: "70 a 74 anos",
        12: "75 a 79 anos",
        13: "80 anos ou mais",
    },
    "Escolaridade": {
        1: "Nunca estudou ou só a pré-escola",
        2: "Da 1ª à 8ª série",
        3: "Da 9ª à 11ª série",
        4: "Ensino médio completo",
        5: "Superior incompleto ou curso técnico",
        6: "Superior completo",
    },
    "Saude_Geral": {1: "Excelente", 2: "Muito boa", 3: "Boa", 4: "Regular", 5: "Ruim"},
    "Faixa_Renda": {
        1: "Menos de US$ 10 mil",
        2: "US$ 10 mil a 15 mil",
        3: "US$ 15 mil a 20 mil",
        4: "US$ 20 mil a 25 mil",
        5: "US$ 25 mil a 35 mil",
        6: "US$ 35 mil a 50 mil",
        7: "US$ 50 mil a 75 mil",
        8: "US$ 75 mil ou mais",
    },
}
