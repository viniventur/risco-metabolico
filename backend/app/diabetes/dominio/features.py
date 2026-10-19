"""Preparação da base da vertente diabetes: nomes, tipos e tradução dos códigos — a única cópia.

Origem: o `data.csv` do repositório público (UCI 891) descrito em data/bruto/diabetes/FONTE.md e
o dicionário docs/dicionario-de-dados-diabetes.md. Como na vertente de obesidade, cada coluna tem
três nomes (CSV, modelo/API e banco). Nenhum nome daqui repete um nome de lá — "Sexo", não
"Genero"; "Fumou_100_Cigarros", não "Fumante" —, porque as duas vertentes convivem no mesmo log de
predição, e o mesmo nome com sentidos diferentes misturaria as duas na deriva.
"""

from __future__ import annotations

import numpy as np
import pandas as pd

# 1. Renomeação, na ordem do CSV. A coluna `ID` (a posição da linha) fica de fora: vira
#    `linha_origem` no seed. A ORDEM deste dicionário é a ordem canônica das 22 colunas do banco e
#    do snapshot — o alvo primeiro, como no arquivo.
COLUNAS_MAP: dict[str, str] = {
    "Diabetes_binary": "Diabetes",
    "HighBP": "Pressao_Alta",
    "HighChol": "Colesterol_Alto",
    "CholCheck": "Exame_Colesterol_5_Anos",
    "BMI": "IMC",
    "Smoker": "Fumou_100_Cigarros",
    "Stroke": "Teve_AVC",
    "HeartDiseaseorAttack": "Doenca_Coronariana_Ou_Infarto",
    "PhysActivity": "Atividade_Fisica_30_Dias",
    "Fruits": "Fruta_Diaria",
    "Veggies": "Verdura_Diaria",
    "HvyAlcoholConsump": "Consumo_Pesado_Alcool",
    "AnyHealthcare": "Cobertura_Saude",
    "NoDocbcCost": "Deixou_Medico_Por_Custo",
    "GenHlth": "Saude_Geral",
    "MentHlth": "Dias_Saude_Mental_Ruim",
    "PhysHlth": "Dias_Saude_Fisica_Ruim",
    "DiffWalk": "Dificuldade_Caminhar",
    "Sex": "Sexo",
    "Age": "Faixa_Etaria",
    "Education": "Escolaridade",
    "Income": "Faixa_Renda",
}

COLUNA_ID = "ID"
ALVO = "Diabetes"
COLUNAS_COM_ALVO: list[str] = list(COLUNAS_MAP.values())  # 22, na ordem canônica
COLUNAS: list[str] = [c for c in COLUNAS_COM_ALVO if c != ALVO]  # as 21 variáveis

# 2. As três famílias de tipo. As binárias do CSV (0/1) viram texto "Não"/"Sim", como as
#    categóricas da vertente de obesidade: um domínio fechado em português, que a API recebe como
#    enum e o banco guarda legível. As inteiras são escalas e contagens (faixa etária, escolaridade,
#    renda, saúde geral, dias). O IMC é a única numérica: inteiro no arquivo, `float64` aqui porque
#    a API o recebe com casas decimais e o arredonda como a limpeza da origem arredondou.
COLUNAS_SIM_NAO: list[str] = [
    "Pressao_Alta",
    "Colesterol_Alto",
    "Exame_Colesterol_5_Anos",
    "Fumou_100_Cigarros",
    "Teve_AVC",
    "Doenca_Coronariana_Ou_Infarto",
    "Atividade_Fisica_30_Dias",
    "Fruta_Diaria",
    "Verdura_Diaria",
    "Consumo_Pesado_Alcool",
    "Cobertura_Saude",
    "Deixou_Medico_Por_Custo",
    "Dificuldade_Caminhar",
]
COLUNAS_TEXTO: list[str] = [ALVO, *COLUNAS_SIM_NAO, "Sexo"]
COLUNAS_INTEIRAS: list[str] = [
    "Saude_Geral",
    "Dias_Saude_Mental_Ruim",
    "Dias_Saude_Fisica_Ruim",
    "Faixa_Etaria",
    "Escolaridade",
    "Faixa_Renda",
]
COLUNAS_NUMERICAS: list[str] = ["IMC"]

# 3. Tradução dos códigos: o 0/1 do CSV para o texto do domínio (dicionário de dados).
SIM_NAO_MAP: dict[int, str] = {0: "Não", 1: "Sim"}
TRADUCOES_VALORES: dict[str, dict[int, str]] = {
    **{c: SIM_NAO_MAP for c in [ALVO, *COLUNAS_SIM_NAO]},
    "Sexo": {0: "Feminino", 1: "Masculino"},
}

# 4. Coluna -> (tipo SQL, dtype pandas). UMA fonte: o bloco gerado de sql/schema.sql
#    (`python -m app.diabetes.dados.schema --gerar`) e o DTYPES_SNAPSHOT do snapshot saem daqui.
#    As mesmas três famílias da vertente de obesidade; `numeric` e `real` continuam proibidos.
TIPOS_SQL: dict[str, tuple[str, str]] = {
    **{c: ("double precision", "float64") for c in COLUNAS_NUMERICAS},
    **{c: ("smallint", "int64") for c in COLUNAS_INTEIRAS},
    **{c: ("text", "object") for c in COLUNAS_TEXTO},
}
# Reordena na ordem canônica das 22 colunas (os dicts acima agrupam por família).
TIPOS_SQL = {c: TIPOS_SQL[c] for c in COLUNAS_COM_ALVO}
DTYPES_SNAPSHOT: dict[str, str] = {c: dtype for c, (_, dtype) in TIPOS_SQL.items()}

# 5. As dez entradas do modelo (decisão D2; notebook 02, célula 14): o que uma pessoa sabe responder
#    ANTES de qualquer diagnóstico. A ORDEM é a do notebook, e é a de `feature_names_in_` do
#    artefato, do contrato da API e do log de predição. As outras onze variáveis ficam no banco e no
#    painel, como dado descritivo.
ENTRADAS: list[str] = [
    "Faixa_Etaria",
    "Sexo",
    "IMC",
    "Pressao_Alta",
    "Colesterol_Alto",
    "Fumou_100_Cigarros",
    "Atividade_Fisica_30_Dias",
    "Fruta_Diaria",
    "Verdura_Diaria",
    "Escolaridade",
]


def coluna_banco(nome: str) -> str:
    """Nome da coluna no Postgres: `snake_case` minúsculo, sem aspas (`Teve_AVC` -> `teve_avc`)."""
    return nome.lower()


COLUNAS_BANCO: dict[str, str] = {c: coluna_banco(c) for c in COLUNAS_COM_ALVO}
COLUNAS_MAP_BANCO: dict[str, str] = {v: k for k, v in COLUNAS_BANCO.items()}  # banco -> modelo


def preparar_base(df: pd.DataFrame) -> pd.DataFrame:
    """Renomeia, traduz os códigos 0/1 e fixa os tipos; o `ID` passa intocado.

    Um código fora do domínio (um 2 numa binária, por exemplo) vira `NaN` no `map`, sem exceção
    aqui: quem recusa a carga com nulo ou valor fora de `regras.DOMINIOS` é o seed.
    """
    df = df.copy()
    df = df.rename(columns=COLUNAS_MAP)
    for coluna, mapeamento in TRADUCOES_VALORES.items():
        if coluna in df.columns:
            df[coluna] = df[coluna].map(mapeamento)
    tipos = {c: d for c, d in DTYPES_SNAPSHOT.items() if c in df.columns and d != "object"}
    return df.astype(tipos)


def arredondar_imc(df: pd.DataFrame) -> pd.DataFrame:
    """Arredonda o IMC ao inteiro como a limpeza da origem: `round` do numpy, que empata no par.

    Na base o IMC já é inteiro e o passo não muda nada; em serviço a API recebe o IMC com casas
    decimais (calculado de peso e altura) e este é o mesmo tratamento que a pessoa teria recebido
    na pesquisa — 26,5 vira 26 e 27,5 vira 28. Transformador NOMEADO e IMPORTÁVEL: entra no
    pipeline como `FunctionTransformer(arredondar_imc)`, serializável com joblib.
    """
    df = df.copy()
    df["IMC"] = np.round(df["IMC"].astype("float64"))
    return df
