"""Portão de proveniência: espelha scripts/verificar-proveniencia.ps1, com o mesmo regex.

O regex vive em UM lugar só (scripts/padrao-proveniencia.txt). Este teste aplica a
MESMA lista de exclusão do script PowerShell — incluindo a si mesmo, o script, a
auditoria do legado e os PLANO-*.md — senão reprova o repositório por causa do
próprio teste (plano, §3.4 e §10.6).
"""

from __future__ import annotations

import os
import re
from collections.abc import Iterator
from pathlib import Path

import pytest

RAIZ = Path(__file__).resolve().parents[2]
PADRAO_TXT = RAIZ / "scripts" / "padrao-proveniencia.txt"
FONTE_MD = RAIZ / "data" / "bruto" / "FONTE.md"

DIRS_IGNORADOS = {
    ".git", "node_modules", ".venv", "dist", "__pycache__", ".pytest_cache", ".ruff_cache",
    ".mypy_cache", "htmlcov", ".vite", "playwright-report", "test-results", ".ipynb_checkpoints",
}
CONTEUDO_IGNORADO = (
    re.compile(r"verificar-proveniencia\.ps1$"),
    re.compile(r"padrao-proveniencia\.txt$"),
    re.compile(r"test_proveniencia\.py$"),
    re.compile(r"docs[\\/]auditoria-do-legado\.md$"),
    re.compile(r"PLANO-.*\.md$"),
)
BINARIOS = re.compile(r"\.(png|jpe?g|gif|ico|webp|woff2?|ttf|otf|eot|pdf|parquet|pkl|zip|gz|pyc|xlsx|pbix)$", re.I)

FRASE_DADOS_FICTICIOS = (
    "Os dados exibidos são fictícios e servem apenas para demonstração. "
    "Nenhum registro corresponde a uma pessoa real. "
    "Esta ferramenta é de triagem e não substitui avaliação clínica."
)


def _padroes() -> tuple[re.Pattern[str], re.Pattern[str]]:
    linhas = [ln for ln in PADRAO_TXT.read_text(encoding="utf-8").splitlines() if ln.strip()]
    assert len(linhas) >= 2, "padrao-proveniencia.txt precisa de duas linhas"
    return re.compile(linhas[0]), re.compile(linhas[1])


def _arquivos() -> Iterator[Path]:
    for atual, dirs, nomes in os.walk(RAIZ):
        dirs[:] = sorted(d for d in dirs if d not in DIRS_IGNORADOS)
        for nome in sorted(nomes):
            yield Path(atual) / nome


def _relativo(p: Path) -> str:
    return str(p.relative_to(RAIZ))


def _alvos_conteudo() -> list[Path]:
    return [
        p for p in _arquivos()
        if not any(r.search(_relativo(p)) for r in CONTEUDO_IGNORADO) and not BINARIOS.search(p.name)
    ]


def _ocorrencias(padrao: re.Pattern[str], arquivos: list[Path]) -> list[str]:
    achados: list[str] = []
    for p in arquivos:
        texto = p.read_text(encoding="utf-8", errors="replace")
        for n, linha in enumerate(texto.splitlines(), start=1):
            if padrao.search(linha):
                achados.append(f"{_relativo(p)}:{n}  {linha.strip()[:120]}")
    return achados


def test_padrao_tem_duas_linhas() -> None:
    amplo, estrito = _padroes()
    assert amplo.flags & re.IGNORECASE, "a linha 1 precisa ser insensível a caixa ((?i) embutido)"
    assert not (estrito.flags & re.IGNORECASE), "a linha 2 é sensível a caixa de propósito"


def test_sem_termos_proibidos_no_conteudo() -> None:
    amplo, estrito = _padroes()
    alvos = _alvos_conteudo()
    achados = _ocorrencias(amplo, alvos) + _ocorrencias(estrito, alvos)
    assert not achados, "termos proibidos no conteúdo:\n" + "\n".join(achados)


def test_sem_termos_proibidos_em_nomes() -> None:
    amplo, estrito = _padroes()
    ruins = [_relativo(p) for p in _arquivos() if amplo.search(_relativo(p)) or estrito.search(_relativo(p))]
    assert not ruins, "termos proibidos em nomes de arquivo/pasta:\n" + "\n".join(ruins)


def test_citacao_presente_e_nao_pendente() -> None:
    assert FONTE_MD.exists(), "data/bruto/FONTE.md é obrigatório (§3.2)"
    texto = FONTE_MD.read_text(encoding="utf-8")
    bloco = re.search(r"(?s)citacao-inicio -->(.*?)<!-- citacao-fim", texto)
    assert bloco and bloco.group(1).strip(), "bloco de citação vazio"
    assert "PENDENTE" not in bloco.group(1), "citação ainda PENDENTE"
    assert re.search(r"(?s)autores-inicio -->(.*?)<!-- autores-fim", bloco.group(1)), "sub-bloco de autores ausente"


def _tokens_de_autores() -> list[str]:
    texto = FONTE_MD.read_text(encoding="utf-8")
    bloco = re.search(r"(?s)citacao-inicio -->(.*?)<!-- citacao-fim", texto).group(1)
    autores = re.search(r"(?s)autores-inicio -->(.*?)<!-- autores-fim", bloco).group(1)
    return sorted({t for t in re.findall(r"\b[^\W\d_][^\W\d_]{2,}\b", autores) if t[0].isupper()})


def test_nomes_de_terceiros_nao_vazam_do_bloco_de_citacao() -> None:
    """A exceção da §3.2 vale só dentro de FONTE.md: nenhum nome de autor em outro arquivo."""
    tokens = _tokens_de_autores()
    assert tokens, "nenhum nome de autor encontrado no sub-bloco de autores"
    outros = [p for p in _alvos_conteudo() if p.resolve() != FONTE_MD.resolve()]
    achados: list[str] = []
    for token in tokens:
        padrao = re.compile(rf"\b{re.escape(token)}\b")
        achados += [f"{a}  ({token})" for a in _ocorrencias(padrao, outros)]
    assert not achados, "nome de terceiro fora do bloco de citação:\n" + "\n".join(achados)


def test_aviso_de_dados_ficticios_presente() -> None:
    """O que é OBRIGATÓRIO também tem portão: a frase de §3.2 nos três lugares (§10.6)."""
    readme = (RAIZ / "README.md").read_text(encoding="utf-8")
    primeiro_bloco = readme.split("\n\n")[1] if "\n\n" in readme else readme
    assert FRASE_DADOS_FICTICIOS in primeiro_bloco, "README: a frase precisa estar no primeiro bloco visível"
    for rel in ("frontend/src/shared/ui/RodapeAviso.tsx", "backend/app/dominio/relatorio.py"):
        arquivo = RAIZ / rel
        if not arquivo.exists():
            pytest.skip(f"{rel} ainda não existe (fase posterior)")
        assert FRASE_DADOS_FICTICIOS in arquivo.read_text(encoding="utf-8"), f"{rel}: frase ausente"
