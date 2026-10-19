"""Garante o artefato de modelo — e, com `--snapshot-destino`, o snapshot de treino — conferindo
o sha256 do manifest (ADR 0004).

Só biblioteca padrão: roda dentro da imagem `python:3.12-slim`, sem PowerShell e sem `uv`.
Para cada arquivo: (1) se `<destino>/<arquivo>` já existe e o sha256 bate, não baixa nada;
(2) senão, baixa o asset do release do repositório GitHub e confere o sha256 antes de mover para o
lugar. Hash divergente é erro, nunca aviso. O release é o `release` do manifest (o da vertente
diabetes diz `diabetes-v<versao>`); sem o campo, `v<versao>` — o da vertente de obesidade.

O snapshot (`dataset.snapshot` e `dataset.sha256_snapshot` do manifest) só entra com
`--snapshot-destino`: a imagem publicada precisa dele para derivar `base_painel.parquet` sem banco
(`python -m app.treino.painel`), porque o provedor constrói a imagem a partir do git, onde
`data/processado/` não existe.

Uso: python scripts/baixar_modelo.py --manifesto artifacts/manifest.json --destino models
     [--snapshot-destino data/processado] [--repo dono/repositorio] [--url https://...]
     python scripts/baixar_modelo.py --manifesto artifacts/diabetes/manifest.json --destino models
"""

from __future__ import annotations

import argparse
import hashlib
import json
import os
import sys
import tempfile
import urllib.request
from pathlib import Path

REPO_PADRAO = os.environ.get("REPO_GITHUB", "viniventur/risco-metabolico")


def sha256_de(caminho: Path) -> str:
    """sha256 em hexadecimal, em blocos (o arquivo pode ter alguns MB)."""
    h = hashlib.sha256()
    with open(caminho, "rb") as f:
        for bloco in iter(lambda: f.read(1 << 20), b""):
            h.update(bloco)
    return h.hexdigest()


def garantir(arquivo: str, esperado: str, url: str, destino: Path) -> int:
    """Deixa `destino/arquivo` no lugar com o sha256 conferido; 0 em sucesso, 1 em divergência."""
    destino.mkdir(parents=True, exist_ok=True)
    alvo = destino / arquivo
    if alvo.exists():
        real = sha256_de(alvo)
        if real == esperado:
            print(f"OK: {arquivo} já presente em {destino}/ com sha256 conferido ({real[:12]}…)")
            return 0
        print(f"aviso: {arquivo} presente mas com sha256 {real[:12]}… ≠ manifest {esperado[:12]}…; baixando")

    print(f"baixando {url}")
    with tempfile.NamedTemporaryFile(delete=False, dir=destino, suffix=".parte") as tmp:
        temporario = Path(tmp.name)
    try:
        with urllib.request.urlopen(url, timeout=120) as resposta, open(temporario, "wb") as saida:  # noqa: S310
            for bloco in iter(lambda: resposta.read(1 << 20), b""):
                saida.write(bloco)
        real = sha256_de(temporario)
        if real != esperado:
            print(f"FALHA: sha256 do download {real[:12]}… ≠ manifest {esperado[:12]}…")
            return 1
        temporario.replace(alvo)
    except Exception as erro:  # noqa: BLE001
        print(f"FALHA ao baixar {arquivo}: {type(erro).__name__}: {erro}")
        return 1
    finally:
        if temporario.exists():
            temporario.unlink()
    print(f"OK: {arquivo} baixado e conferido ({real[:12]}…)")
    return 0


def main(argv: list[str] | None = None) -> int:
    """Devolve 0 com os artefatos no lugar e conferidos; 1 em qualquer divergência."""
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--manifesto", type=Path, default=Path("artifacts/manifest.json"))
    parser.add_argument("--destino", type=Path, default=Path("models"))
    parser.add_argument(
        "--snapshot-destino",
        type=Path,
        default=None,
        help="também garante o snapshot congelado (dataset.snapshot do manifest) nesta pasta",
    )
    parser.add_argument("--repo", default=REPO_PADRAO, help="dono/repositorio no GitHub")
    parser.add_argument("--url", default=None, help="URL completa do asset do MODELO (sobrepõe --repo)")
    args = parser.parse_args(argv)

    manifest = json.loads(args.manifesto.read_text(encoding="utf-8"))
    arquivo, esperado, versao = manifest.get("arquivo"), manifest.get("sha256"), manifest.get("versao")
    if not arquivo or not esperado or not versao:
        print("FALHA: manifest sem arquivo/sha256/versao — o modelo ainda não foi treinado")
        return 1
    tag = manifest.get("release") or f"v{versao}"
    base = f"https://github.com/{args.repo}/releases/download/{tag}"
    codigo = garantir(arquivo, esperado, args.url or f"{base}/{arquivo}", args.destino)
    if codigo != 0 or args.snapshot_destino is None:
        return codigo

    dataset = manifest.get("dataset") or {}
    caminho, sha_snapshot = dataset.get("snapshot"), dataset.get("sha256_snapshot")
    if not caminho or not sha_snapshot:
        print("FALHA: manifest sem dataset.snapshot/sha256_snapshot — rode `congelar` e `treinar`")
        return 1
    nome = Path(caminho).name
    return garantir(nome, sha_snapshot, f"{base}/{nome}", args.snapshot_destino)


if __name__ == "__main__":
    sys.exit(main())
