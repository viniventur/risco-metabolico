"""Avaliação da vertente diabetes: validação cruzada, limiares de triagem, teste e grupos.

As funções são as do notebook 02, literalmente: `validar` (célula 15), `limiar_para_recall` e
`ponto_de_operacao` (célula 29), a avaliação final no teste (célula 32), o desempenho por sexo e
por idade (célula 34) e o limiar por grupo de idade (seção "Limiar por faixa etária", células 39 a
49). Os limiares saem das predições FORA DA DOBRA do treino e o teste é olhado uma vez, para medir
— nunca para escolher. Onde a regra é por grupo de idade, o limiar entra POR LINHA: o do grupo de
cada pessoa.
"""

from __future__ import annotations

from collections.abc import Callable
from typing import Any

import numpy as np
import pandas as pd
from sklearn.metrics import (
    average_precision_score,
    brier_score_loss,
    confusion_matrix,
    precision_recall_curve,
    roc_auc_score,
)

# 1. O critério do limiar (decisão D4, célula 28): o MAIOR limiar com recall >= 0,80 fora da dobra.
RECALL_ALVO = 0.80
CRITERIO_LIMIAR = f"maior limiar com recall >= {RECALL_ALVO} nas predições fora da dobra do treino"
# A tabela de preço de cada alvo de recall (célula 29) e o segundo ponto de leitura (célula 32).
RECALLS_DA_TABELA: tuple[float, ...] = (0.70, 0.75, 0.80, 0.85, 0.90)
PRECISAO_FIXA = 0.30
# As quatro frações de um ponto de operação, como o manifest as publica.
FRACOES: tuple[str, ...] = ("recall", "precisao", "especificidade", "encaminhados")
# Os três grupos de idade da célula 34, sobre as faixas de 5 anos do BRFSS.
CORTES_IDADE: list[int] = [0, 5, 9, 13]
GRUPOS_IDADE: list[str] = ["18 a 44 anos", "45 a 64 anos", "65 anos ou mais"]
# 2. O limiar por grupo de idade (versão 1.1.0; notebook 02, `CONGELADO_POR_IDADE`): o critério do
#    limiar único aplicado DENTRO de cada um dos três grupos, sobre as mesmas predições fora da
#    dobra. As faixas de cada grupo saem dos cortes acima — uma definição só dos grupos.
CRITERIO_LIMIAR_POR_IDADE = (
    f"em cada grupo de idade, o maior limiar com recall >= {RECALL_ALVO} nas predições fora da "
    "dobra do treino"
)
FAIXAS_POR_GRUPO: dict[str, list[int]] = {
    grupo: list(range(inicio + 1, fim + 1))
    for grupo, inicio, fim in zip(GRUPOS_IDADE, CORTES_IDADE[:-1], CORTES_IDADE[1:], strict=True)
}


def validar(
    fabrica: Callable[[], Any],
    X_treino: pd.DataFrame,
    y_treino: np.ndarray,
    dobras: list[tuple[np.ndarray, np.ndarray]],
) -> tuple[np.ndarray, dict[str, float]]:
    """Predições fora da dobra e métricas por dobra (média e desvio), nas MESMAS 5 dobras."""
    fora_da_dobra = np.zeros(len(y_treino))
    por_dobra: list[list[float]] = []
    for indices_treino, indices_validacao in dobras:
        modelo = fabrica()
        modelo.fit(X_treino.iloc[indices_treino], y_treino[indices_treino])
        p = modelo.predict_proba(X_treino.iloc[indices_validacao])[:, 1]
        fora_da_dobra[indices_validacao] = p
        alvo = y_treino[indices_validacao]
        por_dobra.append(
            [
                float(roc_auc_score(alvo, p)),
                float(average_precision_score(alvo, p)),
                float(brier_score_loss(alvo, p)),
            ]
        )
    m = np.array(por_dobra)
    return fora_da_dobra, {
        "roc_auc": float(m[:, 0].mean()),
        "roc_auc_dp": float(m[:, 0].std(ddof=1)),
        "pr_auc": float(m[:, 1].mean()),
        "pr_auc_dp": float(m[:, 1].std(ddof=1)),
        "brier": float(m[:, 2].mean()),
    }


def limiar_para_recall(alvo: np.ndarray, p: np.ndarray, recall_alvo: float) -> float:
    """O maior t tal que recall(p >= t) >= recall_alvo; os empates em t entram todos."""
    ordem = np.argsort(-p, kind="mergesort")
    recall_acumulado = np.cumsum(alvo[ordem]) / alvo.sum()
    return float(p[ordem][np.argmax(recall_acumulado >= recall_alvo)])


def contagens(alvo: np.ndarray, encaminhar: np.ndarray) -> dict[str, float | int]:
    """Recall, precisão, especificidade e fração encaminhada de um encaminhamento, e a matriz."""
    vp = int((encaminhar & (alvo == 1)).sum())
    fp = int((encaminhar & (alvo == 0)).sum())
    vn = int((~encaminhar & (alvo == 0)).sum())
    fn = int((~encaminhar & (alvo == 1)).sum())
    return {
        "recall": vp / (vp + fn),
        "precisao": vp / (vp + fp),
        "especificidade": vn / (vn + fp),
        "encaminhados": float(encaminhar.mean()),
        "vp": vp,
        "fp": fp,
        "vn": vn,
        "fn": fn,
    }


def ponto_de_operacao(alvo: np.ndarray, p: np.ndarray, limiar: float) -> dict[str, float | int]:
    """Recall, precisão, especificidade e fração encaminhada com `p >= limiar`, e a matriz."""
    return {"limiar": float(limiar), **contagens(alvo, p >= limiar)}


def limiares_por_grupo(
    alvo: np.ndarray, p: np.ndarray, idade: np.ndarray, recall_alvo: float = RECALL_ALVO
) -> dict[str, float]:
    """O critério do limiar DENTRO de cada grupo de idade: `{grupo: o maior t com o alvo}`."""
    limiares: dict[str, float] = {}
    for grupo, faixas in FAIXAS_POR_GRUPO.items():
        mascara = np.isin(idade, faixas)
        if not alvo[mascara].any():
            raise ValueError(f"grupo de idade {grupo!r} sem nenhum caso positivo")
        limiares[grupo] = limiar_para_recall(alvo[mascara], p[mascara], recall_alvo)
    return limiares


def grupo_da_faixa(faixa_etaria: int) -> str:
    """O grupo de idade de uma faixa do BRFSS (1 a 13)."""
    for grupo, faixas in FAIXAS_POR_GRUPO.items():
        if faixa_etaria in faixas:
            return grupo
    raise ValueError(f"faixa etária {faixa_etaria} fora dos grupos de idade")


def limiar_por_linha(idade: np.ndarray, limiares: dict[str, float]) -> np.ndarray:
    """O limiar de cada linha: o do grupo de idade dela."""
    t = np.full(len(idade), np.nan)
    for grupo, faixas in FAIXAS_POR_GRUPO.items():
        t[np.isin(idade, faixas)] = limiares[grupo]
    if np.isnan(t).any():
        raise ValueError("faixa etária fora dos grupos de idade")
    return t


def tabela_por_idade(
    alvo: np.ndarray, p: np.ndarray, idade: np.ndarray, limiares: dict[str, float]
) -> list[dict[str, Any]]:
    """Cada grupo com as faixas, o limiar e o ponto de operação dele (as quatro frações)."""
    linhas: list[dict[str, Any]] = []
    for grupo, faixas in FAIXAS_POR_GRUPO.items():
        mascara = np.isin(idade, faixas)
        ponto = contagens(alvo[mascara], p[mascara] >= limiares[grupo])
        linhas.append(
            {
                "grupo": grupo,
                "faixas_etarias": list(faixas),
                "valor": float(limiares[grupo]),
                "fora_da_dobra": {k: float(ponto[k]) for k in FRACOES},
            }
        )
    return linhas


def estabilidade_por_idade(
    alvo: np.ndarray,
    p: np.ndarray,
    idade: np.ndarray,
    dobras: list[tuple[np.ndarray, np.ndarray]],
    recall_alvo: float = RECALL_ALVO,
) -> dict[str, dict[str, list[float]]]:
    """A estabilidade de cada limiar de grupo entre as dobras do treino.

    `limiar_por_dobra`: o limiar escolhido em cada dobra sozinha. `recall_cruzado`: o recall que o
    limiar escolhido nas OUTRAS dobras entrega na que ficou de fora.
    """
    dobra_de = np.empty(len(alvo), dtype=int)
    for k, (_, validacao) in enumerate(dobras):
        dobra_de[validacao] = k
    saida: dict[str, dict[str, list[float]]] = {
        g: {"limiar_por_dobra": [], "recall_cruzado": []} for g in FAIXAS_POR_GRUPO
    }
    for k in range(len(dobras)):
        dentro, fora = dobra_de == k, dobra_de != k
        so_a_dobra = limiares_por_grupo(alvo[dentro], p[dentro], idade[dentro], recall_alvo)
        das_outras = limiares_por_grupo(alvo[fora], p[fora], idade[fora], recall_alvo)
        for grupo, faixas in FAIXAS_POR_GRUPO.items():
            m = dentro & np.isin(idade, faixas)
            saida[grupo]["limiar_por_dobra"].append(float(so_a_dobra[grupo]))
            saida[grupo]["recall_cruzado"].append(
                float(contagens(alvo[m], p[m] >= das_outras[grupo])["recall"])
            )
    return saida


def pontos_por_idade(alvo: np.ndarray, p: np.ndarray, idade: np.ndarray) -> list[dict[str, Any]]:
    """O preço de cada alvo de recall com o limiar por grupo, fora da dobra (como a célula 43)."""
    pontos: list[dict[str, Any]] = []
    for recall_alvo in RECALLS_DA_TABELA:
        limiares = limiares_por_grupo(alvo, p, idade, recall_alvo)
        total = contagens(alvo, p >= limiar_por_linha(idade, limiares))
        pontos.append({"recall_alvo": recall_alvo, "limiares": limiares, **total})
    return pontos


def pontos_de_operacao(alvo: np.ndarray, p: np.ndarray) -> list[dict[str, float | int]]:
    """A tabela da célula 29: o limiar e o preço de cada alvo de recall, fora da dobra."""
    return [
        {"recall_alvo": r, **ponto_de_operacao(alvo, p, limiar_para_recall(alvo, p, r))}
        for r in RECALLS_DA_TABELA
    ]


def avaliar_teste(
    y_teste: np.ndarray,
    p_teste: np.ndarray,
    limiar: float | np.ndarray,
    prevalencia_treino: float,
) -> dict[str, float]:
    """A avaliação final, uma vez, no teste (célula 32): ordenação, calibração e o limiar.

    `limiar` é um número (o limiar único) ou um por linha (o do grupo de idade de cada pessoa):
    as métricas `*_no_limiar` medem a regra que classifica.
    """
    precisoes, recalls, _ = precision_recall_curve(y_teste, p_teste)
    no_limiar = contagens(y_teste, p_teste >= limiar)
    return {
        "roc_auc": float(roc_auc_score(y_teste, p_teste)),
        "pr_auc": float(average_precision_score(y_teste, p_teste)),
        "brier": float(brier_score_loss(y_teste, p_teste)),
        "brier_da_prevalencia": float(
            brier_score_loss(y_teste, np.full(len(y_teste), prevalencia_treino))
        ),
        "precisao_fixa": PRECISAO_FIXA,
        "recall_na_precisao_fixa": float(recalls[precisoes >= PRECISAO_FIXA].max()),
        "recall_no_limiar": float(no_limiar["recall"]),
        "precisao_no_limiar": float(no_limiar["precisao"]),
        "especificidade_no_limiar": float(no_limiar["especificidade"]),
        "encaminhados_no_limiar": float(no_limiar["encaminhados"]),
    }


def matriz_confusao(
    y_teste: np.ndarray, p_teste: np.ndarray, limiar: float | np.ndarray
) -> dict[str, Any]:
    """A matriz do teste na regra que classifica, com os rótulos da célula 32.

    Linhas: real; colunas: triagem. Com o limiar único, o valor dele vem junto; com um limiar por
    linha, quem chama descreve a regra.
    """
    matriz = confusion_matrix(y_teste, (p_teste >= limiar).astype("int64"), labels=[0, 1])
    descricao: dict[str, Any] = {"limiar": float(limiar)} if np.ndim(limiar) == 0 else {}
    return {
        **descricao,
        "linhas": ["real: sem diabetes", "real: com diabetes"],
        "colunas": ["não encaminhado", "encaminhado"],
        "matriz": matriz.tolist(),
    }


def por_grupo(
    X_teste: pd.DataFrame,
    y_teste: np.ndarray,
    p_teste: np.ndarray,
    limiar: float | np.ndarray,
) -> list[dict[str, Any]]:
    """Desempenho no teste por sexo e por grupo de idade (célula 34), na regra que classifica.

    `limiar` é o limiar único ou um por linha (o do grupo de idade de cada pessoa).
    """
    limiares = np.broadcast_to(np.asarray(limiar, dtype="float64"), p_teste.shape)
    grupo_idade = pd.cut(X_teste["Faixa_Etaria"], CORTES_IDADE, labels=GRUPOS_IDADE)
    linhas: list[dict[str, Any]] = []
    for nome, chave in (("sexo", X_teste["Sexo"]), ("idade", grupo_idade)):
        for valor in chave.dropna().unique():
            mascara = (chave == valor).to_numpy()
            alvo, p = y_teste[mascara], p_teste[mascara]
            ponto = contagens(alvo, p >= limiares[mascara])
            linhas.append(
                {
                    "grupo": nome,
                    "valor": str(valor),
                    "n": int(mascara.sum()),
                    "prevalencia": float(alvo.mean()),
                    "probabilidade_media": float(p.mean()),
                    "roc_auc": float(roc_auc_score(alvo, p)),
                    "recall": float(ponto["recall"]),
                    "precisao": float(ponto["precisao"]),
                    "encaminhados": float(ponto["encaminhados"]),
                }
            )
    return sorted(linhas, key=lambda linha: (linha["grupo"], linha["valor"]))
