"""Gera e confere o bloco de colunas de `dados.registros_diabetes` em `sql/schema.sql`.

O mesmo desenho de `app.dados.schema`: o corpo da tabela é GERADO de `dominio/features.py`
(`--gerar`) e o banco é CONFERIDO (`--conferir`) contra a mesma lista — nomes, ordem, tipos, o
dicionário de dados da vertente e o hash do FONTE.md registrado na semeadura. As marcas são
próprias (`-- DIABETES-INICIO-GERADO` / `-- DIABETES-FIM-GERADO`) e não começam como as da
vertente de obesidade: nenhum dos dois geradores acha o bloco do outro.

Uso:
    python -m app.diabetes.dados.schema --gerar
    python -m app.diabetes.dados.schema --conferir [--banco-url <dsn>]
"""

from __future__ import annotations

import argparse
import re
import sys

from app.config import CONFIG, RAIZ_REPOSITORIO
from app.dados.seed import sha256_arquivo
from app.diabetes.dados.seed import FONTE_MD, FONTE_REF, TABELA_PADRAO
from app.diabetes.dominio.features import COLUNAS_BANCO, COLUNAS_COM_ALVO, TIPOS_SQL

SCHEMA_SQL = RAIZ_REPOSITORIO / "sql" / "schema.sql"
DICIONARIO_MD = RAIZ_REPOSITORIO / "docs" / "dicionario-de-dados-diabetes.md"
MARCA_INICIO = "-- DIABETES-INICIO-GERADO"
MARCA_FIM = "-- DIABETES-FIM-GERADO"

# Colunas de infraestrutura que cercam o bloco gerado, com os tipos do information_schema.
PREFIXO_FIXO = [("linha_origem", "integer")]
SUFIXO_FIXO = [("carga_id", "bigint")]

# Linha da tabela de 22 colunas do dicionário: | n | `CSV` | `BRFSS` | `Modelo` | `banco` | `tipo` |
_LINHA_DICIONARIO = re.compile(
    r"^\|\s*\d+\s*\|\s*`[^`]+`\s*\|\s*`[^`]+`\s*\|\s*`[^`]+`\s*\|\s*`([^`]+)`\s*\|\s*`([^`]+)`"
)


def colunas_esperadas() -> list[tuple[str, str]]:
    """As 22 colunas do banco (nome, tipo SQL), na ordem canônica de `COLUNAS_MAP`."""
    return [(COLUNAS_BANCO[c], TIPOS_SQL[c][0]) for c in COLUNAS_COM_ALVO]


def linhas_geradas() -> list[str]:
    """Corpo do bloco gerado: uma linha por coluna, todas NOT NULL (o CSV não tem nulos)."""
    return [f"    {nome:<34} {tipo:<16} NOT NULL," for nome, tipo in colunas_esperadas()]


def gerar(texto: str) -> str:
    """Substitui o conteúdo entre as marcas, preservando os comentários logo abaixo da de início."""
    linhas = texto.splitlines()
    try:
        i_ini = next(i for i, ln in enumerate(linhas) if ln.strip().startswith(MARCA_INICIO))
        i_fim = next(i for i, ln in enumerate(linhas) if ln.strip().startswith(MARCA_FIM))
    except StopIteration as erro:
        raise SystemExit(
            f"marcas {MARCA_INICIO}/{MARCA_FIM} não encontradas em {SCHEMA_SQL.name}"
        ) from erro
    i_corpo = i_ini + 1
    while i_corpo < i_fim and linhas[i_corpo].strip().startswith("--"):
        i_corpo += 1
    novas = linhas[:i_corpo] + linhas_geradas() + linhas[i_fim:]
    return "\n".join(novas) + "\n"


def colunas_do_dicionario() -> list[tuple[str, str]]:
    """Lê (coluna no banco, tipo SQL) da tabela de 22 colunas do dicionário da vertente."""
    achados: list[tuple[str, str]] = []
    for linha in DICIONARIO_MD.read_text(encoding="utf-8").splitlines():
        m = _LINHA_DICIONARIO.match(linha)
        if m:
            achados.append((m.group(1), m.group(2)))
    return achados


def _diff(
    rotulo_a: str, a: list[tuple[str, str]], rotulo_b: str, b: list[tuple[str, str]]
) -> list[str]:
    """Diff nominal, coluna a coluna — nunca 'número de colunas diferente'."""
    problemas: list[str] = []
    for i in range(max(len(a), len(b))):
        la = a[i] if i < len(a) else None
        lb = b[i] if i < len(b) else None
        if la != lb:
            problemas.append(f"  posição {i}: {rotulo_a}={la} | {rotulo_b}={lb}")
    return problemas


def conferir(banco_url: str) -> int:
    """Compara banco, lista canônica e dicionário; o FONTE.md e o `fonte_ref` com os da carga."""
    import psycopg  # extras `treino` e `operacao`: `--gerar` não exige o driver

    esquema, tabela = TABELA_PADRAO.split(".")
    esperado = PREFIXO_FIXO + colunas_esperadas() + SUFIXO_FIXO
    problemas = _diff("dicionário", colunas_do_dicionario(), "colunas_map", colunas_esperadas())

    with psycopg.connect(banco_url) as con:
        linhas = con.execute(
            "SELECT column_name, data_type FROM information_schema.columns "
            "WHERE table_schema = %s AND table_name = %s ORDER BY ordinal_position",
            (esquema, tabela),
        ).fetchall()
        no_banco = [(str(nome), str(tipo)) for nome, tipo in linhas]
        if not no_banco:
            problemas.append(
                f"  tabela {TABELA_PADRAO} não existe no banco (schema.sql não foi aplicado?)"
            )
        else:
            problemas += _diff("banco", no_banco, "esperado", esperado)
        carga = con.execute(
            "SELECT sha256_fonte_md, arquivo_origem, fonte_ref FROM operacao.carga_fonte "
            "WHERE tabela_destino = %s ORDER BY id DESC LIMIT 1",
            (TABELA_PADRAO,),
        ).fetchone()
    if carga is None:
        problemas.append(
            f"  nenhuma carga registrada para {TABELA_PADRAO}: "
            "rode python -m app.diabetes.dados.seed"
        )
    else:
        sha_banco, arquivo_origem, fonte_ref = carga
        if sha_banco.strip() != sha256_arquivo(FONTE_MD):
            problemas.append("  FONTE.md da vertente mudou desde a semeadura — rode o seed de novo")
        if fonte_ref != FONTE_REF:
            problemas.append(f"  a carga aponta outra citação: fonte_ref={fonte_ref!r}")
        if "/" in arquivo_origem or "\\" in arquivo_origem:
            problemas.append(f"  arquivo_origem carrega caminho: {arquivo_origem!r}")

    if problemas:
        print("FALHA na conferência do schema da vertente diabetes:")
        print("\n".join(problemas))
        return 1
    print(
        f"OK: {TABELA_PADRAO} com {len(esperado)} colunas (nomes e tipos) iguais a colunas_map "
        "e ao dicionário; sha256 de FONTE.md e fonte_ref iguais aos registrados na carga."
    )
    return 0


def main(argv: list[str] | None = None) -> int:
    """Ponto de entrada do CLI."""
    parser = argparse.ArgumentParser(
        description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter
    )
    grupo = parser.add_mutually_exclusive_group(required=True)
    grupo.add_argument(
        "--gerar", action="store_true", help="reescreve o bloco gerado de sql/schema.sql"
    )
    grupo.add_argument(
        "--conferir", action="store_true", help="compara o banco com a lista canônica"
    )
    parser.add_argument(
        "--banco-url", default=None, help="DSN; padrão: BANCO_URL (CONFIG.banco_url)"
    )
    args = parser.parse_args(argv)

    if args.gerar:
        antes = SCHEMA_SQL.read_text(encoding="utf-8")
        depois = gerar(antes)
        if depois != antes:
            SCHEMA_SQL.write_text(depois, encoding="utf-8", newline="\n")
            print(f"{SCHEMA_SQL.relative_to(RAIZ_REPOSITORIO)}: bloco da vertente atualizado.")
        else:
            print(f"{SCHEMA_SQL.relative_to(RAIZ_REPOSITORIO)}: bloco já estava em dia.")
        return 0
    return conferir(args.banco_url or CONFIG.banco_url)


if __name__ == "__main__":
    sys.exit(main())
