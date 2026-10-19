"""O portão da frase de D3 no front: literal e contígua no rodapé que as telas da vertente mostram.

A frase da obesidade continua com o portão de tests/test_proveniencia.py, que lê o mesmo arquivo; a
cópia do portão da frase de D3 é a de tests/diabetes/test_contrato_diabetes.py.
"""

from __future__ import annotations

from tests.diabetes.conftest import RAIZ
from tests.diabetes.test_contrato_diabetes import FRASE_D3

RODAPE = "frontend/src/shared/ui/RodapeAviso.tsx"


def test_aviso_de_dados_reais_no_front() -> None:
    """O rodapé por rota mostra a frase de D3 nas telas /diabetes/*: ali, inteira."""
    texto = (RAIZ / RODAPE).read_text(encoding="utf-8")
    assert FRASE_D3 in texto, f"{RODAPE}: frase de D3 ausente ou partida"
