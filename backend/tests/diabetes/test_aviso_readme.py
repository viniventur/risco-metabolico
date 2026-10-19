"""O portão da frase de D3 no README: no primeiro bloco visível, o mesmo da frase da obesidade.

O portão da frase da obesidade (tests/test_proveniencia.py::test_aviso_de_dados_ficticios_presente)
lê o primeiro bloco depois do título, o que vai até a primeira linha em branco. A frase de D3 fica
nesse bloco, como parágrafo seguinte da mesma citação, e não num bloco próprio. A cópia do portão
da frase de D3 é a de tests/diabetes/test_contrato_diabetes.py.
"""

from __future__ import annotations

from tests.diabetes.conftest import RAIZ
from tests.diabetes.test_contrato_diabetes import FRASE_D3
from tests.test_proveniencia import FRASE_DADOS_FICTICIOS


def test_aviso_de_dados_reais_no_readme() -> None:
    """As duas frases, literais e contíguas, no primeiro bloco do README."""
    readme = (RAIZ / "README.md").read_text(encoding="utf-8")
    primeiro_bloco = readme.split("\n\n")[1]
    assert FRASE_D3 in primeiro_bloco, "README: a frase de D3 tem de estar no primeiro bloco"
    assert FRASE_DADOS_FICTICIOS in primeiro_bloco, "README: as duas frases ficam no mesmo bloco"
