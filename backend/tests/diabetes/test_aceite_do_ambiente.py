"""O texto das respostas da vertente casa com o que o aceite do ambiente confere.

scripts/verificar-stack.sh, o passo do CI que libera a publicação das imagens, lê as respostas como
texto (`grep -Ei`): a ordem dos campos no JSON faz parte do que ele confere. Os padrões vêm do
próprio script, e a entrada é a mesma dele, o primeiro caso de ouro.
"""

from __future__ import annotations

import json
import re

from tests.diabetes.conftest import DADOS_OURO_DIABETES, RAIZ, URL_DIABETES

SCRIPT = RAIZ / "scripts" / "verificar-stack.sh"


def _padrao(descricao: str) -> str:
    """O padrão da linha `conferir "<descricao>" contem ... '<padrão>'` do script."""
    texto = SCRIPT.read_text(encoding="utf-8")
    linha = rf"^conferir \"{re.escape(descricao)}\" contem .* '([^']+)'$"
    achado = re.search(linha, texto, re.MULTILINE)
    assert achado, f"{descricao}: a conferência sumiu de {SCRIPT.name}"
    return achado.group(1)


def test_a_predicao_casa_com_o_aceite(cliente) -> None:
    padrao = _padrao("POST /api/v1/diabetes/predicoes devolve probabilidade e limiar")
    entrada = json.loads((DADOS_OURO_DIABETES / "entradas.json").read_text(encoding="utf-8"))[0]
    texto = cliente.post(f"{URL_DIABETES}/predicoes", json=entrada).text
    assert re.search(padrao, texto, re.IGNORECASE), texto


def test_o_model_info_casa_com_o_aceite(cliente) -> None:
    padrao = _padrao("/api/v1/diabetes/model/info com o limiar")
    assert re.search(padrao, cliente.get(f"{URL_DIABETES}/model/info").text, re.IGNORECASE)
