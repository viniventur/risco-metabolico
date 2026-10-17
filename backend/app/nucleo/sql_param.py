"""Tradução dos parâmetros `:'nome'` / `:nome` do psql para os posicionais `$1..$n` do asyncpg.

Os `.sql` de deriva rodam em dois dialetos de parâmetro: no `psql` (`-v nome=valor`, textuais com
aspas) e no runtime (`asyncpg`, só `$1..$n`, sem substituição por nome). Esta função é o único
ponto de tradução, e `test_deriva.py::test_traducao_de_parametros` fixa as ordens esperadas.
"""

from __future__ import annotations

import re

# `(?<![:\w])` ignora os casts `::text` e `::double precision`; `(?!\w)` fecha o nome.
_PARAMETRO = re.compile(r"(?<![:\w]):'(\w+)'|(?<![:\w]):(\w+)(?!\w)")
_COMENTARIO = re.compile(r"--[^\n]*")


def sem_comentarios(sql: str) -> str:
    """Remove os comentários `--`: o cabeçalho cita os parâmetros e viraria placeholder."""
    return _COMENTARIO.sub("", sql)


def para_posicional(sql: str, ordem: list[str] | None = None) -> tuple[str, list[str]]:
    """Substitui cada parâmetro por `$k` na ordem de PRIMEIRA ocorrência; devolve (sql, nomes).

    Com `ordem`, confere que os nomes encontrados são exatamente esses, nessa sequência — é o
    que impede uma query editada de receber os argumentos trocados em silêncio.
    """
    nomes: list[str] = []

    def trocar(m: re.Match[str]) -> str:
        nome = m.group(1) or m.group(2)
        if nome not in nomes:
            nomes.append(nome)
        return f"${nomes.index(nome) + 1}"

    traduzido = _PARAMETRO.sub(trocar, sem_comentarios(sql))
    if ordem is not None and nomes != list(ordem):
        raise ValueError(f"parâmetros {nomes} diferem da ordem esperada {list(ordem)}")
    return traduzido, nomes
