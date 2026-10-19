"""Os 6 filtros do painel da vertente diabetes: sexo, faixa etária, faixa de IMC e três respostas.

O desenho de `app.utils.filtros` (ADR 0005): multivalorados e repetíveis, viajam como query params e
são aplicados NO SERVIDOR, em memória, sobre a base do painel da vertente. `FiltroDiabetes` é
imutável e normalizado (tuplas na ordem do domínio, sem repetição) para servir de chave de cache.

O alvo não é filtro: o KPI da Visão Geral é a fração com diabetes, e com o alvo filtrado ela viraria
100% ou 0%. Os seis são os eixos dos gráficos (faixa etária, faixa de IMC e o sexo da pirâmide) e as
três entradas do modelo que mais separam a prevalência na base (pressão alta, colesterol alto e
atividade física). O nome de cada filtro é o nome da coluna no banco — o mesmo `campo` de
`/diabetes/painel/por-categoria` —, e a faixa de IMC é a coluna derivada `Faixa_IMC`.
"""

from __future__ import annotations

from collections.abc import Iterable
from dataclasses import dataclass, fields
from typing import Any

import pandas as pd

from app.diabetes.dominio.regras import COLUNA_FAIXA_IMC, DOMINIOS, ORDEM_FAIXA_IMC
from app.nucleo.erros import ForaDoDominio

# filtro -> (coluna da base do painel, domínio permitido, na ordem de exibição)
COLUNAS_FILTRO: dict[str, tuple[str, list[Any]]] = {
    "sexo": ("Sexo", DOMINIOS["Sexo"]),
    "faixa_etaria": ("Faixa_Etaria", DOMINIOS["Faixa_Etaria"]),
    "faixa_imc": (COLUNA_FAIXA_IMC, ORDEM_FAIXA_IMC),
    "pressao_alta": ("Pressao_Alta", DOMINIOS["Pressao_Alta"]),
    "colesterol_alto": ("Colesterol_Alto", DOMINIOS["Colesterol_Alto"]),
    "atividade_fisica_30_dias": ("Atividade_Fisica_30_Dias", DOMINIOS["Atividade_Fisica_30_Dias"]),
}
FILTROS_INTEIROS = frozenset({"faixa_etaria"})


@dataclass(frozen=True)
class FiltroDiabetes:
    """Os 6 filtros, normalizados. Vazio = base inteira."""

    sexo: tuple[str, ...] = ()
    faixa_etaria: tuple[int, ...] = ()
    faixa_imc: tuple[str, ...] = ()
    pressao_alta: tuple[str, ...] = ()
    colesterol_alto: tuple[str, ...] = ()
    atividade_fisica_30_dias: tuple[str, ...] = ()

    @property
    def vazio(self) -> bool:
        """Nenhum filtro ativo."""
        return all(not getattr(self, f.name) for f in fields(self))

    def como_dict(self) -> dict[str, list[Any]]:
        """Para o `recorte` das respostas e para os query params do front."""
        return {f.name: list(getattr(self, f.name)) for f in fields(self) if getattr(self, f.name)}


def normalizar_filtros(**listas: Iterable[Any] | None) -> FiltroDiabetes:
    """Valida cada valor contra o domínio (422 nomeando o filtro) e devolve o filtro normalizado."""
    normalizado: dict[str, tuple[Any, ...]] = {}
    for nome, (_, dominio) in COLUNAS_FILTRO.items():
        valores = list(listas.get(nome) or [])
        if not valores:
            continue
        convertidos: list[Any] = []
        for v in valores:
            candidato: Any = v
            if nome in FILTROS_INTEIROS:
                try:
                    candidato = int(v)
                except (TypeError, ValueError) as erro:
                    raise ForaDoDominio(
                        f"filtro {nome!r}: {v!r} não é inteiro", [{"campo": nome}]
                    ) from erro
            if candidato not in dominio:
                raise ForaDoDominio(
                    f"filtro {nome!r}: valor {v!r} fora do domínio",
                    [{"campo": nome, "permitidos": dominio}],
                )
            convertidos.append(candidato)
        normalizado[nome] = tuple(sorted(set(convertidos), key=lambda x: dominio.index(x)))
    return FiltroDiabetes(**normalizado)


def aplicar_filtros(df: pd.DataFrame, filtros: FiltroDiabetes) -> pd.DataFrame:
    """Interseção dos filtros ativos (dentro de um filtro, OR; entre filtros, AND)."""
    if filtros.vazio:
        return df
    mascara = pd.Series(True, index=df.index)
    for nome, (coluna, _) in COLUNAS_FILTRO.items():
        valores = getattr(filtros, nome)
        if valores:
            mascara &= df[coluna].isin(list(valores))
    return df[mascara]
