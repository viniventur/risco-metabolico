"""CLI de treino da vertente diabetes: `python -m app.diabetes.treino snapshot [opções]`.

A gramática fechada da vertente de obesidade (`python -m app.treino`): nenhum caminho obrigatório,
todo default relativo à raiz do repositório, resolvido em código. Hoje, um subcomando:

- `snapshot`: congela `dados.registros_diabetes` em data/processado/diabetes/, numa transação
  REPEATABLE READ, e registra o congelado no manifest da vertente
  (artifacts/diabetes/manifest.json) — o `versao_dados` que o treino vai citar.

O manifest da vertente é outro arquivo, e não uma chave no da obesidade: as duas vertentes são
versionadas, publicadas e verificadas cada uma por si.
"""

from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path
from typing import Any

from app.config import CONFIG, RAIZ_REPOSITORIO
from app.diabetes.dados.seed import CSV_PADRAO, FONTE_REF
from app.diabetes.treino import dados

ARTEFATOS = RAIZ_REPOSITORIO / "artifacts" / "diabetes"
MANIFESTO_PADRAO = ARTEFATOS / "manifest.json"
NOME_PROJETO = "risco-metabolico"
VERTENTE = "diabetes"


def _relativo(caminho: Path) -> str:
    """Caminho relativo à raiz do repositório; fora dela (pastas temporárias de teste), absoluto."""
    caminho = caminho.resolve()
    try:
        return caminho.relative_to(RAIZ_REPOSITORIO).as_posix()
    except ValueError:
        return caminho.as_posix()


def manifest_vazio() -> dict[str, Any]:
    """O esqueleto do manifest da vertente: todo campo medido fica `null` até o CLI preenchê-lo."""
    return {
        "nome": NOME_PROJETO,
        "vertente": VERTENTE,
        "versao": None,
        "dataset": {
            "tabela_origem": dados.TABELA_ORIGEM,
            "insumo_de_semeadura": _relativo(CSV_PADRAO),
            "proveniencia": FONTE_REF,
            "snapshot": None,
            "versao_dados": None,
            "sha256_snapshot": None,
            "sha256_conteudo": None,
            "sha256_carga": None,
            "pyarrow": None,
            "linhas": None,
            "colunas": None,
        },
        "notebook_origem": "study/02_triagem_de_diabetes.ipynb",
    }


def ler_manifest(caminho: Path) -> dict[str, Any]:
    """O manifest existente, ou o esqueleto vazio na primeira execução."""
    if caminho.exists():
        return dict(json.loads(caminho.read_text(encoding="utf-8")))
    return manifest_vazio()


def escrever_manifest(caminho: Path, manifest: dict[str, Any]) -> None:
    """Grava o manifest em UTF-8, indentado, sem NaN."""
    caminho.parent.mkdir(parents=True, exist_ok=True)
    caminho.write_text(
        json.dumps(manifest, ensure_ascii=False, indent=2, allow_nan=False) + "\n",
        encoding="utf-8",
        newline="\n",
    )


def _abrir_transacao_congelada(dsn: str) -> Any:
    """A transação do congelamento: REPEATABLE READ e as mesmas configurações de sessão."""
    import psycopg

    con = psycopg.connect(dsn)
    con.isolation_level = psycopg.IsolationLevel.REPEATABLE_READ
    con.execute("SET SESSION timezone = 'UTC'")
    con.execute("SET SESSION extra_float_digits = 3")
    con.execute("SET SESSION max_parallel_workers_per_gather = 0")
    return con


def registrar_snapshot_no_manifest(manifesto: Path, info: dados.InfoSnapshot) -> dict[str, Any]:
    """Escreve o bloco `dataset` do manifest a partir do snapshot recém-congelado."""
    import pyarrow

    manifest = ler_manifest(manifesto)
    manifest["dataset"].update(
        {
            "snapshot": _relativo(info.caminho),
            "versao_dados": info.versao_dados,
            "sha256_snapshot": info.sha256_arquivo,
            "sha256_conteudo": info.sha256_conteudo,
            "sha256_carga": info.sha256_carga,
            "pyarrow": pyarrow.__version__,
            "linhas": info.linhas,
            "colunas": info.colunas,
        }
    )
    escrever_manifest(manifesto, manifest)
    return manifest


def cmd_snapshot(args: argparse.Namespace) -> int:
    """Congela a tabela da vertente e registra o snapshot no manifest."""
    con = _abrir_transacao_congelada(args.banco_url or CONFIG.banco_url)
    try:
        info = dados.gerar_snapshot(con, args.processado)
        con.commit()
    finally:
        con.close()
    registrar_snapshot_no_manifest(args.manifesto, info)
    print(
        f"snapshot: {_relativo(info.caminho)} ({info.linhas} x {info.colunas}) "
        f"versao_dados={info.versao_dados}"
    )
    return 0


def construir_parser() -> argparse.ArgumentParser:
    """A gramática do CLI."""
    parser = argparse.ArgumentParser(
        prog="python -m app.diabetes.treino",
        description=__doc__,
        formatter_class=argparse.RawDescriptionHelpFormatter,
    )
    sub = parser.add_subparsers(dest="comando", required=True)
    sp = sub.add_parser("snapshot", help="congela dados.registros_diabetes e anota o manifest")
    sp.add_argument("--manifesto", type=Path, default=MANIFESTO_PADRAO)
    sp.add_argument("--banco-url", default=None, help="DSN; padrão BANCO_URL (CONFIG.banco_url)")
    sp.add_argument("--processado", type=Path, default=dados.PASTA_PADRAO)
    sp.set_defaults(fn=cmd_snapshot)
    return parser


def main(argv: list[str] | None = None) -> int:
    """Ponto de entrada."""
    args = construir_parser().parse_args(argv)
    return int(args.fn(args))


if __name__ == "__main__":
    sys.exit(main())
