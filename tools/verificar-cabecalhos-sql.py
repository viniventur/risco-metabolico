"""Portão do CI para sql/agregados e sql/pontos (plano, §6.7.4) — e para sql/diabetes/agregados.

Confere: `@id` igual ao nome do arquivo; `@origem` apontando para algo que existe (arquivo ou
seção documentada); `@divergencia` diferente de `-` apontando para um ADR existente; toda tabela
citada na query declarada em `@fonte`; `round(` PROIBIDO em sql/agregados (§10.9.1, divergência
8); as classes de `@medida` coincidindo com CLASSES_MEDIDA do materializador E com o dicionário
TOLERANCIA do teste de paridade — os três conjuntos, ou falha.

A vertente diabetes tem os agregados dela em sql/diabetes/agregados (5, sem projeção) e os JSON em
artifacts/diabetes/agregados; as mesmas regras valem arquivo a arquivo, e o TOLERANCIA do teste de
paridade dela também tem de coincidir com CLASSES_MEDIDA.

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
AGREGADOS_DIABETES = 5


def _classes_do_teste(teste: Path) -> set[str]:
    texto = teste.read_text(encoding="utf-8")
    bloco = re.search(r"TOLERANCIA\s*=\s*\{(.*?)\}", texto, re.S)
    if not bloco:
        return set()
    return set(TOLERANCIA_TESTE.findall(bloco.group(1)))


def _origem_existe(origem: str) -> bool:
    alvo = origem.split(",")[0].split(";")[0].strip()
    return (RAIZ / alvo).exists()


def _conferir_arquivo(cab: agregar.Cabecalho) -> list[str]:
    """As regras de cada `.sql`: origem, divergência, tabelas lidas, round( e classes de medida."""
    problemas: list[str] = []
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
    return problemas


def _conferir_tolerancia(teste: Path) -> list[str]:
    do_teste = _classes_do_teste(teste) if teste.exists() else set()
    if do_teste and do_teste != agregar.CLASSES_MEDIDA:
        return [
            f"TOLERANCIA do teste {sorted(do_teste)} ≠ CLASSES_MEDIDA {sorted(agregar.CLASSES_MEDIDA)}: "
            "acrescentar uma classe exige tocar os três lugares"
        ]
    return []


def _conferir_artefatos(pasta: Path, cabs: list[agregar.Cabecalho]) -> list[str]:
    esperados = {f"{c.id}.json" for c in cabs}
    existentes = {p.name for p in pasta.glob("*.json")}
    if existentes and existentes != esperados:
        rel = pasta.relative_to(RAIZ).as_posix()
        return [f"{rel}: sobra {sorted(existentes - esperados)}, falta {sorted(esperados - existentes)}"]
    return []


def main() -> int:
    """Devolve 1 com a lista de problemas, 0 se tudo bate."""
    problemas: list[str] = []
    cabs = agregar.listar(RAIZ / "sql" / "agregados", RAIZ / "sql" / "pontos")
    if len([c for c in cabs if c.tipo == "agregado"]) != 7 or len([c for c in cabs if c.tipo == "pontos"]) != 1:
        problemas.append(f"esperados 7 agregados + 1 projeção; encontrados {[c.id for c in cabs]}")
    for cab in cabs:
        problemas += _conferir_arquivo(cab)
    problemas += _conferir_tolerancia(RAIZ / "backend" / "tests" / "test_paridade_agregados.py")
    problemas += _conferir_artefatos(RAIZ / "artifacts" / "agregados", cabs)

    # A vertente diabetes: os mesmos cabeçalhos, só agregados (a vertente não tem projeção).
    sql_diabetes = sorted((RAIZ / "sql" / "diabetes" / "agregados").glob("*.sql"))
    cabs_diabetes = [agregar.ler_cabecalho(p, "agregado") for p in sql_diabetes]
    if len(cabs_diabetes) != AGREGADOS_DIABETES:
        problemas.append(
            f"vertente diabetes: esperados {AGREGADOS_DIABETES} agregados; "
            f"encontrados {[c.id for c in cabs_diabetes]}"
        )
    for cab in cabs_diabetes:
        problemas += _conferir_arquivo(cab)
    problemas += _conferir_tolerancia(
        RAIZ / "backend" / "tests" / "diabetes" / "test_paridade_agregados_diabetes.py"
    )
    problemas += _conferir_artefatos(RAIZ / "artifacts" / "diabetes" / "agregados", cabs_diabetes)

    if problemas:
        print("FALHA nos cabeçalhos SQL:")
        for p in problemas:
            print(f"  {p}")
        return 1
    print(f"OK: {len(cabs)} arquivos SQL com cabeçalho válido ({', '.join(c.id for c in cabs)})")
    print(
        f"OK: {len(cabs_diabetes)} arquivos SQL da vertente diabetes com cabeçalho válido "
        f"({', '.join(c.id for c in cabs_diabetes)})"
    )
    return 0


if __name__ == "__main__":
    sys.exit(main())
