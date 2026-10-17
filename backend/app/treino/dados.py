"""O snapshot de treino: um `SELECT` congelado em parquet cujo sha256 é o `versao_dados` (§4.3.6).

Recebe a CONEXÃO, nunca uma DSN: quem abre a transação `REPEATABLE READ` é `__main__.py`.
Abrir conexão própria aqui faria o snapshot enxergar uma imagem do banco diferente da que os
agregados enxergam, e a garantia de que `versao_dados` descreve as linhas agregadas seria falsa
em silêncio.
"""

from __future__ import annotations

import hashlib
import json
from dataclasses import dataclass
from pathlib import Path
from typing import TYPE_CHECKING, Any

import numpy as np
import pandas as pd
import pyarrow as pa
import pyarrow.parquet as pq

from app.dominio.features import (
    ALVO,
    COLUNAS_BANCO,
    COLUNAS_COM_ALVO,
    COLUNAS_ESCALAS,
    COLUNAS_MAP_BANCO,
    COLUNAS_NUMERICAS,
    DTYPES_SNAPSHOT,
)

if TYPE_CHECKING:
    import psycopg

TABELA_ORIGEM = "dados.registros_triagem"
COLUNAS_SQL: list[str] = [COLUNAS_BANCO[c] for c in COLUNAS_COM_ALVO]
# O ORDER BY sobre a chave TOTAL é obrigatório: sem ele o Postgres não promete ordem, e ordem
# diferente é sha256 diferente — versao_dados deixaria de significar "estes dados".
CONSULTA_SNAPSHOT = (
    "SELECT " + ", ".join(COLUNAS_SQL) + f"\n  FROM {TABELA_ORIGEM}\n ORDER BY linha_origem"
)
PREFIXO_SNAPSHOT = "snapshot-"
TEMPORARIO = "_snapshot.tmp.parquet"


@dataclass(frozen=True)
class InfoSnapshot:
    """O que `gerar_snapshot` devolve: tudo que o manifest precisa saber do congelado."""

    versao_dados: str
    caminho: Path
    sha256_arquivo: str
    sha256_conteudo: str
    sha256_carga: str
    linhas: int
    colunas: int


def sha256_de(caminho: Path) -> str:
    """sha256 do arquivo, em hexadecimal."""
    return hashlib.sha256(caminho.read_bytes()).hexdigest()


def sha256_de_stream_arrow(tabela: pa.Table) -> str:
    """Hash do CONTEÚDO canônico (IPC stream do Arrow): independe do writer de parquet."""
    sink = pa.BufferOutputStream()
    with pa.ipc.new_stream(sink, tabela.schema) as escritor:
        escritor.write_table(tabela)
    return hashlib.sha256(sink.getvalue().to_pybytes()).hexdigest()


def perfil_numerico(quadro: pd.DataFrame) -> dict[str, dict[str, float]]:
    """{coluna: {n, media, desvio, p01, p50, p99}} das 3 numéricas e das 5 escalas."""
    perfil: dict[str, dict[str, float]] = {}
    for col in [*COLUNAS_NUMERICAS, *COLUNAS_ESCALAS]:
        serie = quadro[col].astype("float64")
        perfil[col] = {
            "n": int(serie.count()),
            "media": float(serie.mean()),
            "desvio": float(serie.std(ddof=1)),
            "p01": float(serie.quantile(0.01)),
            "p50": float(serie.quantile(0.50)),
            "p99": float(serie.quantile(0.99)),
        }
    return perfil


def ler_tabela_fonte(con: psycopg.Connection[Any]) -> pd.DataFrame:
    """Executa o SELECT congelado e devolve o DataFrame com nomes e tipos canônicos (§4.3.3)."""
    with con.cursor() as cur:
        cur.execute(CONSULTA_SNAPSHOT)
        colunas = [d.name for d in cur.description or []]
        linhas = cur.fetchall()
    quadro = pd.DataFrame(linhas, columns=colunas)
    quadro = quadro.rename(columns=COLUNAS_MAP_BANCO)[COLUNAS_COM_ALVO]  # nomes e ordem canônicos
    quadro = quadro.astype(DTYPES_SNAPSHOT)  # tipos fixos, não os do driver
    assert quadro.dtypes.astype(str).to_dict() == DTYPES_SNAPSHOT, "dtype fora do contrato de 4.3.3"
    return quadro


def sha256_da_carga_corrente(con: psycopg.Connection[Any]) -> str:
    """O sha256_arquivo da última carga da tabela de fonte (operacao.carga_fonte)."""
    with con.cursor() as cur:
        cur.execute(
            "SELECT sha256_arquivo FROM operacao.carga_fonte "
            "WHERE tabela_destino = %s ORDER BY id DESC LIMIT 1",
            (TABELA_ORIGEM,),
        )
        linha = cur.fetchone()
    if linha is None:
        raise RuntimeError("nenhuma carga registrada: rode python -m app.dados.seed antes")
    return str(linha[0]).strip()


def escrever_parquet(quadro: pd.DataFrame, destino: Path) -> tuple[str, str]:
    """Grava o parquet com TODOS os parâmetros do writer fixos; devolve os dois sha256.

    Cada default que sobra é um byte que o pyarrow pode mudar de versão para versão. O
    `replace_schema_metadata(None)` tira a metadata do pandas, que varia.
    """
    tabela = pa.Table.from_pandas(quadro, preserve_index=False).replace_schema_metadata(None)
    pq.write_table(
        tabela,
        destino,
        compression="zstd",
        compression_level=3,
        version="2.6",
        row_group_size=len(quadro),
        use_dictionary=False,
        write_statistics=False,
        store_schema=False,
    )
    return sha256_de(destino), sha256_de_stream_arrow(tabela)


def registrar_snapshot(
    con: psycopg.Connection[Any],
    *,
    sha_arquivo: str,
    sha_conteudo: str,
    quadro: pd.DataFrame,
    sha_carga: str,
) -> None:
    """Grava a linha de operacao.snapshot_treino. Idempotente por sha256_arquivo (ON CONFLICT)."""
    with con.cursor() as cur:
        cur.execute(
            "INSERT INTO operacao.snapshot_treino "
            "(sha256_arquivo, versao_dados, sha256_conteudo, tabela_origem, consulta_sql, "
            " linhas, colunas, perfil_numerico, sha256_carga) "
            "VALUES (%s, %s, %s, %s, %s, %s, %s, %s::jsonb, %s) "
            "ON CONFLICT (sha256_arquivo) DO UPDATE SET gerado_em = now(), "
            "perfil_numerico = EXCLUDED.perfil_numerico, consulta_sql = EXCLUDED.consulta_sql, "
            "sha256_carga = EXCLUDED.sha256_carga",
            (
                sha_arquivo,
                sha_arquivo[:12],
                sha_conteudo,
                TABELA_ORIGEM,
                CONSULTA_SNAPSHOT,
                len(quadro),
                len(quadro.columns),
                json.dumps(perfil_numerico(quadro)),
                sha_carga,
            ),
        )


def gerar_snapshot(con: psycopg.Connection[Any], pasta: Path) -> InfoSnapshot:
    """Congela a tabela de fonte em parquet; devolve versão, caminho e os hashes.

    O nome `snapshot-<versao_dados>.parquet` só existe depois de o arquivo existir (o hash é do
    próprio arquivo): escreve-se um temporário, calcula-se o sha256 e renomeia-se. Qualquer outro
    `snapshot-*.parquet` com hash diferente é apagado, para a pasta nunca ter dois candidatos.
    """
    pasta.mkdir(parents=True, exist_ok=True)
    quadro = ler_tabela_fonte(con)
    sha_carga = sha256_da_carga_corrente(con)
    temporario = pasta / TEMPORARIO
    sha_arquivo, sha_conteudo = escrever_parquet(quadro, temporario)
    versao_dados = sha_arquivo[:12]
    destino = pasta / f"{PREFIXO_SNAPSHOT}{versao_dados}.parquet"
    for antigo in pasta.glob(f"{PREFIXO_SNAPSHOT}*.parquet"):
        if antigo != destino:
            antigo.unlink()
    if destino.exists():
        destino.unlink()
    temporario.replace(destino)
    registrar_snapshot(
        con, sha_arquivo=sha_arquivo, sha_conteudo=sha_conteudo, quadro=quadro, sha_carga=sha_carga
    )
    return InfoSnapshot(
        versao_dados=versao_dados,
        caminho=destino,
        sha256_arquivo=sha_arquivo,
        sha256_conteudo=sha_conteudo,
        sha256_carga=sha_carga,
        linhas=int(len(quadro)),
        colunas=int(len(quadro.columns)),
    )


def carregar_snapshot(caminho: Path, *, sha256_esperado: str | None = None) -> pd.DataFrame:
    """Lê o snapshot congelado, conferindo o sha256 do arquivo quando informado."""
    if not caminho.exists():
        raise FileNotFoundError(
            f"snapshot não encontrado: {caminho.name} (rode python -m app.treino congelar)"
        )
    if sha256_esperado is not None:
        real = sha256_de(caminho)
        if real != sha256_esperado:
            raise RuntimeError(
                f"sha256 do snapshot {caminho.name} não bate com o manifest: "
                f"esperado {sha256_esperado[:12]}…, real {real[:12]}…"
            )
    quadro = pq.read_table(caminho).to_pandas()
    quadro = quadro[COLUNAS_COM_ALVO].astype(DTYPES_SNAPSHOT)
    return quadro


def separar_alvo(quadro: pd.DataFrame) -> tuple[pd.DataFrame, pd.Series]:
    """`X = df.drop(columns=[TARGET])`, `y = df[TARGET]` — célula 14 do notebook."""
    return quadro.drop(columns=[ALVO]), quadro[ALVO]


def resumo_do_snapshot(quadro: pd.DataFrame) -> dict[str, Any]:
    """Linhas, colunas e contagem do alvo, para o manifest e para o log do CLI."""
    return {
        "linhas": int(len(quadro)),
        "colunas": int(len(quadro.columns)),
        "classes": {str(k): int(v) for k, v in quadro[ALVO].value_counts().sort_index().items()},
        "numericas": {
            c: [float(quadro[c].min()), float(quadro[c].max())] for c in COLUNAS_NUMERICAS
        },
        "nulos": int(np.asarray(quadro.isnull().sum()).sum()),
    }
