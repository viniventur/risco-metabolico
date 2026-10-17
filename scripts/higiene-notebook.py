"""Higiene do notebook de estudo (plano, §5.5): mantém as figuras, remove o lixo.

Mantém `application/vnd.plotly.v1+json`, `image/png` e `text/html` (são o produto do módulo
Estudos). Remove os mimes do editor (data wrangler, widgets), as saídas de erro, as saídas de
texto com caminho absoluto (lista negra, §3.3) e normaliza `execution_count` para 1..N.
Falha se o arquivo passar de 1,5 MB.

Uso: python scripts/higiene-notebook.py study/01_comparacao_de_modelos.ipynb
"""

from __future__ import annotations

import argparse
import json
import re
import sys
from pathlib import Path

import nbformat

MIMES_LIXO = {
    "application/vnd.microsoft.datawrangler.viewer.v0+json",
    "application/vnd.jupyter.widget-view+json",
    "application/vnd.jupyter.widget-state+json",
}
CAMINHO_ABSOLUTO = re.compile(r"[A-Za-z]:\\|[A-Za-z]:/|/home/[A-Za-z]|/Users/[A-Za-z]")
TETO_BYTES = 1_572_864  # 1,5 MB


def limpar(caminho: Path) -> tuple[int, int, int]:
    """Aplica a higiene no lugar. Devolve (saídas removidas, mimes removidos, células numeradas)."""
    with open(caminho, encoding="utf-8") as f:
        nb = nbformat.read(f, as_version=4)
    removidas = mimes = n = 0
    for cell in nb.cells:
        if cell.cell_type != "code":
            continue
        novas = []
        for saida in cell.get("outputs", []):
            if saida.output_type == "error":
                removidas += 1
                continue
            if saida.output_type in ("display_data", "execute_result"):
                for mime in list(saida.data.keys()):
                    if mime in MIMES_LIXO:
                        del saida.data[mime]
                        mimes += 1
                if not saida.data:
                    removidas += 1
                    continue
            if saida.output_type == "stream" and CAMINHO_ABSOLUTO.search("".join(saida.text)):
                removidas += 1  # caminho absoluto em saída de célula cai na lista negra
                continue
            if saida.output_type != "stream" and CAMINHO_ABSOLUTO.search(json.dumps(saida.get("data", {}))):
                raise SystemExit(f"caminho absoluto numa saída rica da célula: {cell.source[:60]!r}")
            novas.append(saida)
        cell.outputs = novas
        n += 1
        cell.execution_count = n
        for saida in cell.outputs:
            if "execution_count" in saida:
                saida.execution_count = n
    with open(caminho, "w", encoding="utf-8", newline="\n") as f:  # utf-8 explícito: sem mojibake
        nbformat.write(nb, f)
    return removidas, mimes, n


def main(argv: list[str] | None = None) -> int:
    """Ponto de entrada."""
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("notebook", type=Path)
    args = parser.parse_args(argv)
    removidas, mimes, n = limpar(args.notebook)
    tamanho = args.notebook.stat().st_size
    print(f"{args.notebook.name}: {removidas} saída(s) removida(s), {mimes} mime(s) de lixo removido(s), "
          f"{n} célula(s) de código numerada(s), {tamanho / 1024:.0f} KB")
    if tamanho > TETO_BYTES:
        print(f"FALHA: acima do teto de {TETO_BYTES / 1024:.0f} KB — figura com template embutido ou DataFrame gigante?")
        return 1
    return 0


if __name__ == "__main__":
    sys.exit(main())
