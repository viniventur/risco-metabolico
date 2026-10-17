"""Regras de domínio: classes, ordens, domínios do encoder, rótulos das escalas, IMC e risco.

Origem: `SAFE_CLASSES` e as faixas de IMC do app legado; `RISK_CLASSES`, `to_risk_flag` e a
ordem alfabética do `LabelEncoder` da célula 14(e) do notebook. Tudo aqui é constante
explícita — nenhum pickle de encoder, nenhuma leitura de arquivo em runtime.
"""

from __future__ import annotations

from collections.abc import Iterable, Mapping
from enum import StrEnum
from typing import Any, cast

import numpy as np

# 1. As 7 classes nas duas ordens. O LabelEncoder indexa em ordem ALFABÉTICA, e é essa a ordem
#    do vetor de predict_proba; a API responde em ordem CLÍNICA crescente (§6.3). Confundir as
#    duas é o erro mais fácil de cometer e o mais difícil de notar: o gráfico fica bonito e errado.
ORDEM_ALFABETICA: tuple[str, ...] = (
    "Abaixo do Peso",
    "Obesidade I",
    "Obesidade II",
    "Obesidade III",
    "Peso Normal",
    "Sobrepeso I",
    "Sobrepeso II",
)
ORDEM_CLINICA: tuple[str, ...] = (
    "Abaixo do Peso",
    "Peso Normal",
    "Sobrepeso I",
    "Sobrepeso II",
    "Obesidade I",
    "Obesidade II",
    "Obesidade III",
)
CLASSES_SEGURAS: frozenset[str] = frozenset({"Abaixo do Peso", "Peso Normal"})
CLASSES_RISCO: tuple[str, ...] = tuple(c for c in ORDEM_CLINICA if c not in CLASSES_SEGURAS)


class ClasseModelo(StrEnum):
    """As 7 classes do modelo — o vocabulário do encoder, em ordem clínica."""

    ABAIXO_DO_PESO = "Abaixo do Peso"
    PESO_NORMAL = "Peso Normal"
    SOBREPESO_I = "Sobrepeso I"
    SOBREPESO_II = "Sobrepeso II"
    OBESIDADE_I = "Obesidade I"
    OBESIDADE_II = "Obesidade II"
    OBESIDADE_III = "Obesidade III"


class FaixaImc(StrEnum):
    """As 6 faixas de IMC — vocabulário de TELA, distinto do das classes do modelo (§7.5)."""

    ABAIXO_DO_PESO = "Abaixo do Peso"
    PESO_IDEAL = "Peso Ideal"
    SOBREPESO = "Sobrepeso"
    OBESIDADE_GRAU_I = "Obesidade Grau I"
    OBESIDADE_GRAU_II = "Obesidade Grau II"
    OBESIDADE_GRAU_III = "Obesidade Grau III"


# Mapa nomeado entre os dois vocabulários: o front nunca compara strings dos dois.
MAPA_CLASSE_FAIXA: dict[ClasseModelo, FaixaImc] = {
    ClasseModelo.ABAIXO_DO_PESO: FaixaImc.ABAIXO_DO_PESO,
    ClasseModelo.PESO_NORMAL: FaixaImc.PESO_IDEAL,
    ClasseModelo.SOBREPESO_I: FaixaImc.SOBREPESO,
    ClasseModelo.SOBREPESO_II: FaixaImc.SOBREPESO,
    ClasseModelo.OBESIDADE_I: FaixaImc.OBESIDADE_GRAU_I,
    ClasseModelo.OBESIDADE_II: FaixaImc.OBESIDADE_GRAU_II,
    ClasseModelo.OBESIDADE_III: FaixaImc.OBESIDADE_GRAU_III,
}

# 2. Domínios das 13 colunas categóricas do encoder (as 8 de texto E as 5 escalas ordinais, por
#    decisão do ADR 0002). Derivados uma única vez do snapshot congelado e congelados aqui como
#    literal, na ordem lexicográfica que o OneHotEncoder usaria sozinho (categories_ do legado,
#    docs/auditoria-do-legado.md). O módulo é importado em runtime: ler o CSV aqui faria o
#    contêiner depender de data/bruto/obesity.csv, que não é dependência de runtime (§3.1).
#    tests/test_dominios.py (marcado `banco`) compara com SELECT DISTINCT sobre a tabela de fonte.
DOMINIOS: dict[str, list[Any]] = {
    "Genero": ["Feminino", "Masculino"],
    "Historico_Familiar_Sobrepeso": ["Não", "Sim"],
    "Consumo_Calorico_Frequente": ["Não", "Sim"],
    "Consumo_Vegetais": [1, 2, 3],
    "Numero_Refeicoes_Principais": [1, 2, 3, 4],
    "Consumo_Alimentos_Entre_Refeicoes": ["Frequentemente", "Não", "Sempre", "Às vezes"],
    "Fumante": ["Não", "Sim"],
    "Consumo_Agua_Diario": [1, 2, 3],
    "Monitoramento_Calorias": ["Não", "Sim"],
    "Atividade_Fisica_Frequencia": [0, 1, 2, 3],
    "Tempo_Dispositivos_Tecnologicos": [0, 1, 2],
    "Consumo_Alcool": ["Frequentemente", "Não", "Sempre", "Às vezes"],
    "Meio_Transporte": ["Bicicleta", "Caminhada", "Carro", "Moto", "Transporte Público"],
}

# 3. Rótulos de exibição das 5 escalas — os textos da célula 14 do notebook, literalmente. São
#    de APRESENTAÇÃO (painel, slicers, parquet) e independentes do binning do modelo. Semeiam
#    dados.rotulos_escala e alimentam as colunas *_rotulo de base_painel.parquet (§6.1, §7.3).
ROTULOS_ESCALA: dict[str, dict[int, str]] = {
    "Consumo_Vegetais": {1: "baixa", 2: "moderada", 3: "alta"},
    "Numero_Refeicoes_Principais": {1: "1-2", 2: "1-2", 3: "3", 4: "4+"},
    "Consumo_Agua_Diario": {1: "<1L", 2: "1-2L", 3: ">2L"},
    "Atividade_Fisica_Frequencia": {0: "nenhuma", 1: "baixa", 2: "media", 3: "alta"},
    "Tempo_Dispositivos_Tecnologicos": {0: "0-2h", 1: "3-5h", 2: ">5h"},
}

# 4. Faixas de treino das 3 numéricas (do CSV; conferidas contra o snapshot em test_dominios).
#    A UI aceita mais largo (Altura 1,40–2,00; Peso 39–175); o que extrapola volta em
#    `fora_do_dominio_treino` (§6.3).
FAIXAS_TREINO: dict[str, tuple[float, float]] = {
    "Idade": (14.0, 61.0),
    "Altura": (1.45, 1.98),
    "Peso": (39.0, 173.0),
}


def calcular_imc(peso: float, altura: float) -> float:
    """IMC = peso / altura², arredondado a 2 casas — a fórmula do app legado (`round(x, 2)`)."""
    if altura <= 0:
        raise ValueError("altura precisa ser positiva")
    return round(peso / (altura**2), 2)


def classificar_imc(imc: float) -> str:
    """Faixa de IMC pelo corte padrão; fronteira inclusiva à esquerda (25,0 já é Sobrepeso)."""
    if imc < 18.5:
        return FaixaImc.ABAIXO_DO_PESO.value
    if imc < 25.0:
        return FaixaImc.PESO_IDEAL.value
    if imc < 30.0:
        return FaixaImc.SOBREPESO.value
    if imc < 35.0:
        return FaixaImc.OBESIDADE_GRAU_I.value
    if imc < 40.0:
        return FaixaImc.OBESIDADE_GRAU_II.value
    return FaixaImc.OBESIDADE_GRAU_III.value


def calcular_risco_acumulado(probabilidades: Iterable[Any] | Mapping[str, float]) -> float:
    """Soma das probabilidades das 5 classes de risco (Sobrepeso I/II, Obesidade I/II/III).

    Aceita um mapa `classe -> probabilidade`, pares `(classe, probabilidade)` ou objetos com os
    atributos `classe` e `probabilidade` (os `ProbabilidadeClasse` da resposta).
    """
    pares: list[tuple[str, float]] = []
    if isinstance(probabilidades, Mapping):
        pares = [(str(c), float(p)) for c, p in probabilidades.items()]
    else:
        for item in cast(Iterable[Any], probabilidades):
            if hasattr(item, "classe"):
                pares.append((str(item.classe), float(item.probabilidade)))
            else:
                pares.append((str(item[0]), float(item[1])))
    total = sum(prob for classe, prob in pares if classe in CLASSES_RISCO)
    return min(max(total, 0.0), 1.0)


def to_risk_flag(rotulos: Iterable[str]) -> np.ndarray:
    """1 para classe de risco, 0 para classe segura — `to_risk_flag` da célula 14(e)."""
    return np.array([1 if rotulo in CLASSES_RISCO else 0 for rotulo in rotulos], dtype=int)
