"""Agregados do painel servidos de MEMÓRIA: o lado pandas da paridade SQL × pandas (§10.9).

Lê `base_painel.parquet` uma vez no lifespan, filtra em memória e cacheia por `FiltroPainel`.
NÃO abre conexão com o banco — nenhuma requisição de gráfico toca o Postgres (ADR 0005/0006).
Chamado com filtro vazio, tem de reproduzir os JSON materializados de `sql/agregados/*.sql`
dentro das tolerâncias de §10.9.1. As regras da tabela de divergências valem aqui, linha a
linha: `n = count(coluna da medida)`, domínio explícito (grupo ausente vira n=0), ordem por
código de ponto (= COLLATE "C"), nenhum arredondamento, `NaN`/`inf` viram `None`.
"""

from __future__ import annotations

import math
from pathlib import Path
from typing import Any

import pandas as pd

from app.dominio.features import COLUNAS_COM_ALVO, COLUNAS_ESCALAS
from app.dominio.regras import DOMINIOS, ORDEM_CLINICA, ROTULOS_ESCALA
from app.nucleo.erros import ForaDoDominio
from app.utils.filtros import COLUNAS_FILTRO, FiltroPainel, aplicar_filtros

AMOSTRA_MINIMA = 15  # o mesmo @amostra_minima dos .sql de IMC médio

# campo (query param) -> (coluna do parquet, domínio em ordem de exibição, tipo de dimensão)
CAMPOS_CATEGORIA: dict[str, tuple[str, list[Any], str]] = {
    "nivel": ("Nivel_Obesidade", list(ORDEM_CLINICA), "texto"),
    "genero": ("Genero", DOMINIOS["Genero"], "texto"),
    "caloricos": ("Consumo_Calorico_Frequente", DOMINIOS["Consumo_Calorico_Frequente"], "texto"),
    "alcool": ("Consumo_Alcool", DOMINIOS["Consumo_Alcool"], "texto"),
    "atividade": (
        "Atividade_Fisica_Frequencia",
        DOMINIOS["Atividade_Fisica_Frequencia"],
        "inteiro",
    ),
    "agua": ("Consumo_Agua_Diario", DOMINIOS["Consumo_Agua_Diario"], "inteiro"),
    "historico_familiar": (
        "Historico_Familiar_Sobrepeso",
        DOMINIOS["Historico_Familiar_Sobrepeso"],
        "texto",
    ),
    "transporte": ("Meio_Transporte", DOMINIOS["Meio_Transporte"], "texto"),
}
METRICAS = ("contagem", "imc_medio")
COLUNAS_REGISTROS: list[str] = [
    "Nivel_Obesidade",
    "IMC",
    "Altura",
    "Peso",
    "Idade",
    "Atividade_Fisica_Frequencia",
    "Consumo_Agua_Diario",
    "Consumo_Alcool",
    "Consumo_Calorico_Frequente",
    "Consumo_Alimentos_Entre_Refeicoes",
    "Consumo_Vegetais",
    "Fumante",
    "Genero",
    "Historico_Familiar_Sobrepeso",
    "Meio_Transporte",
    "Monitoramento_Calorias",
    "Numero_Refeicoes_Principais",
    "Tempo_Dispositivos_Tecnologicos",
]  # as 18 colunas da tabela de Consulta (7.4)


def _num(valor: Any) -> float | None:
    """Divergências 1, 3 e 15: NaN/inf/None colapsam em None, nunca num literal inválido."""
    if valor is None:
        return None
    f = float(valor)
    return None if (math.isnan(f) or math.isinf(f)) else f


def _media(serie: pd.Series) -> tuple[float | None, int]:
    """(média, n) com `n = count(coluna)` — divergência 2 — e NaN -> None."""
    n = int(serie.count())
    return (_num(serie.mean()) if n else None), n


def _moda(serie: pd.Series) -> tuple[str | None, int]:
    """Moda com desempate por nome em código de ponto — o COLLATE "C" do SQL."""
    if serie.empty:
        return None, 0
    contagens = serie.value_counts()
    melhor = sorted(contagens.items(), key=lambda kv: (-int(kv[1]), str(kv[0])))[0]
    return str(melhor[0]), int(melhor[1])


class BasePainel:
    """A base do painel em memória e os agregados sobre ela."""

    def __init__(self, quadro: pd.DataFrame) -> None:
        """Guarda o parquet já carregado e um cache de recortes por filtro."""
        faltam = [c for c in [*COLUNAS_COM_ALVO, "IMC", "linha_origem"] if c not in quadro.columns]
        if faltam:
            raise ValueError(f"base_painel.parquet sem as colunas {faltam}")
        self.quadro = quadro.reset_index(drop=True)
        self._cache: dict[FiltroPainel, pd.DataFrame] = {}

    @classmethod
    def carregar(cls, caminho: Path) -> BasePainel:
        """Lê `data/processado/base_painel.parquet` (derivado do snapshot por treino/agregar.py)."""
        return cls(pd.read_parquet(caminho))

    @property
    def total_global(self) -> int:
        """Registros na base inteira."""
        return int(len(self.quadro))

    def filtrar(self, filtros: FiltroPainel) -> pd.DataFrame:
        """O recorte, cacheado por filtro normalizado."""
        if filtros not in self._cache:
            if len(self._cache) > 256:
                self._cache.clear()
            self._cache[filtros] = aplicar_filtros(self.quadro, filtros)
        return self._cache[filtros]

    # ---- KPIs ----
    def resumir(self, filtros: FiltroPainel = FiltroPainel()) -> dict[str, Any]:
        """Os 6 KPIs: count(*), médias (n = count da coluna) e a MODA explícita."""
        df = self.filtrar(filtros)
        moda, n_moda = _moda(df["Nivel_Obesidade"])
        return {
            "total_registros": int(len(df)),
            "idade_media": _media(df["Idade"])[0],
            "altura_media": _media(df["Altura"])[0],
            "peso_medio": _media(df["Peso"])[0],
            "nivel_predominante": moda,
            "n_predominante": n_moda,
            "total_global": self.total_global,
        }

    # ---- agregados em formato longo ----
    def agregar_por_categoria(
        self,
        campo: str,
        metrica: str,
        serie: str | None = None,
        filtros: FiltroPainel = FiltroPainel(),
    ) -> dict[str, Any]:
        """Tabela longa por categoria (e série opcional), com domínio completo e supressão."""
        if campo not in CAMPOS_CATEGORIA:
            raise ForaDoDominio(
                f"campo {campo!r} desconhecido", [{"permitidos": sorted(CAMPOS_CATEGORIA)}]
            )
        if metrica not in METRICAS:
            raise ForaDoDominio(
                f"metrica {metrica!r} desconhecida", [{"permitidos": list(METRICAS)}]
            )
        if serie is not None and (serie not in CAMPOS_CATEGORIA or serie == campo):
            raise ForaDoDominio(
                f"serie {serie!r} inválida", [{"permitidos": sorted(CAMPOS_CATEGORIA)}]
            )
        df = self.filtrar(filtros)
        coluna, dominio, tipo = CAMPOS_CATEGORIA[campo]
        dimensoes = [{"nome": campo, "tipo": tipo}]
        grupos: list[tuple[dict[str, str], pd.DataFrame]] = []
        if serie is None:
            for valor in dominio:
                grupos.append(({campo: str(valor)}, df[df[coluna] == valor]))
        else:
            col_serie, dom_serie, tipo_serie = CAMPOS_CATEGORIA[serie]
            dimensoes.append({"nome": serie, "tipo": tipo_serie})
            for valor in dominio:
                sub = df[df[coluna] == valor]
                for v2 in dom_serie:
                    grupos.append(({campo: str(valor), serie: str(v2)}, sub[sub[col_serie] == v2]))
        total = int(len(df))
        linhas: list[dict[str, Any]] = []
        ordem = 0
        if metrica == "contagem":
            medidas = [
                {"nome": "contagem", "classe": "contagem"},
                {"nome": "pct", "classe": "proporcao"},
            ]
            for dims, sub in grupos:
                n = int(len(sub))
                ordem += 1
                linhas.append(
                    {
                        "ordem": ordem,
                        **dims,
                        "medida": "contagem",
                        "valor": float(n),
                        "n": n,
                        "suprimido": False,
                    }
                )
                ordem += 1
                pct = (100.0 * n / total) if total else None  # divergência 3: total 0 -> None
                linhas.append(
                    {
                        "ordem": ordem,
                        **dims,
                        "medida": "pct",
                        "valor": pct,
                        "n": n,
                        "suprimido": False,
                    }
                )
        else:
            medidas = [{"nome": "imc_medio", "classe": "media_limitada"}]
            for dims, sub in grupos:
                media, n = _media(sub["IMC"])
                suprimido = n < AMOSTRA_MINIMA
                ordem += 1
                linhas.append(
                    {
                        "ordem": ordem,
                        **dims,
                        "medida": "imc_medio",
                        "valor": None if suprimido else media,
                        "n": n,
                        "suprimido": suprimido,
                    }
                )
        return {
            "campo": campo,
            "metrica": metrica,
            "serie": serie,
            "dimensoes": dimensoes,
            "medidas": medidas,
            "amostra_minima": AMOSTRA_MINIMA if metrica == "imc_medio" else None,
            "total_filtrado": total,
            "total_global": self.total_global,
            "recorte": filtros.como_dict(),
            "linhas": linhas,
        }

    def resumir_genero(self, filtros: FiltroPainel = FiltroPainel()) -> list[dict[str, Any]]:
        """Por gênero: n, percentual, IMC médio e faixa predominante; domínio completo."""
        df = self.filtrar(filtros)
        total = int(len(df))
        saida = []
        for genero in DOMINIOS["Genero"]:
            sub = df[df["Genero"] == genero]
            n = int(len(sub))
            imc, n_imc = _media(sub["IMC"])
            moda, n_moda = _moda(sub["Nivel_Obesidade"])
            saida.append(
                {
                    "genero": genero,
                    "n": n,
                    "percentual": (100.0 * n / total) if total else None,
                    "imc_medio": None if n_imc < AMOSTRA_MINIMA else imc,
                    "n_imc": n_imc,
                    "nivel_predominante": moda,
                    "n_predominante": n_moda,
                }
            )
        return saida

    def amostrar_pontos(
        self, amostra: int, filtros: FiltroPainel = FiltroPainel()
    ) -> list[dict[str, Any]]:
        """Até `amostra` pontos `{altura, peso, imc, nivel}`, amostra determinística."""
        df = self.filtrar(filtros)
        if amostra < len(df):
            df = df.sample(n=amostra, random_state=42).sort_values("linha_origem")
        return [
            {"altura": float(a), "peso": float(p), "imc": float(i), "nivel": str(n)}
            for a, p, i, n in zip(
                df["Altura"], df["Peso"], df["IMC"], df["Nivel_Obesidade"], strict=True
            )
        ]

    def dimensoes(self) -> dict[str, list[dict[str, Any]]]:
        """Valores distintos das 6 dimensões filtráveis (domínio global), com contagem e rótulo."""
        saida: dict[str, list[dict[str, Any]]] = {}
        for nome, (coluna, dominio) in COLUNAS_FILTRO.items():
            contagens = self.quadro[coluna].value_counts()
            rotulos = ROTULOS_ESCALA.get(coluna, {})
            saida[nome] = [
                {
                    "valor": v,
                    "rotulo": rotulos.get(v, str(v)),
                    "n": int(contagens.get(v, 0)),
                }
                for v in dominio
            ]
        return saida

    def paginar_registros(
        self,
        pagina: int,
        tamanho: int,
        ordenar_por: str,
        direcao: str,
        filtros: FiltroPainel = FiltroPainel(),
    ) -> dict[str, Any]:
        """Paginação e ordenação no servidor; `linha_origem` desempata para a ordem ser estável."""
        if ordenar_por not in COLUNAS_REGISTROS:
            raise ForaDoDominio(
                f"ordenar_por {ordenar_por!r} inválido", [{"permitidos": COLUNAS_REGISTROS}]
            )
        if direcao not in ("asc", "desc"):
            raise ForaDoDominio("direcao precisa ser asc ou desc")
        df = self.filtrar(filtros)
        ordenado = df.sort_values(
            [ordenar_por, "linha_origem"], ascending=[direcao == "asc", True], kind="mergesort"
        )
        inicio = (pagina - 1) * tamanho
        fatia = ordenado.iloc[inicio : inicio + tamanho]
        linhas = []
        for _, r in fatia.iterrows():
            linha: dict[str, Any] = {"id": int(r["linha_origem"])}
            for c in COLUNAS_REGISTROS:
                v = r[c]
                linha[c] = (
                    _num(v)
                    if c in ("IMC", "Altura", "Peso", "Idade")
                    else (int(v) if c in COLUNAS_ESCALAS else str(v))
                )
            linhas.append(linha)
        return {"total": int(len(df)), "pagina": pagina, "tamanho": tamanho, "linhas": linhas}

    def exportar_csv(self, filtros: FiltroPainel = FiltroPainel()) -> str:
        """As 18 colunas do recorte, em CSV UTF-8, na ordem de `linha_origem`."""
        df = self.filtrar(filtros).sort_values("linha_origem")
        return df[COLUNAS_REGISTROS].to_csv(index=False, lineterminator="\n")

    # ---- os 8 artefatos de sql/, reproduzidos em pandas para a paridade (§10.9) ----
    def agregado(self, agregado_id: str, filtros: FiltroPainel = FiltroPainel()) -> dict[str, Any]:
        """O documento no mesmo formato longo do materializador, para o teste de paridade."""
        construtores = {
            "resumo": self._doc_resumo,
            "por-nivel": lambda f: self._doc_categoria("por-nivel", "nivel", "contagem", f),
            "imc-por-genero": lambda f: self._doc_categoria(
                "imc-por-genero", "genero", "imc_medio", f
            ),
            "imc-por-atividade-genero": lambda f: self._doc_categoria(
                "imc-por-atividade-genero", "atividade", "imc_medio", f, serie="genero"
            ),
            "imc-por-alcool": lambda f: self._doc_categoria(
                "imc-por-alcool", "alcool", "imc_medio", f
            ),
            "caloricos": lambda f: self._doc_categoria("caloricos", "caloricos", "contagem", f),
            "genero": self._doc_genero,
            "pontos-altura-peso": self._doc_pontos,
        }
        if agregado_id not in construtores:
            raise ForaDoDominio(
                f"agregado {agregado_id!r} desconhecido", [{"permitidos": sorted(construtores)}]
            )
        return construtores[agregado_id](filtros)

    def _doc_categoria(
        self,
        agregado_id: str,
        campo: str,
        metrica: str,
        filtros: FiltroPainel,
        serie: str | None = None,
    ) -> dict[str, Any]:
        doc = self.agregar_por_categoria(campo, metrica, serie, filtros)
        return {
            "id": agregado_id,
            "dimensoes": doc["dimensoes"],
            "medidas": doc["medidas"],
            "total_linhas": len(doc["linhas"]),
            "linhas": doc["linhas"],
        }

    def _doc_resumo(self, filtros: FiltroPainel) -> dict[str, Any]:
        df = self.filtrar(filtros)
        n = int(len(df))
        idade, n_idade = _media(df["Idade"])
        altura, n_altura = _media(df["Altura"])
        peso, n_peso = _media(df["Peso"])
        moda, n_moda = _moda(df["Nivel_Obesidade"])
        linhas = [
            {
                "ordem": 1,
                "medida": "total_registros",
                "valor": float(n),
                "n": n,
                "suprimido": False,
            },
            {"ordem": 2, "medida": "idade_media", "valor": idade, "n": n_idade, "suprimido": False},
            {
                "ordem": 3,
                "medida": "altura_media",
                "valor": altura,
                "n": n_altura,
                "suprimido": False,
            },
            {"ordem": 4, "medida": "peso_medio", "valor": peso, "n": n_peso, "suprimido": False},
            {
                "ordem": 5,
                "medida": "nivel_predominante",
                "valor_texto": moda,
                "n": n_moda,
                "suprimido": False,
            },
            {
                "ordem": 6,
                "medida": "n_predominante",
                "valor": float(n_moda),
                "n": n_moda,
                "suprimido": False,
            },
        ]
        return {
            "id": "resumo",
            "dimensoes": [],
            "medidas": [
                {"nome": "total_registros", "classe": "contagem"},
                {"nome": "idade_media", "classe": "media_limitada"},
                {"nome": "altura_media", "classe": "media_limitada"},
                {"nome": "peso_medio", "classe": "media_limitada"},
                {"nome": "nivel_predominante", "classe": "texto"},
                {"nome": "n_predominante", "classe": "contagem"},
            ],
            "total_linhas": 6,
            "linhas": linhas,
        }

    def _doc_genero(self, filtros: FiltroPainel) -> dict[str, Any]:
        linhas: list[dict[str, Any]] = []
        ordem = 0
        for g in self.resumir_genero(filtros):
            for medida, valor, n, suprimido in (
                ("n", float(g["n"]), g["n"], False),
                ("percentual", g["percentual"], g["n"], False),
                ("imc_medio", g["imc_medio"], g["n_imc"], g["n_imc"] < AMOSTRA_MINIMA),
            ):
                ordem += 1
                linhas.append(
                    {
                        "ordem": ordem,
                        "genero": g["genero"],
                        "medida": medida,
                        "valor": valor,
                        "n": n,
                        "suprimido": suprimido,
                    }
                )
            ordem += 1
            linhas.append(
                {
                    "ordem": ordem,
                    "genero": g["genero"],
                    "medida": "nivel_predominante",
                    "valor_texto": g["nivel_predominante"],
                    "n": g["n_predominante"],
                    "suprimido": False,
                }
            )
        return {
            "id": "genero",
            "dimensoes": [{"nome": "genero", "tipo": "texto"}],
            "medidas": [
                {"nome": "n", "classe": "contagem"},
                {"nome": "percentual", "classe": "proporcao"},
                {"nome": "imc_medio", "classe": "media_limitada"},
                {"nome": "nivel_predominante", "classe": "texto"},
            ],
            "total_linhas": len(linhas),
            "linhas": linhas,
        }

    def _doc_pontos(self, filtros: FiltroPainel) -> dict[str, Any]:
        df = self.filtrar(filtros).sort_values("linha_origem")
        linhas = [
            {"altura": float(a), "peso": float(p), "imc": float(i), "nivel": str(n)}
            for a, p, i, n in zip(
                df["Altura"], df["Peso"], df["IMC"], df["Nivel_Obesidade"], strict=True
            )
        ]
        return {
            "id": "pontos-altura-peso",
            "colunas": ["altura", "peso", "imc", "nivel"],
            "total_linhas": len(linhas),
            "linhas": linhas,
        }
