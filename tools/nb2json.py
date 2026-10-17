"""Converte os notebooks de `study/` em JSON estruturado para o módulo Estudos (plano, §8.3).

Uso (da pasta `frontend/`): python ../tools/nb2json.py --root .. --out public/study

Para cada `study/*.ipynb` escreve `<out>/<slug>.json` (cells + toc + download), extrai os PNG
para `<out>/assets/<slug>-<n>.png`, copia o `.ipynb` para `<out>/notebooks/<slug>.ipynb`, gera
`<out>/pygments.css` e `<out>/manifest.json`. A saída é DETERMINÍSTICA para o mesmo notebook
(chaves ordenadas, datas tiradas dos metadados de execução), porque o CI roda este script e
falha se `git diff --exit-code frontend/public/study` acusar diferença.

Regras de conteúdo:
- mimes de lixo do editor são descartados;
- `application/vnd.plotly.v1+json` mantém só `data` e `layout` (sem `template`), descarta o
  `config` inteiro (carrega um `plotlyServerURL`) e reescreve `scattergl` como `scatter`;
- `image/png` sai do JSON e vira arquivo cacheável;
- o código é realçado com Pygments em tempo de build (0 KB de JavaScript no navegador).
"""

from __future__ import annotations

import argparse
import base64
import json
import re
import shutil
import sys
import unicodedata
from pathlib import Path
from typing import Any

import nbformat
from pygments import highlight
from pygments.formatters import HtmlFormatter
from pygments.lexers import PythonLexer

MIMES_LIXO = {
    "application/vnd.microsoft.datawrangler.viewer.v0+json",
    "application/vnd.jupyter.widget-view+json",
    "application/vnd.jupyter.widget-state+json",
}
MIME_PLOTLY = "application/vnd.plotly.v1+json"
DATA_ZERO = "1970-01-01T00:00:00Z"


def texto(valor: Any) -> str:
    """`source`/`text` podem ser `str` OU `list[str]` — implementação ingênua quebra aqui."""
    if valor is None:
        return ""
    if isinstance(valor, list):
        return "".join(str(v) for v in valor)
    return str(valor)


def sem_acentos(s: str) -> str:
    return unicodedata.normalize("NFKD", s).encode("ascii", "ignore").decode("ascii")


def slug_do_arquivo(stem: str) -> str:
    """`01_comparacao_de_modelos` -> `comparacao-de-modelos` (o nome que §7.1/§7.2/§8.4 consomem)."""
    s = re.sub(r"^\d+_", "", stem)
    s = sem_acentos(s).replace("_", "-").lower()
    s = re.sub(r"[^a-z0-9-]+", "-", s)
    return s.strip("-")


def slug_do_heading(s: str) -> str:
    s = sem_acentos(s).lower()
    s = re.sub(r"[^a-z0-9]+", "-", s)
    return s.strip("-") or "secao"


def heading_de(linha: str) -> tuple[int, str] | None:
    m = re.match(r"^(#{1,4})\s+(.+?)\s*#*\s*$", linha)
    if not m:
        return None
    return len(m.group(1)), m.group(2).strip()


def montar_toc(cells: list[dict[str, Any]]) -> tuple[list[dict[str, Any]], dict[int, dict[str, dict[str, str]]]]:
    """TOC com numeração hierárquica (3.2.1) e, por célula markdown, o mapa texto -> {id, numero}."""
    contadores = [0, 0, 0, 0]
    toc: list[dict[str, Any]] = []
    ancoras: dict[int, dict[str, dict[str, str]]] = {}
    usados: set[str] = set()
    for indice, cell in enumerate(cells):
        if cell.get("cell_type") != "markdown":
            continue
        for linha in texto(cell.get("source")).splitlines():
            h = heading_de(linha)
            if not h:
                continue
            nivel, titulo = h
            contadores[nivel - 1] += 1
            for i in range(nivel, 4):
                contadores[i] = 0
            numero = ".".join(str(c) for c in contadores[:nivel] if c > 0)
            base = f"{numero.replace('.', '-')}-{slug_do_heading(titulo)}"
            ident = base
            n = 2
            while ident in usados:
                ident = f"{base}-{n}"
                n += 1
            usados.add(ident)
            toc.append({"id": ident, "texto": titulo, "nivel": nivel, "numero": numero})
            ancoras.setdefault(indice, {})[titulo] = {"id": ident, "numero": numero}
    if not toc:
        # Fallback: âncoras sintéticas por célula de código, para a barra lateral nunca ficar vazia.
        for indice, cell in enumerate(cells):
            if cell.get("cell_type") == "code":
                n_exec = cell.get("execution_count") or indice
                toc.append({"id": f"in-{n_exec}", "texto": f"In [{n_exec}]", "nivel": 1, "numero": str(n_exec)})
    return toc, ancoras


def converter_plotly(figura: dict[str, Any]) -> dict[str, Any]:
    dados = []
    for trace in figura.get("data", []) or []:
        t = dict(trace)
        if t.get("type") == "scattergl":
            t["type"] = "scatter"
        dados.append(t)
    layout = dict(figura.get("layout", {}) or {})
    layout.pop("template", None)
    return {"kind": "plotly", "data": dados, "layout": layout}


def converter_saida(
    saida: dict[str, Any], slug: str, pasta_assets: Path, contador: list[int]
) -> dict[str, Any] | None:
    tipo = saida.get("output_type")
    if tipo == "stream":
        t = texto(saida.get("text"))
        return {"kind": "texto", "texto": t} if t.strip() else None
    if tipo == "error":
        linhas = [re.sub(r"\x1b\[[0-9;]*m", "", str(l)) for l in saida.get("traceback", [])]
        return {"kind": "texto", "texto": "\n".join(linhas) or f"{saida.get('ename')}: {saida.get('evalue')}"}
    if tipo not in ("display_data", "execute_result"):
        return None
    dados = {k: v for k, v in (saida.get("data") or {}).items() if k not in MIMES_LIXO}
    if MIME_PLOTLY in dados:
        return converter_plotly(dados[MIME_PLOTLY])
    if "image/png" in dados:
        contador[0] += 1
        nome = f"{slug}-{contador[0]}.png"
        conteudo = base64.b64decode(texto(dados["image/png"]))
        destino = pasta_assets / nome
        if not destino.exists() or destino.read_bytes() != conteudo:
            destino.write_bytes(conteudo)
        alt = texto(dados.get("text/plain")).strip() or f"Figura {contador[0]}"
        return {"kind": "png", "src": f"/study/assets/{nome}", "alt": alt[:200]}
    if "text/html" in dados:
        return {"kind": "html", "html": texto(dados["text/html"])}
    if "text/plain" in dados:
        t = texto(dados["text/plain"])
        return {"kind": "texto", "texto": t} if t.strip() else None
    return None


def data_de_execucao(nb: Any) -> str:
    """A data mais recente dos metadados de execução das células (determinística, vem do .ipynb)."""
    maior = ""
    for cell in nb.cells:
        exec_meta = (cell.get("metadata") or {}).get("execution") or {}
        for valor in exec_meta.values():
            if isinstance(valor, str) and valor > maior:
                maior = valor
    return maior or DATA_ZERO


def processar(caminho: Path, raiz: Path, saida: Path, formatador: HtmlFormatter) -> dict[str, Any]:
    nb = nbformat.read(caminho, as_version=4)
    slug = slug_do_arquivo(caminho.stem)
    pasta_assets = saida / "assets"
    pasta_assets.mkdir(parents=True, exist_ok=True)
    for antigo in pasta_assets.glob(f"{slug}-*.png"):
        antigo.unlink()
    toc, ancoras = montar_toc(list(nb.cells))
    titulo = next((t["texto"] for t in toc if t["nivel"] == 1), caminho.stem)
    lexer = PythonLexer()
    contador = [0]
    cells: list[dict[str, Any]] = []
    n_figuras = 0
    for indice, cell in enumerate(nb.cells):
        fonte = texto(cell.get("source"))
        if cell.cell_type == "markdown":
            cells.append({"type": "markdown", "source": fonte, "anchors": ancoras.get(indice, {})})
        elif cell.cell_type == "code":
            saidas = []
            for s in cell.get("outputs", []) or []:
                conv = converter_saida(dict(s), slug, pasta_assets, contador)
                if conv is not None:
                    saidas.append(conv)
                    if conv["kind"] in ("plotly", "png"):
                        n_figuras += 1
            cells.append(
                {
                    "type": "code",
                    "source": fonte,
                    "codeHtml": highlight(fonte, lexer, formatador),
                    "execution_count": cell.get("execution_count"),
                    "outputs": saidas,
                }
            )
    gerado_em = data_de_execucao(nb)
    (saida / "notebooks").mkdir(parents=True, exist_ok=True)
    shutil.copyfile(caminho, saida / "notebooks" / f"{slug}.ipynb")
    origem = caminho.resolve().relative_to(raiz.resolve()).as_posix()
    documento = {
        "slug": slug,
        "titulo": titulo,
        "gerado_em": gerado_em,
        "download": f"/study/notebooks/{slug}.ipynb",
        "arquivo_origem": origem,
        "toc": toc,
        "cells": cells,
    }
    (saida / f"{slug}.json").write_text(
        json.dumps(documento, ensure_ascii=False, sort_keys=True, indent=1) + "\n", encoding="utf-8", newline="\n"
    )
    return {
        "slug": slug,
        "titulo": titulo,
        "n_celulas": len(cells),
        "n_figuras": n_figuras,
        "atualizado_em": gerado_em,
        "arquivo_origem": origem,
    }


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--root", default=".", help="raiz do repositório (onde está study/)")
    parser.add_argument("--out", default="frontend/public/study", help="pasta de saída")
    args = parser.parse_args()
    raiz = Path(args.root)
    saida = Path(args.out)
    saida.mkdir(parents=True, exist_ok=True)
    notebooks = sorted((raiz / "study").glob("*.ipynb"))
    if not notebooks:
        print("nenhum notebook em study/", file=sys.stderr)
        return 1
    formatador = HtmlFormatter(nowrap=True)
    manifesto = [processar(nb, raiz, saida, formatador) for nb in notebooks]
    (saida / "manifest.json").write_text(
        json.dumps(manifesto, ensure_ascii=False, sort_keys=True, indent=1) + "\n", encoding="utf-8", newline="\n"
    )
    css = HtmlFormatter(style="default").get_style_defs(".hl") + "\n" + HtmlFormatter(style="monokai").get_style_defs(
        '[data-theme="dark"] .hl'
    )
    (saida / "pygments.css").write_text(css + "\n", encoding="utf-8", newline="\n")
    for m in manifesto:
        print(f"{m['slug']}: {m['n_celulas']} células, {m['n_figuras']} figuras, {m['atualizado_em']}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
