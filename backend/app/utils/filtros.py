"""Os 6 filtros do painel (nivel, genero, agua, alcool, caloricos, historico_familiar).

Multivalorados e repetíveis, viajam como query params e são aplicados NO SERVIDOR, em memória,
sobre `base_painel.parquet` (ADR 0005). `FiltroPainel` é imutável e normalizado (tuplas
ordenadas, sem repetição) para servir de chave de cache.
"""

from __future__ import annotations

from collections.abc import Iterable
from dataclasses import dataclass, fields
from typing import Any

import pandas as pd

from app.dominio.regras import DOMINIOS, ORDEM_CLINICA
from app.nucleo.erros import ForaDoDominio

# filtro -> (coluna do parquet, domínio permitido)
COLUNAS_FILTRO: dict[str, tuple[str, list[Any]]] = {
    "nivel": ("Nivel_Obesidade", list(ORDEM_CLINICA)),
    "genero": ("Genero", DOMINIOS["Genero"]),
    "agua": ("Consumo_Agua_Diario", DOMINIOS["Consumo_Agua_Diario"]),
    "alcool": ("Consumo_Alcool", DOMINIOS["Consumo_Alcool"]),
    "caloricos": ("Consumo_Calorico_Frequente", DOMINIOS["Consumo_Calorico_Frequente"]),
    "historico_familiar": (
        "Historico_Familiar_Sobrepeso",
        DOMINIOS["Historico_Familiar_Sobrepeso"],
    ),
}


@dataclass(frozen=True)
class FiltroPainel:
    """Os 6 filtros, normalizados. Vazio = base inteira."""

    nivel: tuple[str, ...] = ()
    genero: tuple[str, ...] = ()
    agua: tuple[int, ...] = ()
    alcool: tuple[str, ...] = ()
    caloricos: tuple[str, ...] = ()
    historico_familiar: tuple[str, ...] = ()

    @property
    def vazio(self) -> bool:
        """Nenhum filtro ativo."""
        return all(not getattr(self, f.name) for f in fields(self))

    def como_dict(self) -> dict[str, list[Any]]:
        """Para o `recorte` das respostas e para os query params do front."""
        return {f.name: list(getattr(self, f.name)) for f in fields(self) if getattr(self, f.name)}


def normalizar_filtros(**listas: Iterable[Any] | None) -> FiltroPainel:
    """Valida cada valor contra o domínio (422 nomeando o filtro) e devolve o filtro normalizado."""
    normalizado: dict[str, tuple[Any, ...]] = {}
    for nome, (_, dominio) in COLUNAS_FILTRO.items():
        valores = list(listas.get(nome) or [])
        if not valores:
            continue
        convertidos: list[Any] = []
        for v in valores:
            candidato: Any = v
            if nome == "agua":
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
    return FiltroPainel(**normalizado)


def aplicar_filtros(df: pd.DataFrame, filtros: FiltroPainel) -> pd.DataFrame:
    """Interseção dos filtros ativos (dentro de um filtro, OR; entre filtros, AND)."""
    if filtros.vazio:
        return df
    mascara = pd.Series(True, index=df.index)
    for nome, (coluna, _) in COLUNAS_FILTRO.items():
        valores = getattr(filtros, nome)
        if valores:
            mascara &= df[coluna].isin(list(valores))
    return df[mascara]
