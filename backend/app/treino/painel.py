"""Deriva `data/processado/base_painel.parquet` do snapshot congelado — sem banco (§11.2).

Existe para a imagem publicada: o provedor constrói a imagem a partir do git, onde não há
`data/processado/` nem volume para montar. `base_painel.parquet` é derivação determinística do
snapshot (`treino/agregar.py::derivar_base_painel`), e o snapshot é asset do release `v<versao>`,
baixado por `scripts/baixar_modelo.py` com o sha256 conferido pelo manifest. Os rótulos vêm de
`ROTULOS_ESCALA`, a MESMA fonte que semeia `dados.rotulos_escala`; por isso o resultado é o que
`python -m app.treino congelar` escreve (tests/test_painel_sem_banco.py prova a igualdade).

Uso: python -m app.treino.painel [--manifesto artifacts/manifest.json]
                                 [--parquet data/processado/base_painel.parquet]
"""

from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

from app.config import RAIZ_REPOSITORIO
from app.dominio.regras import ROTULOS_ESCALA
from app.treino import agregar, dados

MANIFESTO_PADRAO = RAIZ_REPOSITORIO / "artifacts" / "manifest.json"
PARQUET_PADRAO = RAIZ_REPOSITORIO / "data" / "processado" / "base_painel.parquet"


def derivar(manifesto: Path = MANIFESTO_PADRAO, parquet: Path = PARQUET_PADRAO) -> Path:
    """Lê o snapshot apontado pelo manifest (sha256 conferido) e grava o parquet do painel."""
    manifest = json.loads(manifesto.read_text(encoding="utf-8"))
    dataset = manifest.get("dataset") or {}
    relativo, esperado = dataset.get("snapshot"), dataset.get("sha256_snapshot")
    if not relativo or not esperado:
        raise FileNotFoundError(
            "manifest sem dataset.snapshot/sha256_snapshot: rode `congelar` e `treinar` antes"
        )
    caminho = Path(relativo)
    if not caminho.is_absolute():  # pastas temporárias de teste gravam caminho absoluto
        caminho = RAIZ_REPOSITORIO / relativo
    quadro = dados.carregar_snapshot(caminho, sha256_esperado=esperado)
    base = agregar.derivar_base_painel(quadro, ROTULOS_ESCALA)
    parquet.parent.mkdir(parents=True, exist_ok=True)
    base.to_parquet(parquet, index=False)
    return parquet


def main(argv: list[str] | None = None) -> int:
    """Ponto de entrada: `python -m app.treino.painel`; 1 em qualquer falha, com a causa."""
    parser = argparse.ArgumentParser(
        description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter
    )
    parser.add_argument("--manifesto", type=Path, default=MANIFESTO_PADRAO)
    parser.add_argument("--parquet", type=Path, default=PARQUET_PADRAO)
    args = parser.parse_args(argv)
    try:
        escrito = derivar(args.manifesto, args.parquet)
    except (FileNotFoundError, RuntimeError) as erro:
        print(f"FALHA: {erro}")
        return 1
    print(f"escrito: {escrito}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
