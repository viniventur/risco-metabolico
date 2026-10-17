"""Fórmulas canônicas de preparação e feature engineering: a única cópia, provada no notebook.

Origem: study/01_comparacao_de_modelos.ipynb, célula 5 (`preparar_base`) e célula 14, bloco (a)
(`engineer_features`). O notebook mantém as definições visíveis e, logo abaixo, uma célula
prova por `assert_frame_equal` que ele e este módulo produzem o mesmo DataFrame. Funções
puras, `DataFrame -> DataFrame`, sem `FunctionTransformer` serializado.
"""

from __future__ import annotations

import pandas as pd

# 1. Renomeação das colunas conforme o dicionário (célula 5). A ORDEM deste dicionário é a
#    ordem canônica das 16 features de entrada (feature_names_in_) e das 17 colunas do banco.
COLUNAS_MAP: dict[str, str] = {
    "Gender": "Genero",
    "Age": "Idade",
    "Height": "Altura",
    "Weight": "Peso",
    "family_history": "Historico_Familiar_Sobrepeso",
    "FAVC": "Consumo_Calorico_Frequente",
    "FCVC": "Consumo_Vegetais",
    "NCP": "Numero_Refeicoes_Principais",
    "CAEC": "Consumo_Alimentos_Entre_Refeicoes",
    "SMOKE": "Fumante",
    "CH2O": "Consumo_Agua_Diario",
    "SCC": "Monitoramento_Calorias",
    "FAF": "Atividade_Fisica_Frequencia",
    "TUE": "Tempo_Dispositivos_Tecnologicos",
    "CALC": "Consumo_Alcool",
    "MTRANS": "Meio_Transporte",
    "Obesity": "Nivel_Obesidade",
}

ALVO = "Nivel_Obesidade"
COLUNAS_COM_ALVO: list[str] = list(COLUNAS_MAP.values())  # 17, na ordem canônica
COLUNAS: list[str] = [c for c in COLUNAS_COM_ALVO if c != ALVO]  # as 16 features de entrada

# 2. As 5 escalas ordinais: inteiras após o arredondamento do "ruído" decimal (célula 5).
COLUNAS_ESCALAS: list[str] = [
    "Consumo_Vegetais",
    "Numero_Refeicoes_Principais",
    "Consumo_Agua_Diario",
    "Atividade_Fisica_Frequencia",
    "Tempo_Dispositivos_Tecnologicos",
]
COLUNAS_NUMERICAS: list[str] = ["Idade", "Altura", "Peso"]
COLUNAS_CATEGORICAS_TEXTO: list[str] = [
    "Genero",
    "Historico_Familiar_Sobrepeso",
    "Consumo_Calorico_Frequente",
    "Consumo_Alimentos_Entre_Refeicoes",
    "Fumante",
    "Monitoramento_Calorias",
    "Consumo_Alcool",
    "Meio_Transporte",
]

# 3. Dicionários de tradução dos valores internos (célula 5): os 9 pares, literalmente.
#    `Carro`/`Moto`, NÃO `Automóvel`/`Motocicleta` (docs/auditoria-do-legado.md, divergência 4).
TRADUCOES_VALORES: dict[str, dict[str, str]] = {
    "Genero": {"Female": "Feminino", "Male": "Masculino"},
    "Historico_Familiar_Sobrepeso": {"yes": "Sim", "no": "Não"},
    "Consumo_Calorico_Frequente": {"yes": "Sim", "no": "Não"},
    "Fumante": {"yes": "Sim", "no": "Não"},
    "Monitoramento_Calorias": {"yes": "Sim", "no": "Não"},
    "Consumo_Alimentos_Entre_Refeicoes": {
        "no": "Não",
        "Sometimes": "Às vezes",
        "Frequently": "Frequentemente",
        "Always": "Sempre",
    },
    "Consumo_Alcool": {
        "no": "Não",
        "Sometimes": "Às vezes",
        "Frequently": "Frequentemente",
        "Always": "Sempre",
    },
    "Meio_Transporte": {
        "Automobile": "Carro",
        "Motorbike": "Moto",
        "Bike": "Bicicleta",
        "Public_Transportation": "Transporte Público",
        "Walking": "Caminhada",
    },
    "Nivel_Obesidade": {
        "Insufficient_Weight": "Abaixo do Peso",
        "Normal_Weight": "Peso Normal",
        "Overweight_Level_I": "Sobrepeso I",
        "Overweight_Level_II": "Sobrepeso II",
        "Obesity_Type_I": "Obesidade I",
        "Obesity_Type_II": "Obesidade II",
        "Obesity_Type_III": "Obesidade III",
    },
}

# 4. Tabela coluna -> (tipo SQL, dtype pandas) do plano, §4.3.3. UMA fonte só: o bloco gerado de
#    sql/schema.sql (`python -m app.dados.schema --gerar`) e o DTYPES_SNAPSHOT do CLI de treino
#    saem daqui. `numeric` e `real` são proibidos: Decimal quebra o float64 do snapshot e real
#    perde dígito.
TIPOS_SQL: dict[str, tuple[str, str]] = {
    **{c: ("double precision", "float64") for c in COLUNAS_NUMERICAS},
    **{c: ("smallint", "int64") for c in COLUNAS_ESCALAS},
    **{c: ("text", "object") for c in [*COLUNAS_CATEGORICAS_TEXTO, ALVO]},
}
# Reordena na ordem canônica das 17 colunas (dict de compreensão acima agrupa por família).
TIPOS_SQL = {c: TIPOS_SQL[c] for c in COLUNAS_COM_ALVO}
DTYPES_SNAPSHOT: dict[str, str] = {c: dtype for c, (_, dtype) in TIPOS_SQL.items()}


def coluna_banco(nome: str) -> str:
    """Nome da coluna no Postgres: `snake_case` minúsculo, sem aspas (`Genero` -> `genero`)."""
    return nome.lower()


COLUNAS_BANCO: dict[str, str] = {c: coluna_banco(c) for c in COLUNAS_COM_ALVO}
COLUNAS_MAP_BANCO: dict[str, str] = {v: k for k, v in COLUNAS_BANCO.items()}  # banco -> modelo


def preparar_base(df: pd.DataFrame) -> pd.DataFrame:
    """Renomeia, arredonda as 5 escalas e traduz os valores — a célula 5 do notebook.

    `astype("int64")` em vez de `astype(int)`: o mesmo resultado em numpy 2 e explícito quanto ao
    dtype que o contrato de §4.3.3 exige.
    """
    df = df.copy()
    df = df.rename(columns=COLUNAS_MAP)
    for col in COLUNAS_ESCALAS:
        if col in df.columns:
            df[col] = df[col].round().astype("int64")
    for coluna, mapeamento in TRADUCOES_VALORES.items():
        if coluna in df.columns:
            df[coluna] = df[coluna].map(mapeamento)
    return df


# 5. Os bins da célula 14, bloco (a). Parâmetro explícito do pipeline (ADR 0002), não acidente:
#    com `binning=False` (a variante servida) a função devolve o DataFrame intacto — nenhum IMC,
#    nenhum fillna. A variante de app.py (IMC + fillna + bins=[0,1.5,2.5,10] em vegetais) foi
#    descartada; ver docs/auditoria-do-legado.md.
BINS_CELULA_14: dict[str, tuple[list[float], list[str]]] = {
    "Consumo_Vegetais": ([0, 1.5, 2.5, 4], ["baixa", "moderada", "alta"]),
    "Numero_Refeicoes_Principais": ([0, 2.5, 3.5, 10], ["1-2", "3", "4+"]),
    "Consumo_Agua_Diario": ([0, 1.5, 2.5, 10], ["<1L", "1-2L", ">2L"]),
    "Atividade_Fisica_Frequencia": ([0, 0.5, 1.5, 2.5, 10], ["nenhuma", "baixa", "media", "alta"]),
    "Tempo_Dispositivos_Tecnologicos": ([0, 0.5, 1.5, 10], ["0-2h", "3-5h", ">5h"]),
}


def engineer_features(df: pd.DataFrame, *, binning: bool = False) -> pd.DataFrame:
    """Feature engineering da célula 14(a): binning das 5 escalas, só quando `binning=True`."""
    df = df.copy()
    if not binning:
        return df
    for col, (bins, labels) in BINS_CELULA_14.items():
        if col in df.columns:
            df[col] = pd.to_numeric(df[col], errors="coerce")
            cat = pd.cut(df[col], bins=bins, labels=labels, include_lowest=True, right=False)
            df[col] = cat.astype(str)
    return df
