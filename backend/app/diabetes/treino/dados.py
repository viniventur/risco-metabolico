"""O snapshot da vertente diabetes: um `SELECT` congelado em parquet cujo sha256 é o `versao_dados`.

O desenho e o escritor são os de `app.treino.dados`, reaproveitados por import: `escrever_parquet`
fixa todos os parâmetros do writer, o arquivo e o conteúdo têm cada um o seu sha256, e
`versao_dados` são os 12 primeiros caracteres do hash do arquivo. Mudam a tabela, as 22 colunas e
a PASTA: o congelado desta vertente vive em data/processado/diabetes/, porque
`app.treino.dados.gerar_snapshot` apaga todo outro `snapshot-*.parquet` de data/processado/ — numa
pasta só, cada vertente apagaria o congelado da outra.

Recebe a CONEXÃO, nunca uma DSN: quem abre a transação `REPEATABLE READ` é `__main__.py`.
"""

from __future__ import annotations

import json
from pathlib import Path
from typing import TYPE_CHECKING, Any

import numpy as np
import pandas as pd
import pyarrow.parquet as pq

from app.config import RAIZ_REPOSITORIO
from app.diabetes.dominio.features import (
    ALVO,
    COLUNAS_BANCO,
    COLUNAS_COM_ALVO,
    COLUNAS_INTEIRAS,
    COLUNAS_MAP_BANCO,
    COLUNAS_NUMERICAS,
    DTYPES_SNAPSHOT,
)
from app.treino.dados import InfoSnapshot, escrever_parquet, sha256_de

if TYPE_CHECKING:
    import psycopg

TABELA_ORIGEM = "dados.registros_diabetes"
PASTA_PADRAO = RAIZ_REPOSITORIO / "data" / "processado" / "diabetes"
COLUNAS_SQL: list[str] = [COLUNAS_BANCO[c] for c in COLUNAS_COM_ALVO]
# O ORDER BY sobre a chave TOTAL é obrigatório: sem ele o Postgres não promete ordem, e ordem
# diferente é sha256 diferente — versao_dados deixaria de significar "estes dados".
CONSULTA_SNAPSHOT = (
    "SELECT " + ", ".join(COLUNAS_SQL) + f"\n  FROM {TABELA_ORIGEM}\n ORDER BY linha_origem"
)
PREFIXO_SNAPSHOT = "snapshot-"
TEMPORARIO = "_snapshot.tmp.parquet"


def perfil_numerico(quadro: pd.DataFrame) -> dict[str, dict[str, float]]:
    """{coluna: {n, media, desvio, p01, p50, p99}} do IMC e das 6 inteiras."""
    perfil: dict[str, dict[str, float]] = {}
    for col in [*COLUNAS_NUMERICAS, *COLUNAS_INTEIRAS]:
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
    """Executa o SELECT congelado e devolve o DataFrame com nomes e tipos canônicos."""
    with con.cursor() as cur:
        cur.execute(CONSULTA_SNAPSHOT)
        colunas = [d.name for d in cur.description or []]
        linhas = cur.fetchall()
    quadro = pd.DataFrame(linhas, columns=colunas)
    quadro = quadro.rename(columns=COLUNAS_MAP_BANCO)[COLUNAS_COM_ALVO]  # nomes e ordem canônicos
    quadro = quadro.astype(DTYPES_SNAPSHOT)  # tipos fixos, não os do driver
    assert quadro.dtypes.astype(str).to_dict() == DTYPES_SNAPSHOT, "dtype fora do contrato"
    return quadro


def sha256_da_carga_corrente(con: psycopg.Connection[Any]) -> str:
    """O sha256_arquivo da última carga de `dados.registros_diabetes` (operacao.carga_fonte)."""
    with con.cursor() as cur:
        cur.execute(
            "SELECT sha256_arquivo FROM operacao.carga_fonte "
            "WHERE tabela_destino = %s ORDER BY id DESC LIMIT 1",
            (TABELA_ORIGEM,),
        )
        linha = cur.fetchone()
    if linha is None:
        raise RuntimeError("nenhuma carga registrada: rode python -m app.diabetes.dados.seed antes")
    return str(linha[0]).strip()


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


def gerar_snapshot(con: psycopg.Connection[Any], pasta: Path = PASTA_PADRAO) -> InfoSnapshot:
    """Congela a tabela da vertente em parquet; devolve versão, caminho e os hashes.

    O nome `snapshot-<versao_dados>.parquet` só existe depois do arquivo (o hash é dele): grava-se
    um temporário, calcula-se o sha256 e renomeia-se. Outro `snapshot-*.parquet` DESTA pasta, com
    hash diferente, é apagado — a pasta nunca tem dois candidatos.
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
            f"snapshot não encontrado: {caminho.name} (rode python -m app.diabetes.treino snapshot)"
        )
    if sha256_esperado is not None:
        real = sha256_de(caminho)
        if real != sha256_esperado:
            raise RuntimeError(
                f"sha256 do snapshot {caminho.name} não bate com o manifest: "
                f"esperado {sha256_esperado[:12]}…, real {real[:12]}…"
            )
    quadro = pq.read_table(caminho).to_pandas()
    return quadro[COLUNAS_COM_ALVO].astype(DTYPES_SNAPSHOT)


def separar_alvo(quadro: pd.DataFrame) -> tuple[pd.DataFrame, pd.Series]:
    """`X` com as 21 variáveis e `y` com o alvo, como no notebook de estudo."""
    return quadro.drop(columns=[ALVO]), quadro[ALVO]


def resumo_do_snapshot(quadro: pd.DataFrame) -> dict[str, Any]:
    """Linhas, colunas, contagem do alvo e a faixa do IMC, para o manifest e o log do CLI."""
    return {
        "linhas": int(len(quadro)),
        "colunas": int(len(quadro.columns)),
        "alvo": {str(k): int(v) for k, v in quadro[ALVO].value_counts().sort_index().items()},
        "numericas": {
            c: [float(quadro[c].min()), float(quadro[c].max())] for c in COLUNAS_NUMERICAS
        },
        "nulos": int(np.asarray(quadro.isnull().sum()).sum()),
    }
