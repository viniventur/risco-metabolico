"""Garante o artefato de modelo em `--destino`, conferindo o sha256 do manifest (ADR 0004).

Só biblioteca padrão: roda dentro da imagem `python:3.12-slim`, sem PowerShell e sem `uv`.
Ordem: (1) se `<destino>/<arquivo>` já existe e o sha256 bate, não baixa nada; (2) senão, baixa
o asset do release `v<versao>` do repositório GitHub e confere o sha256 antes de mover para o
lugar. Hash divergente é erro, nunca aviso.

Uso: python scripts/baixar_modelo.py --manifesto artifacts/manifest.json --destino models
     [--repo dono/repositorio] [--url https://...]
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


def main(argv: list[str] | None = None) -> int:
    """Devolve 0 com o artefato no lugar e conferido; 1 em qualquer divergência."""
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--manifesto", type=Path, default=Path("artifacts/manifest.json"))
    parser.add_argument("--destino", type=Path, default=Path("models"))
    parser.add_argument("--repo", default=REPO_PADRAO, help="dono/repositorio no GitHub")
    parser.add_argument("--url", default=None, help="URL completa do asset (sobrepõe --repo)")
    args = parser.parse_args(argv)

    manifest = json.loads(args.manifesto.read_text(encoding="utf-8"))
    arquivo, esperado, versao = manifest.get("arquivo"), manifest.get("sha256"), manifest.get("versao")
    if not arquivo or not esperado or not versao:
        print("FALHA: manifest sem arquivo/sha256/versao — o modelo ainda não foi treinado")
        return 1
    args.destino.mkdir(parents=True, exist_ok=True)
    alvo = args.destino / arquivo
    if alvo.exists():
        real = sha256_de(alvo)
        if real == esperado:
            print(f"OK: {arquivo} já presente em {args.destino}/ com sha256 conferido ({real[:12]}…)")
            return 0
        print(f"aviso: {arquivo} presente mas com sha256 {real[:12]}… ≠ manifest {esperado[:12]}…; baixando")

    url = args.url or f"https://github.com/{args.repo}/releases/download/v{versao}/{arquivo}"
    print(f"baixando {url}")
    with tempfile.NamedTemporaryFile(delete=False, dir=args.destino, suffix=".parte") as tmp:
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
        print(f"FALHA ao baixar o artefato: {type(erro).__name__}: {erro}")
        return 1
    finally:
        if temporario.exists():
            temporario.unlink()
    print(f"OK: {arquivo} baixado e conferido ({real[:12]}…)")
    return 0


if __name__ == "__main__":
    sys.exit(main())
