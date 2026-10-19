"""Regras de domínio da vertente diabetes: domínios, rótulos, faixa do IMC e a classificação.

Tudo aqui é constante explícita, derivada uma vez da base (data/bruto/diabetes/) e conferida por
teste contra ela — nenhuma leitura de arquivo em runtime. Os rótulos das escalas traduzem os do
codebook do BRFSS 2015; a correspondência com os termos brasileiros (escolaridade) e a renda em
dólares de 2015 estão explicadas em docs/dicionario-de-dados-diabetes.md.
"""

from __future__ import annotations

from typing import Any, Final

from app.diabetes.dominio.features import ALVO, COLUNAS_SIM_NAO
from app.diabetes.esquemas.saida import Classificacao
from app.dominio.regras import FaixaImc

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

# 4. Rótulo curto de cada uma das dez entradas, para o formulário e o relatório (APRESENTAÇÃO). A
#    pergunta completa, como o BRFSS a fez, vai na ajuda do campo (/diabetes/metadata).
ROTULOS_ENTRADAS: dict[str, str] = {
    "Faixa_Etaria": "Faixa etária",
    "Sexo": "Sexo",
    "IMC": "IMC (kg/m²)",
    "Pressao_Alta": "Pressão alta",
    "Colesterol_Alto": "Colesterol alto",
    "Fumou_100_Cigarros": "Fumou 100 cigarros na vida",
    "Atividade_Fisica_30_Dias": "Atividade física nos últimos 30 dias",
    "Fruta_Diaria": "Fruta todo dia",
    "Verdura_Diaria": "Verdura ou legume todo dia",
    "Escolaridade": "Escolaridade",
}

# 5. A classificação de triagem (decisão D4): probabilidade no limiar ou acima dele é risco elevado
#    — a triagem sugere o exame de glicemia. `>=`, como o `encaminhar = p >= limiar` do notebook.
RISCO_ELEVADO: Final = "Risco elevado"
RISCO_BAIXO: Final = "Risco baixo"


def classificar(probabilidade: float, limiar: float) -> Classificacao:
    """Risco elevado no limiar ou acima dele; empate no limiar encaminha, como no critério."""
    return RISCO_ELEVADO if probabilidade >= limiar else RISCO_BAIXO


# 6. A faixa de IMC do painel: a coluna derivada `Faixa_IMC`, com os cortes e os nomes de
#    `app.dominio.regras.classificar_imc` — o vocabulário de tela que a resposta da predição já usa
#    (`faixa_imc`). A ordem é a da escala, não a alfabética.
COLUNA_FAIXA_IMC: Final = "Faixa_IMC"
ORDEM_FAIXA_IMC: list[str] = [faixa.value for faixa in FaixaImc]

# 7. Rótulo de cada coluna da base no painel e na Consulta (APRESENTAÇÃO), mais a faixa de IMC
#    derivada. As dez entradas repetem ROTULOS_ENTRADAS; as outras seguem o sentido da pergunta no
#    dicionário de dados (docs/dicionario-de-dados-diabetes.md).
ROTULOS_COLUNAS: dict[str, str] = {
    "Diabetes": "Diabetes diagnosticado",
    "Pressao_Alta": ROTULOS_ENTRADAS["Pressao_Alta"],
    "Colesterol_Alto": ROTULOS_ENTRADAS["Colesterol_Alto"],
    "Exame_Colesterol_5_Anos": "Mediu o colesterol nos últimos 5 anos",
    "IMC": ROTULOS_ENTRADAS["IMC"],
    "Fumou_100_Cigarros": ROTULOS_ENTRADAS["Fumou_100_Cigarros"],
    "Teve_AVC": "Já teve AVC",
    "Doenca_Coronariana_Ou_Infarto": "Doença coronariana ou infarto",
    "Atividade_Fisica_30_Dias": ROTULOS_ENTRADAS["Atividade_Fisica_30_Dias"],
    "Fruta_Diaria": ROTULOS_ENTRADAS["Fruta_Diaria"],
    "Verdura_Diaria": ROTULOS_ENTRADAS["Verdura_Diaria"],
    "Consumo_Pesado_Alcool": "Consumo pesado de álcool",
    "Cobertura_Saude": "Tem cobertura de saúde",
    "Deixou_Medico_Por_Custo": "Deixou de ir ao médico pelo custo",
    "Saude_Geral": "Saúde geral, na própria avaliação",
    "Dias_Saude_Mental_Ruim": "Dias de saúde mental ruim (dos últimos 30)",
    "Dias_Saude_Fisica_Ruim": "Dias de saúde física ruim (dos últimos 30)",
    "Dificuldade_Caminhar": "Dificuldade para andar ou subir escadas",
    "Sexo": ROTULOS_ENTRADAS["Sexo"],
    "Faixa_Etaria": ROTULOS_ENTRADAS["Faixa_Etaria"],
    "Escolaridade": ROTULOS_ENTRADAS["Escolaridade"],
    "Faixa_Renda": "Renda do domicílio (US$ de 2015)",
    COLUNA_FAIXA_IMC: "Faixa de IMC",
}


def rotulo_valor(coluna: str, valor: Any) -> str:
    """O rótulo de exibição de um valor: o da escala, os dias por extenso, ou o próprio texto."""
    if coluna in ROTULOS_ESCALA:
        return ROTULOS_ESCALA[coluna][int(valor)]
    if coluna.startswith("Dias_"):
        return "1 dia" if int(valor) == 1 else f"{int(valor)} dias"
    return str(valor)
