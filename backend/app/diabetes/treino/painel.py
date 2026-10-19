"""Deriva data/processado/diabetes/base_painel.parquet do snapshot congelado — sem banco (§11.2).

O desenho de `app.treino.painel`, para a vertente diabetes. Existe para a imagem publicada: o CI
constrói a imagem a partir do git, onde não há data/processado/ nem volume para montar. A base do
painel é derivação determinística do snapshot (`agregar.derivar_base_painel`), e o snapshot é asset
do release `diabetes-v<versao>`, baixado por scripts/baixar_modelo.py com o sha256 conferido pelo
manifest da vertente. Os rótulos e a faixa de IMC vêm do código, não do banco: o resultado é o que
`python -m app.diabetes.treino.agregar` escreve (tests/diabetes/test_painel_sem_banco_diabetes.py
prova a igualdade).

Uso: python -m app.diabetes.treino.painel [--manifesto artifacts/diabetes/manifest.json]
                                          [--parquet data/processado/diabetes/base_painel.parquet]
"""

from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

from app.config import RAIZ_REPOSITORIO
from app.diabetes.treino import agregar, dados


def derivar(
    manifesto: Path = agregar.MANIFESTO_PADRAO, parquet: Path = agregar.PARQUET_PADRAO
) -> Path:
    """Lê o snapshot apontado pelo manifest da vertente (sha256 conferido) e grava o parquet."""
    manifest = json.loads(manifesto.read_text(encoding="utf-8"))
    dataset = manifest.get("dataset") or {}
    relativo, esperado = dataset.get("snapshot"), dataset.get("sha256_snapshot")
    if not relativo or not esperado:
        raise FileNotFoundError(
            "manifest da vertente sem dataset.snapshot/sha256_snapshot: "
            "rode `python -m app.diabetes.treino snapshot` e `treinar` antes"
        )
    caminho = Path(relativo)
    if not caminho.is_absolute():  # pastas temporárias de teste gravam caminho absoluto
        caminho = RAIZ_REPOSITORIO / relativo
    quadro = dados.carregar_snapshot(caminho, sha256_esperado=esperado)
    base = agregar.derivar_base_painel(quadro)
    parquet.parent.mkdir(parents=True, exist_ok=True)
    base.to_parquet(parquet, index=False)
    return parquet


def main(argv: list[str] | None = None) -> int:
    """Ponto de entrada do CLI; 1 em qualquer falha, com a causa."""
    parser = argparse.ArgumentParser(
        description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter
    )
    parser.add_argument("--manifesto", type=Path, default=agregar.MANIFESTO_PADRAO)
    parser.add_argument("--parquet", type=Path, default=agregar.PARQUET_PADRAO)
    args = parser.parse_args(argv)
    try:
        escrito = derivar(args.manifesto, args.parquet)
    # ValueError: um valor fora do domínio na base do painel (dominio.agregados.tipar).
    except (FileNotFoundError, RuntimeError, ValueError) as erro:
        print(f"FALHA: {erro}")
        return 1
    print(f"escrito: {escrito}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
