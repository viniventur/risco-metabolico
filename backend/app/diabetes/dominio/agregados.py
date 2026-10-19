"""Agregados do painel da vertente diabetes servidos de MEMÓRIA: o lado pandas da paridade (§10.9).

O desenho de `app.dominio.agregados`: a base do painel da vertente é lida uma vez no lifespan,
filtrada em memória e nunca abre conexão com o banco (ADR 0005/0006). Com filtro vazio,
`agregado(id)` tem de reproduzir os JSON materializados de sql/diabetes/agregados/*.sql nas
tolerâncias de §10.9.1, com as mesmas regras: domínio explícito (grupo ausente vira n=0), a ordem
do domínio, nenhum arredondamento, e NaN ou infinito viram None.

Duas diferenças, as duas por causa do tamanho (253.680 linhas contra 2.111):

- a base fica em memória com tipos pequenos — as colunas de texto como categoria (o domínio, na
  ordem dele, como categorias), as escalas em int8 e o IMC em float64, que é o que a média precisa
  para bater com o `avg` do SQL. Com os tipos do snapshot ela ocuparia dezenas de vezes mais;
- o cache de recortes guarda poucos recortes (um recorte da base inteira tem megabytes, não
  kilobytes), e o da ordem da Consulta poucas ordens, os dois com trava, porque as rotas síncronas
  rodam em threads. As contagens saem de `bincount` sobre os códigos, não de `groupby`.

As medidas de cada grupo são as quatro dos `.sql`: `contagem`, `pct` (do total do recorte),
`n_diabetes` e `prevalencia` (a fração com diabetes dentro do grupo, em pontos percentuais), esta
suprimida abaixo de AMOSTRA_MINIMA respostas, como as médias da vertente de obesidade.
"""

from __future__ import annotations

import math
import threading
from collections import OrderedDict
from collections.abc import Iterator
from pathlib import Path
from typing import Any

import numpy as np
import pandas as pd

from app.diabetes.dominio.features import (
    COLUNAS_COM_ALVO,
    COLUNAS_INTEIRAS,
    COLUNAS_NUMERICAS,
    COLUNAS_SIM_NAO,
    COLUNAS_TEXTO,
    coluna_banco,
)
from app.diabetes.dominio.filtros import COLUNAS_FILTRO, FiltroDiabetes, aplicar_filtros
from app.diabetes.dominio.regras import (
    COLUNA_FAIXA_IMC,
    DOMINIOS,
    ORDEM_FAIXA_IMC,
    ROTULOS_COLUNAS,
    rotulo_valor,
)
from app.nucleo.erros import ForaDoDominio

AMOSTRA_MINIMA = 15  # o @amostra_minima dos .sql desta vertente — e o das médias da obesidade
RECORTES_EM_CACHE = 4  # recortes filtrados guardados; a base inteira não conta (é a própria base)
LINHAS_POR_BLOCO = 20_000  # linhas de CSV por bloco da exportação em streaming

# As 23 colunas da Consulta: as 22 da base, na ordem canônica, e a faixa de IMC logo depois do IMC.
COLUNAS_REGISTROS: list[str] = [
    nome
    for coluna in COLUNAS_COM_ALVO
    for nome in ((coluna, COLUNA_FAIXA_IMC) if coluna == "IMC" else (coluna,))
]
COLUNAS_BASE: list[str] = ["linha_origem", *COLUNAS_REGISTROS]

# campo (query param = nome da coluna no banco) -> (coluna da base, domínio em ordem, tipo da
# dimensão). Toda coluna da base menos o IMC, que entra pela faixa (a coluna derivada).
CAMPOS_CATEGORIA: dict[str, tuple[str, list[Any], str]] = {
    **{
        coluna_banco(c): (c, DOMINIOS[c], "inteiro" if c in COLUNAS_INTEIRAS else "texto")
        for c in COLUNAS_COM_ALVO
        if c not in COLUNAS_NUMERICAS
    },
    coluna_banco(COLUNA_FAIXA_IMC): (COLUNA_FAIXA_IMC, ORDEM_FAIXA_IMC, "texto"),
}

# Os 16 fatores do gráfico de fatores (as 13 de sim ou não, a saúde geral, a escolaridade e a
# renda), na ordem canônica das colunas — a mesma do domínio de sql/diabetes/agregados/fatores.sql.
# Idade, sexo e IMC têm gráfico próprio; os dois "dias de saúde ruim" ficam na Consulta.
FATORES: list[str] = [
    coluna_banco(c)
    for c in COLUNAS_COM_ALVO
    if c in (*COLUNAS_SIM_NAO, "Saude_Geral", "Escolaridade", "Faixa_Renda")
]

DIMENSOES_FATORES: list[dict[str, str]] = [
    {"nome": "fator", "tipo": "texto"},
    {"nome": "resposta", "tipo": "texto"},
]
MEDIDAS: list[dict[str, str]] = [
    {"nome": "contagem", "classe": "contagem"},
    {"nome": "pct", "classe": "proporcao"},
    {"nome": "n_diabetes", "classe": "contagem"},
    {"nome": "prevalencia", "classe": "proporcao"},
]
MEDIDAS_RESUMO: list[dict[str, str]] = [
    {"nome": "total_registros", "classe": "contagem"},
    {"nome": "n_diabetes", "classe": "contagem"},
    {"nome": "prevalencia", "classe": "proporcao"},
    {"nome": "imc_medio", "classe": "media_limitada"},
]


def tipos_da_base() -> dict[str, Any]:
    """Coluna -> dtype pequeno: categoria com o domínio, int8 nas escalas, float64 no IMC."""
    tipos: dict[str, Any] = {"linha_origem": "int32"}
    for coluna in COLUNAS_REGISTROS:
        if coluna == COLUNA_FAIXA_IMC:
            tipos[coluna] = pd.CategoricalDtype(ORDEM_FAIXA_IMC)
        elif coluna in COLUNAS_TEXTO:
            tipos[coluna] = pd.CategoricalDtype(DOMINIOS[coluna])
        elif coluna in COLUNAS_INTEIRAS:
            tipos[coluna] = "int8"
        else:
            tipos[coluna] = "float64"
    return tipos


def tipar(quadro: pd.DataFrame) -> pd.DataFrame:
    """As 24 colunas da base, na ordem e com os tipos pequenos; valor fora do domínio é erro."""
    tipos = tipos_da_base()
    faltam = [c for c in tipos if c not in quadro.columns]
    if faltam:
        raise ValueError(f"base do painel da vertente diabetes sem as colunas {faltam}")
    tipado = quadro[list(tipos)].astype(tipos)
    for coluna, tipo in tipos.items():
        # O astype para categoria troca o valor desconhecido por NaN, e o de int8 dá a volta no
        # estouro: os dois em silêncio. A conferência é explícita.
        if isinstance(tipo, pd.CategoricalDtype) and tipado[coluna].isna().any():
            raise ValueError(f"{coluna}: valor fora do domínio na base do painel")
        if tipo == "int8" and not (tipado[coluna].astype("int64") == quadro[coluna]).all():
            raise ValueError(f"{coluna}: valor fora da faixa de int8 na base do painel")
    return tipado


def _num(valor: Any) -> float | None:
    """NaN, infinito e None colapsam em None, nunca num literal inválido (divergências 1, 3, 15)."""
    if valor is None:
        return None
    f = float(valor)
    return None if (math.isnan(f) or math.isinf(f)) else f


def _media(serie: pd.Series) -> tuple[float | None, int]:
    """(média, n) com `n = count(coluna)` (divergência 2) e NaN -> None."""
    n = int(serie.count())
    return (_num(serie.mean()) if n else None), n


def _linhas_do_grupo(dims: dict[str, str], n: int, k: int, total: int) -> list[dict[str, Any]]:
    """As quatro medidas de um grupo, na ordem de `MEDIDAS` (a do `ordem_medida` dos .sql)."""
    suprimido = n < AMOSTRA_MINIMA
    return [
        {**dims, "medida": "contagem", "valor": float(n), "n": n, "suprimido": False},
        {
            **dims,
            "medida": "pct",
            "valor": (100.0 * n / total) if total else None,  # divergência 3: total 0 -> None
            "n": n,
            "suprimido": False,
        },
        {**dims, "medida": "n_diabetes", "valor": float(k), "n": k, "suprimido": False},
        {
            **dims,
            "medida": "prevalencia",
            "valor": None if suprimido else 100.0 * k / n,
            "n": n,
            "suprimido": suprimido,
        },
    ]


def _numerar(linhas: list[dict[str, Any]]) -> list[dict[str, Any]]:
    """`ordem` 1..N na frente de cada linha (invariante 6)."""
    return [{"ordem": i, **linha} for i, linha in enumerate(linhas, start=1)]


def descrever_campo(campo: str) -> dict[str, Any]:
    """Rótulo do campo e de cada valor do domínio, na ordem de exibição (APRESENTAÇÃO)."""
    coluna, dominio, _ = CAMPOS_CATEGORIA[campo]
    return {
        "campo": campo,
        "rotulo": ROTULOS_COLUNAS[coluna],
        "valores": [{"valor": str(v), "rotulo": rotulo_valor(coluna, v)} for v in dominio],
    }


class BasePainelDiabetes:
    """A base do painel da vertente diabetes em memória e os agregados sobre ela."""

    def __init__(self, quadro: pd.DataFrame) -> None:
        """Tipa a base, confere a ordem por `linha_origem` e prepara o cache de recortes."""
        base = tipar(quadro).reset_index(drop=True)
        if not base["linha_origem"].is_monotonic_increasing:
            raise ValueError("base do painel fora da ordem de linha_origem")
        base["_com_diabetes"] = base["Diabetes"] == "Sim"
        self.quadro = base
        self._cache: OrderedDict[FiltroDiabetes, pd.DataFrame] = OrderedDict()
        self._ordens: OrderedDict[tuple[FiltroDiabetes, str, str], np.ndarray] = OrderedDict()
        self._trava = threading.Lock()

    @classmethod
    def carregar(cls, caminho: Path) -> BasePainelDiabetes:
        """Lê data/processado/diabetes/base_painel.parquet (derivado do snapshot)."""
        return cls(pd.read_parquet(caminho))

    @property
    def total_global(self) -> int:
        """Respostas na base inteira."""
        return int(len(self.quadro))

    @property
    def n_diabetes_global(self) -> int:
        """Respostas de quem tem diabetes, na base inteira."""
        return int(self.quadro["_com_diabetes"].sum())

    def filtrar(self, filtros: FiltroDiabetes) -> pd.DataFrame:
        """O recorte; a base inteira não é copiada, e só poucos recortes ficam em cache (LRU)."""
        if filtros.vazio:
            return self.quadro
        with self._trava:
            if filtros in self._cache:
                self._cache.move_to_end(filtros)
                return self._cache[filtros]
        recorte = aplicar_filtros(self.quadro, filtros)
        with self._trava:
            self._cache[filtros] = recorte
            while len(self._cache) > RECORTES_EM_CACHE:
                self._cache.popitem(last=False)
        return recorte

    @staticmethod
    def _contagens(df: pd.DataFrame, colunas: list[str]) -> dict[Any, tuple[int, int]]:
        """(n, n_diabetes) por valor observado de `colunas`; quem preenche o domínio é quem chama.

        Conta nos códigos, sem `groupby`: o código da categoria (texto) ou o próprio inteiro (as
        escalas e os dias, todos >= 0), combinados num código só quando há duas colunas, e um
        `bincount` para o total e outro para quem tem diabetes. A chave volta ao valor do domínio
        (str ou int), a de duas colunas como tupla.
        """
        if df.empty:
            return {}
        com_diabetes = df["_com_diabetes"].to_numpy()
        combinado: np.ndarray | None = None
        valores_por_coluna: list[list[Any]] = []
        for coluna in colunas:
            serie = df[coluna]
            if isinstance(serie.dtype, pd.CategoricalDtype):
                codigos = serie.cat.codes.to_numpy()
                valores = list(serie.cat.categories)
            else:
                codigos = serie.to_numpy()
                valores = list(range(int(codigos.max()) + 1))
            # Uma coluna conta direto nos códigos pequenos (int8); duas combinam em int64.
            combinado = (
                codigos
                if combinado is None
                else combinado.astype(np.int64) * len(valores) + codigos
            )
            valores_por_coluna.append(valores)
        assert combinado is not None
        tamanho = math.prod(len(v) for v in valores_por_coluna)
        n = np.bincount(combinado, minlength=tamanho)
        k = np.bincount(combinado[com_diabetes], minlength=tamanho)
        saida: dict[Any, tuple[int, int]] = {}
        for indice in np.flatnonzero(n).tolist():
            partes: list[Any] = []
            resto = indice
            for valores in reversed(valores_por_coluna):
                resto, posicao = divmod(resto, len(valores))
                partes.append(valores[posicao])
            partes.reverse()
            chave = partes[0] if len(partes) == 1 else tuple(partes)
            saida[chave] = (int(n[indice]), int(k[indice]))
        return saida

    # ---- KPIs ----
    def resumir(self, filtros: FiltroDiabetes = FiltroDiabetes()) -> dict[str, Any]:
        """Respostas, com diabetes, a prevalência e o IMC médio do recorte e da base inteira."""
        df = self.filtrar(filtros)
        n = int(len(df))
        k = int(df["_com_diabetes"].sum())
        total, k_total = self.total_global, self.n_diabetes_global
        return {
            "total_registros": n,
            "n_diabetes": k,
            "prevalencia": (100.0 * k / n) if n else None,
            "imc_medio": _media(df["IMC"])[0],
            "total_global": total,
            "n_diabetes_global": k_total,
            "prevalencia_global": (100.0 * k_total / total) if total else None,
        }

    # ---- agregados em formato longo ----
    def agregar_por_categoria(
        self,
        campo: str,
        serie: str | None = None,
        filtros: FiltroDiabetes = FiltroDiabetes(),
    ) -> dict[str, Any]:
        """Tabela longa por categoria (e série opcional): as quatro medidas, domínio completo."""
        if campo not in CAMPOS_CATEGORIA:
            raise ForaDoDominio(
                f"campo {campo!r} desconhecido", [{"permitidos": list(CAMPOS_CATEGORIA)}]
            )
        if serie is not None and (serie not in CAMPOS_CATEGORIA or serie == campo):
            raise ForaDoDominio(
                f"serie {serie!r} inválida", [{"permitidos": list(CAMPOS_CATEGORIA)}]
            )
        df = self.filtrar(filtros)
        total = int(len(df))
        coluna, dominio, tipo = CAMPOS_CATEGORIA[campo]
        dimensoes = [{"nome": campo, "tipo": tipo}]
        linhas: list[dict[str, Any]] = []
        if serie is None:
            contagens = self._contagens(df, [coluna])
            for valor in dominio:
                n, k = contagens.get(valor, (0, 0))
                linhas += _linhas_do_grupo({campo: str(valor)}, n, k, total)
        else:
            col_serie, dom_serie, tipo_serie = CAMPOS_CATEGORIA[serie]
            dimensoes.append({"nome": serie, "tipo": tipo_serie})
            contagens = self._contagens(df, [coluna, col_serie])
            for valor in dominio:
                for v2 in dom_serie:
                    n, k = contagens.get((valor, v2), (0, 0))
                    linhas += _linhas_do_grupo({campo: str(valor), serie: str(v2)}, n, k, total)
        return {
            "campo": campo,
            "serie": serie,
            "dimensoes": dimensoes,
            "medidas": MEDIDAS,
            "amostra_minima": AMOSTRA_MINIMA,
            "total_filtrado": total,
            "total_global": self.total_global,
            "recorte": filtros.como_dict(),
            "campos": [descrever_campo(c) for c in (campo, serie) if c is not None],
            "linhas": _numerar(linhas),
        }

    def fatores(self, filtros: FiltroDiabetes = FiltroDiabetes()) -> dict[str, Any]:
        """Os 16 fatores × respostas: as quatro medidas de cada resposta, domínio completo."""
        df = self.filtrar(filtros)
        total = int(len(df))
        linhas: list[dict[str, Any]] = []
        for fator in FATORES:
            coluna, dominio, _ = CAMPOS_CATEGORIA[fator]
            contagens = self._contagens(df, [coluna])
            for valor in dominio:
                n, k = contagens.get(valor, (0, 0))
                # O total de cada fator é o do recorte: a base não tem nulo (FONTE.md).
                linhas += _linhas_do_grupo({"fator": fator, "resposta": str(valor)}, n, k, total)
        return {
            "dimensoes": DIMENSOES_FATORES,
            "medidas": MEDIDAS,
            "amostra_minima": AMOSTRA_MINIMA,
            "total_filtrado": total,
            "total_global": self.total_global,
            "recorte": filtros.como_dict(),
            "campos": [descrever_campo(f) for f in FATORES],
            "linhas": _numerar(linhas),
        }

    def dimensoes(self) -> dict[str, list[dict[str, Any]]]:
        """Os valores dos 6 filtros (domínio global), com rótulo e contagem na base inteira."""
        saida: dict[str, list[dict[str, Any]]] = {}
        for nome, (coluna, dominio) in COLUNAS_FILTRO.items():
            contagens = self.quadro[coluna].value_counts()
            saida[nome] = [
                {"valor": v, "rotulo": rotulo_valor(coluna, v), "n": int(contagens.get(v, 0))}
                for v in dominio
            ]
        return saida

    # ---- Consulta ----
    def paginar_registros(
        self,
        pagina: int,
        tamanho: int,
        ordenar_por: str,
        direcao: str,
        filtros: FiltroDiabetes = FiltroDiabetes(),
    ) -> dict[str, Any]:
        """Paginação e ordenação no servidor; `linha_origem` desempata para a ordem ser estável.

        As colunas de texto ordenam pela ordem do domínio (a da categoria): "Não" antes de "Sim" e
        as faixas de IMC na ordem da escala, não na alfabética.
        """
        if ordenar_por not in COLUNAS_REGISTROS:
            raise ForaDoDominio(
                f"ordenar_por {ordenar_por!r} inválido", [{"permitidos": COLUNAS_REGISTROS}]
            )
        if direcao not in ("asc", "desc"):
            raise ForaDoDominio("direcao precisa ser asc ou desc")
        df = self.filtrar(filtros)
        ordem = self._ordenar(df, filtros, ordenar_por, direcao)
        inicio = (pagina - 1) * tamanho
        fatia = self.quadro.loc[ordem[inicio : inicio + tamanho]]
        linhas = []
        for registro in fatia[COLUNAS_BASE].to_dict(orient="records"):
            linha: dict[str, Any] = {"id": int(registro["linha_origem"])}
            for coluna in COLUNAS_REGISTROS:
                valor = registro[coluna]
                if coluna in COLUNAS_NUMERICAS:
                    linha[coluna] = _num(valor)
                elif coluna in COLUNAS_INTEIRAS:
                    linha[coluna] = int(valor)
                else:
                    linha[coluna] = str(valor)
            linhas.append(linha)
        return {"total": int(len(df)), "pagina": pagina, "tamanho": tamanho, "linhas": linhas}

    def _ordenar(
        self, df: pd.DataFrame, filtros: FiltroDiabetes, ordenar_por: str, direcao: str
    ) -> np.ndarray:
        """Os rótulos do recorte na ordem pedida, guardados para a página seguinte não reordenar.

        Ordenar a base inteira custa dezenas de milissegundos; folhear a Consulta pede a mesma
        ordem várias vezes. O índice da base é a posição (0..n-1), e o do recorte o preserva.
        """
        chave = (filtros, ordenar_por, direcao)
        with self._trava:
            if chave in self._ordens:
                self._ordens.move_to_end(chave)
                return self._ordens[chave]
        ordem = df.sort_values(
            [ordenar_por, "linha_origem"], ascending=[direcao == "asc", True], kind="mergesort"
        ).index.to_numpy()
        with self._trava:
            self._ordens[chave] = ordem
            while len(self._ordens) > RECORTES_EM_CACHE:
                self._ordens.popitem(last=False)
        return ordem

    def exportar_csv(self, filtros: FiltroDiabetes = FiltroDiabetes()) -> Iterator[str]:
        """As 23 colunas do recorte em CSV, na ordem de `linha_origem`, em blocos (streaming).

        Nenhum teto: o recorte inteiro sai, mas nunca montado de uma vez — cada bloco é gerado
        quando o anterior já foi enviado.
        """
        df = self.filtrar(filtros)[COLUNAS_REGISTROS]
        yield df.head(0).to_csv(index=False, lineterminator="\n")
        for inicio in range(0, len(df), LINHAS_POR_BLOCO):
            yield df.iloc[inicio : inicio + LINHAS_POR_BLOCO].to_csv(
                index=False, header=False, lineterminator="\n"
            )

    # ---- os 5 artefatos de sql/diabetes/agregados, reproduzidos em pandas para a paridade ----
    def agregado(
        self, agregado_id: str, filtros: FiltroDiabetes = FiltroDiabetes()
    ) -> dict[str, Any]:
        """O documento no mesmo formato longo do materializador, para o teste de paridade."""
        construtores = {
            "resumo": self._doc_resumo,
            "prevalencia-por-idade": lambda f: self._doc_categoria(
                "prevalencia-por-idade", "faixa_etaria", None, f
            ),
            "prevalencia-por-imc": lambda f: self._doc_categoria(
                "prevalencia-por-imc", "faixa_imc", None, f
            ),
            "piramide-idade-sexo": lambda f: self._doc_categoria(
                "piramide-idade-sexo", "faixa_etaria", "sexo", f
            ),
            "fatores": self._doc_fatores,
        }
        if agregado_id not in construtores:
            raise ForaDoDominio(
                f"agregado {agregado_id!r} desconhecido", [{"permitidos": sorted(construtores)}]
            )
        return construtores[agregado_id](filtros)

    def _doc_categoria(
        self, agregado_id: str, campo: str, serie: str | None, filtros: FiltroDiabetes
    ) -> dict[str, Any]:
        doc = self.agregar_por_categoria(campo, serie, filtros)
        return {
            "id": agregado_id,
            "dimensoes": doc["dimensoes"],
            "medidas": doc["medidas"],
            "total_linhas": len(doc["linhas"]),
            "linhas": doc["linhas"],
        }

    def _doc_fatores(self, filtros: FiltroDiabetes) -> dict[str, Any]:
        doc = self.fatores(filtros)
        return {
            "id": "fatores",
            "dimensoes": doc["dimensoes"],
            "medidas": doc["medidas"],
            "total_linhas": len(doc["linhas"]),
            "linhas": doc["linhas"],
        }

    def _doc_resumo(self, filtros: FiltroDiabetes) -> dict[str, Any]:
        df = self.filtrar(filtros)
        n = int(len(df))
        k = int(df["_com_diabetes"].sum())
        imc, n_imc = _media(df["IMC"])
        linhas: list[dict[str, Any]] = [
            {"medida": "total_registros", "valor": float(n), "n": n, "suprimido": False},
            {"medida": "n_diabetes", "valor": float(k), "n": k, "suprimido": False},
            {
                "medida": "prevalencia",
                "valor": (100.0 * k / n) if n else None,
                "n": n,
                "suprimido": False,
            },
            {"medida": "imc_medio", "valor": imc, "n": n_imc, "suprimido": False},
        ]
        return {
            "id": "resumo",
            "dimensoes": [],
            "medidas": MEDIDAS_RESUMO,
            "total_linhas": len(linhas),
            "linhas": _numerar(linhas),
        }
