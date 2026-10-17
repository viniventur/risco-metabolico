"""Gera e confere o bloco de colunas de `sql/schema.sql` a partir de `dominio/features.py`.

Duas cópias da lista de 17 colunas divergem em uma semana — e essa é exatamente a classe de
divergência que este projeto existe para não repetir. Por isso o corpo de
`dados.registros_triagem` é GERADO (`--gerar`) e o banco é CONFERIDO (`--conferir`) contra a
mesma lista: nomes, ordem, tipos, o dicionário de dados e o hash de `FONTE.md` registrado na
semeadura (§3.2, §4.3.3).

Uso:
    python -m app.dados.schema --gerar
    python -m app.dados.schema --conferir [--banco-url <dsn>]
"""

from __future__ import annotations

import argparse
import hashlib
import re
import sys
from pathlib import Path

from app.config import CONFIG, RAIZ_REPOSITORIO
from app.dominio.features import COLUNAS_BANCO, COLUNAS_COM_ALVO, TIPOS_SQL

SCHEMA_SQL = RAIZ_REPOSITORIO / "sql" / "schema.sql"
DICIONARIO_MD = RAIZ_REPOSITORIO / "docs" / "dicionario-de-dados.md"
FONTE_MD = RAIZ_REPOSITORIO / "data" / "bruto" / "FONTE.md"
TABELA = "dados.registros_triagem"
MARCA_INICIO = "-- INICIO-GERADO"
MARCA_FIM = "-- FIM-GERADO"

# Colunas de infraestrutura que cercam o bloco gerado, com os tipos que o
# information_schema devolve.
PREFIXO_FIXO = [("linha_origem", "integer")]
SUFIXO_FIXO = [("carga_id", "bigint")]


def colunas_esperadas() -> list[tuple[str, str]]:
    """As 17 colunas do banco (nome, tipo SQL), na ordem canônica de `colunas_map`."""
    return [(COLUNAS_BANCO[c], TIPOS_SQL[c][0]) for c in COLUNAS_COM_ALVO]


def linhas_geradas() -> list[str]:
    """Corpo do bloco gerado: uma linha por coluna, todas NOT NULL (o CSV não tem nulos)."""
    return [f"    {nome:<34} {tipo:<16} NOT NULL," for nome, tipo in colunas_esperadas()]


def gerar(texto: str) -> str:
    """Substitui o conteúdo entre as marcas, preservando os comentários de cabeçalho do bloco."""
    linhas = texto.splitlines()
    try:
        i_ini = next(i for i, ln in enumerate(linhas) if ln.strip().startswith(MARCA_INICIO))
        i_fim = next(i for i, ln in enumerate(linhas) if ln.strip().startswith(MARCA_FIM))
    except StopIteration as erro:
        raise SystemExit(
            f"marcas {MARCA_INICIO}/{MARCA_FIM} não encontradas em {SCHEMA_SQL.name}"
        ) from erro
    # Os comentários logo abaixo de INICIO-GERADO (linhas que começam com '--') ficam.
    i_corpo = i_ini + 1
    while i_corpo < i_fim and linhas[i_corpo].strip().startswith("--"):
        i_corpo += 1
    novas = linhas[:i_corpo] + linhas_geradas() + linhas[i_fim:]
    return "\n".join(novas) + "\n"


def sha256_de(caminho: Path) -> str:
    """sha256 do arquivo, em hexadecimal."""
    return hashlib.sha256(caminho.read_bytes()).hexdigest()


def colunas_do_dicionario() -> list[tuple[str, str]]:
    """Lê (coluna no banco, tipo SQL) da tabela de 17 colunas de docs/dicionario-de-dados.md."""
    padrao = re.compile(
        r"^\|\s*\d+\s*\|\s*`[^`]+`\s*\|\s*`[^`]+`\s*\|\s*`([^`]+)`\s*\|\s*`([^`]+)`"
    )
    achados: list[tuple[str, str]] = []
    for linha in DICIONARIO_MD.read_text(encoding="utf-8").splitlines():
        m = padrao.match(linha)
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
    """Compara banco, lista canônica e dicionário, e o sha256 de FONTE.md com o da carga."""
    import psycopg  # extra `treino`: importado aqui para `--gerar` não exigir o driver

    esperado = PREFIXO_FIXO + colunas_esperadas() + SUFIXO_FIXO
    problemas: list[str] = []

    dicionario = colunas_do_dicionario()
    problemas += _diff("dicionário", dicionario, "colunas_map", colunas_esperadas())

    with psycopg.connect(banco_url) as con:
        linhas = con.execute(
            "SELECT column_name, data_type FROM information_schema.columns "
            "WHERE table_schema = 'dados' AND table_name = 'registros_triagem' "
            "ORDER BY ordinal_position"
        ).fetchall()
        no_banco = [(str(nome), str(tipo)) for nome, tipo in linhas]
        if not no_banco:
            problemas.append(
                f"  tabela {TABELA} não existe no banco (schema.sql não foi aplicado?)"
            )
        else:
            problemas += _diff("banco", no_banco, "esperado", esperado)

        carga = con.execute(
            "SELECT sha256_fonte_md, arquivo_origem FROM operacao.carga_fonte "
            "WHERE tabela_destino = %s ORDER BY id DESC LIMIT 1",
            (TABELA,),
        ).fetchone()
    if carga is None:
        problemas.append(f"  nenhuma carga registrada para {TABELA}: rode python -m app.dados.seed")
    else:
        sha_banco, arquivo_origem = carga
        if sha_banco.strip() != sha256_de(FONTE_MD):
            problemas.append("  FONTE.md mudou desde a semeadura — rode o seed de novo")
        if "/" in arquivo_origem or "\\" in arquivo_origem:
            problemas.append(f"  arquivo_origem carrega caminho: {arquivo_origem!r}")

    if problemas:
        print("FALHA na conferência do schema:")
        print("\n".join(problemas))
        return 1
    print(
        f"OK: {TABELA} com {len(esperado)} colunas (nomes e tipos) iguais a colunas_map "
        "e ao dicionário; "
        "sha256 de FONTE.md igual ao registrado na carga."
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
            print(f"{SCHEMA_SQL.relative_to(RAIZ_REPOSITORIO)}: bloco gerado atualizado.")
        else:
            print(f"{SCHEMA_SQL.relative_to(RAIZ_REPOSITORIO)}: bloco gerado já estava em dia.")
        return 0
    return conferir(args.banco_url or CONFIG.banco_url)


if __name__ == "__main__":
    sys.exit(main())
