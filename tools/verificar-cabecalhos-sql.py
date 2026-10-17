"""Portão do CI para sql/agregados e sql/pontos (plano, §6.7.4).

Confere: `@id` igual ao nome do arquivo; `@origem` apontando para algo que existe (arquivo ou
seção documentada); `@divergencia` diferente de `-` apontando para um ADR existente; toda tabela
citada na query declarada em `@fonte`; `round(` PROIBIDO em sql/agregados (§10.9.1, divergência
8); as classes de `@medida` coincidindo com CLASSES_MEDIDA do materializador E com o dicionário
TOLERANCIA do teste de paridade — os três conjuntos, ou falha.

Uso (da raiz): uv run --project backend python tools/verificar-cabecalhos-sql.py
"""

from __future__ import annotations

import re
import sys
from pathlib import Path

RAIZ = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(RAIZ / "backend"))

from app.treino import agregar  # noqa: E402

TABELAS = re.compile(r"\b(?:FROM|JOIN)\s+((?:dados|operacao)\.[a-z_]+)", re.IGNORECASE)
TOLERANCIA_TESTE = re.compile(r'^\s*"(\w+)":\s*[0-9.e-]+,', re.MULTILINE)


def _classes_do_teste() -> set[str]:
    texto = (RAIZ / "backend" / "tests" / "test_paridade_agregados.py").read_text(encoding="utf-8")
    bloco = re.search(r"TOLERANCIA\s*=\s*\{(.*?)\}", texto, re.S)
    if not bloco:
        return set()
    return set(TOLERANCIA_TESTE.findall(bloco.group(1)))


def _origem_existe(origem: str) -> bool:
    alvo = origem.split(",")[0].split(";")[0].strip()
    return (RAIZ / alvo).exists()


def main() -> int:
    """Devolve 1 com a lista de problemas, 0 se tudo bate."""
    problemas: list[str] = []
    cabs = agregar.listar(RAIZ / "sql" / "agregados", RAIZ / "sql" / "pontos")
    if len([c for c in cabs if c.tipo == "agregado"]) != 7 or len([c for c in cabs if c.tipo == "pontos"]) != 1:
        problemas.append(f"esperados 7 agregados + 1 projeção; encontrados {[c.id for c in cabs]}")
    for cab in cabs:
        rel = cab.arquivo.relative_to(RAIZ).as_posix()
        if not _origem_existe(cab.origem):
            problemas.append(f"{rel}: @origem aponta para algo que não existe: {cab.origem!r}")
        if cab.divergencia is not None:
            adr = list((RAIZ / "docs" / "decisoes").glob(f"{cab.divergencia}-*.md"))
            if not adr:
                problemas.append(f"{rel}: @divergencia {cab.divergencia} sem ADR em docs/decisoes/")
        corpo = "\n".join(ln for ln in cab.sql.splitlines() if not ln.strip().startswith("--"))
        citadas = {t.lower() for t in TABELAS.findall(corpo)}
        fora = sorted(citadas - {f.lower() for f in cab.fonte})
        if fora:
            problemas.append(f"{rel}: tabelas lidas fora de @fonte: {fora}")
        if cab.tipo == "agregado" and re.search(r"\bround\s*\(", corpo, re.IGNORECASE):
            problemas.append(f"{rel}: round( é proibido — arredondar é apresentação (format/ptBR.ts)")
        for _, classe in cab.medidas:
            if classe not in agregar.CLASSES_MEDIDA:
                problemas.append(f"{rel}: classe de medida {classe!r} fora de CLASSES_MEDIDA")
    do_teste = _classes_do_teste()
    if do_teste and do_teste != agregar.CLASSES_MEDIDA:
        problemas.append(
            f"TOLERANCIA do teste {sorted(do_teste)} ≠ CLASSES_MEDIDA {sorted(agregar.CLASSES_MEDIDA)}: "
            "acrescentar uma classe exige tocar os três lugares"
        )
    esperados = {f"{c.id}.json" for c in cabs}
    existentes = {p.name for p in (RAIZ / "artifacts" / "agregados").glob("*.json")}
    if existentes and existentes != esperados:
        problemas.append(f"artifacts/agregados: sobra {sorted(existentes - esperados)}, falta {sorted(esperados - existentes)}")
    if problemas:
        print("FALHA nos cabeçalhos SQL:")
        for p in problemas:
            print(f"  {p}")
        return 1
    print(f"OK: {len(cabs)} arquivos SQL com cabeçalho válido ({', '.join(c.id for c in cabs)})")
    return 0


if __name__ == "__main__":
    sys.exit(main())
