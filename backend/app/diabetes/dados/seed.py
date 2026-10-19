"""Semeadura da vertente diabetes: o CSV do repositório público -> dados.registros_diabetes.

As cinco verificações da vertente de obesidade (`app.dados.seed`), na mesma ordem e com as mesmas
funções: citação presente em data/bruto/diabetes/FONTE.md, schema nominal (nomes E ordem), carga
já existente por sha256, contagem real na tabela e contagem depois da carga. Três diferenças:

- a coluna `ID` do arquivo só vira `linha_origem` depois de conferida como a posição da linha;
- todo valor é conferido contra `regras.DOMINIOS` ANTES da transação — um código novo no arquivo
  falha com o nome da coluna, não como um nulo no meio do COPY;
- são 253.680 linhas: o COPY recebe o CSV pronto, em blocos, e não uma linha por chamada.

`dados.rotulos_escala` é da outra vertente e não é tocada: os rótulos daqui vivem em
`regras.ROTULOS_ESCALA`, no código.

Uso:
    python -m app.diabetes.dados.seed [--arquivo ...csv] [--tabela dados.registros_diabetes]
    python -m app.diabetes.dados.seed --conferir      # modo de verificação do CI: nunca escreve
"""

from __future__ import annotations

import argparse
import re
import sys
from pathlib import Path
from typing import TYPE_CHECKING, Any

import numpy as np
import pandas as pd

from app.config import CONFIG, RAIZ_REPOSITORIO
from app.dados.seed import (
    SQL_ATUALIZAR_CARGA,
    SQL_ATUALIZAR_FONTE,
    SQL_CARGA_EXISTENTE,
    CitacaoAusente,
    conferir_citacao,
    conferir_schema,
    nome_de_origem,
    sha256_arquivo,
)
from app.diabetes.dominio.features import (
    COLUNA_ID,
    COLUNAS_BANCO,
    COLUNAS_COM_ALVO,
    COLUNAS_NUMERICAS,
    preparar_base,
)
from app.diabetes.dominio.regras import DOMINIOS

if TYPE_CHECKING:
    import psycopg

PASTA_BRUTO = RAIZ_REPOSITORIO / "data" / "bruto" / "diabetes"
CSV_PADRAO = PASTA_BRUTO / "cdc_diabetes_health_indicators.csv"
FONTE_MD = PASTA_BRUTO / "FONTE.md"
FONTE_REF = "data/bruto/diabetes/FONTE.md"
TABELA_PADRAO = "dados.registros_diabetes"
TAMANHO_BLOCO = 1 << 20  # caracteres de CSV por chamada de `write` no COPY
_TABELA_VALIDA = re.compile(r"^[a-z_][a-z0-9_]*\.[a-z_][a-z0-9_]*$")

# A vertente de obesidade não informa `fonte_ref` (vale o DEFAULT da coluna, que é o FONTE.md
# dela); esta informa o seu, para cada carga de operacao.carga_fonte apontar a própria citação.
SQL_INSERIR_CARGA = (
    "INSERT INTO operacao.carga_fonte "
    "(tabela_destino, arquivo_origem, sha256_arquivo, fonte_ref, sha256_fonte_md, "
    "linhas_arquivo, linhas_inseridas) "
    "VALUES (%s, %s, %s, %s, %s, %s, %s) "
    "ON CONFLICT (tabela_destino, sha256_arquivo) DO UPDATE SET "
    "executado_em = now(), fonte_ref = EXCLUDED.fonte_ref, "
    "sha256_fonte_md = EXCLUDED.sha256_fonte_md, linhas_inseridas = EXCLUDED.linhas_inseridas "
    "RETURNING id"
)


def conferir_dominios(quadro: pd.DataFrame) -> None:
    """Nenhum nulo, nenhum valor fora de `DOMINIOS` e IMC positivo — falha nomeando a coluna."""
    for coluna in COLUNAS_COM_ALVO:
        serie = quadro[coluna]
        if serie.isnull().any():
            raise ValueError(f"{coluna}: {int(serie.isnull().sum())} nulo(s) depois da tradução")
        if coluna in COLUNAS_NUMERICAS:
            if (serie <= 0).any():
                raise ValueError(f"{coluna}: valor não positivo")
            continue
        fora = sorted(set(serie.unique()) - set(DOMINIOS[coluna]), key=str)
        if fora:
            raise ValueError(f"{coluna}: valores fora do domínio {fora[:5]}")


def preparar_quadro(arquivo: Path) -> pd.DataFrame:
    """CSV público -> DataFrame com as colunas do BANCO, na ordem canônica.

    `linha_origem` entra na posição 0 com o valor do `ID` do arquivo, que tem de ser exatamente a
    posição da linha (0, 1, 2, ...): é a chave que torna o SELECT do snapshot determinístico.
    """
    bruto = pd.read_csv(arquivo)
    if COLUNA_ID not in bruto.columns:
        raise ValueError(f"coluna {COLUNA_ID} ausente no CSV")
    if not np.array_equal(bruto[COLUNA_ID].to_numpy(), np.arange(len(bruto))):
        raise ValueError(f"{COLUNA_ID} não é a posição da linha (0..n-1): a ordem do arquivo mudou")
    quadro = preparar_base(bruto)  # renomeia, traduz, fixa os tipos
    faltam = [c for c in COLUNAS_COM_ALVO if c not in quadro.columns]
    if faltam:
        raise ValueError(f"colunas ausentes no CSV após a preparação: {faltam}")
    conferir_dominios(quadro)
    quadro = quadro[COLUNAS_COM_ALVO].rename(columns=COLUNAS_BANCO)
    quadro.insert(0, "linha_origem", bruto[COLUNA_ID].astype("int64"))
    return quadro


def copiar_em_blocos(cur: psycopg.Cursor[Any], tabela: str, quadro: pd.DataFrame) -> None:
    """`COPY ... FROM STDIN (FORMAT csv)` com o CSV gerado pelo pandas, em blocos de texto."""
    colunas = ", ".join(quadro.columns)
    texto = quadro.to_csv(index=False, header=False, lineterminator="\n")
    with cur.copy(f"COPY {tabela} ({colunas}) FROM STDIN (FORMAT csv)") as copia:
        for inicio in range(0, len(texto), TAMANHO_BLOCO):
            copia.write(texto[inicio : inicio + TAMANHO_BLOCO])


def semear(arquivo: Path, tabela: str, dsn: str, *, conferir: bool = False) -> int:
    """Carrega o CSV na tabela da vertente, idempotente por sha256; devolve as linhas inseridas."""
    import psycopg  # extras `treino` e `operacao`

    if not _TABELA_VALIDA.match(tabela):
        raise ValueError(f"nome de tabela inválido: {tabela!r}")
    conferir_citacao(FONTE_MD)  # 0. proveniência
    sha = sha256_arquivo(arquivo)
    sha_fonte = sha256_arquivo(FONTE_MD)
    quadro = preparar_quadro(arquivo)

    with psycopg.connect(dsn) as con:
        conferir_schema(con, quadro, tabela)  # 1. nomes e ordem
        with con.cursor() as cur:
            cur.execute(SQL_CARGA_EXISTENTE, (tabela, sha))
            linha = cur.fetchone()
            if linha is not None:
                carga_id, linhas_registradas, sha_fonte_banco = linha
                cur.execute(f"SELECT count(*) FROM {tabela}")  # 2. contagem real
                contagem = cur.fetchone()[0]  # type: ignore[index]
                if contagem == linhas_registradas == len(quadro):
                    if sha_fonte_banco.strip() != sha_fonte:
                        # A citação mudou, o dado não: atualiza só a amarração.
                        if conferir:
                            print("FONTE.md mudou desde a semeadura — rode o seed de novo")
                            return 1
                        cur.execute(SQL_ATUALIZAR_FONTE, (sha_fonte, carga_id))
                        con.commit()
                        print(f"FONTE.md mudou: hash da citação atualizado na carga {carga_id}")
                        return 0
                    print(f"nada a fazer: {tabela} já carregada de {nome_de_origem(arquivo)}")
                    return 0
                print("ATENÇÃO: carga registrada mas contagem divergente; recarregando")
        if conferir:
            print(f"{tabela} NÃO está carregada de {nome_de_origem(arquivo)} (modo --conferir)")
            return 1
        # 3. Tudo em UMA transação: ou a tabela fica coerente, ou não muda.
        with con.transaction(), con.cursor() as cur:
            cur.execute(f"TRUNCATE {tabela}")
            cur.execute(
                SQL_INSERIR_CARGA,
                (
                    tabela,
                    nome_de_origem(arquivo),
                    sha,
                    FONTE_REF,
                    sha_fonte,
                    len(quadro),
                    len(quadro),
                ),
            )
            carga_id = cur.fetchone()[0]  # type: ignore[index]
            quadro["carga_id"] = carga_id
            copiar_em_blocos(cur, tabela, quadro)
            cur.execute(f"SELECT count(*) FROM {tabela}")
            inseridas = cur.fetchone()[0]  # type: ignore[index]
            if inseridas != len(quadro):  # 4. contagem pós-carga
                raise RuntimeError(f"esperado {len(quadro)}, inserido {inseridas}")
            cur.execute(SQL_ATUALIZAR_CARGA, (inseridas, carga_id))
    print(f"{tabela}: {inseridas} linhas inseridas de {nome_de_origem(arquivo)} (carga {carga_id})")
    return int(inseridas)


def main(argv: list[str] | None = None) -> int:
    """Ponto de entrada do CLI."""
    parser = argparse.ArgumentParser(
        description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter
    )
    parser.add_argument("--arquivo", type=Path, default=CSV_PADRAO)
    parser.add_argument("--tabela", default=TABELA_PADRAO)
    parser.add_argument(
        "--banco-url", default=None, help="DSN; padrão: BANCO_URL (CONFIG.banco_url)"
    )
    parser.add_argument(
        "--conferir", action="store_true", help="só verifica; sai 1 se precisar semear"
    )
    args = parser.parse_args(argv)
    try:
        resultado = semear(
            args.arquivo.resolve(),
            args.tabela,
            args.banco_url or CONFIG.banco_url,
            conferir=args.conferir,
        )
    except (CitacaoAusente, RuntimeError, ValueError) as erro:
        print(f"FALHA: {erro}")
        return 1
    return 1 if args.conferir and resultado == 1 else 0


if __name__ == "__main__":
    sys.exit(main())
