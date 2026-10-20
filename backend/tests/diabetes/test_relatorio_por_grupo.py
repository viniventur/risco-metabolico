"""O relatório HTML com o limiar por grupo de idade: a leitura diz o grupo e por que ele importa.

As leituras de antes (`LEITURA_RISCO_*`) continuam inteiras no HTML; com `grupo_de_idade`, vêm logo
depois a frase do grupo e a linha do porquê, a mesma da tela do simulador. Sem ele (um `.pkl` sem a
tabela, como o da 1.0.0), o relatório é o de antes.
"""

from __future__ import annotations

from app.diabetes.dominio.regras import RISCO_ELEVADO, classificar
from app.diabetes.dominio.relatorio import (
    LEITURA_RISCO_BAIXO,
    LEITURA_RISCO_ELEVADO,
    LIMIAR_DO_GRUPO,
    POR_QUE_A_IDADE,
    montar_relatorio_html,
)
from app.diabetes.esquemas.entrada import EntradaDiabetes
from app.diabetes.esquemas.saida import RespostaDiabetes
from tests.diabetes.conftest import ENTRADA_PADRAO_DIABETES, RAIZ, URL_DIABETES

TELA = "frontend/src/features/diabetes/simulador/ResultadoDiabetes.tsx"
BAIXO = ENTRADA_PADRAO_DIABETES | {
    "Faixa_Etaria": 1,
    "IMC": 21.0,
    "Pressao_Alta": "Não",
    "Colesterol_Alto": "Não",
}


def test_a_leitura_do_relatorio_diz_o_grupo_e_por_que(cliente) -> None:
    classificacoes = set()
    for entrada in (ENTRADA_PADRAO_DIABETES, BAIXO):
        corpo = cliente.post(f"{URL_DIABETES}/predicoes", json=entrada).json()
        html = cliente.post(f"{URL_DIABETES}/predicoes/relatorio", json={"entrada": entrada}).text
        leitura = LEITURA_RISCO_ELEVADO if corpo["risco_elevado"] else LEITURA_RISCO_BAIXO
        frase = LIMIAR_DO_GRUPO.format(grupo=corpo["grupo_de_idade"])
        assert f'<p class="leitura">{leitura} {frase}</p>' in html
        assert POR_QUE_A_IDADE in html
        classificacoes.add(corpo["classificacao"])
    assert len(classificacoes) == 2, "as duas leituras"


def test_o_relatorio_de_um_modelo_de_limiar_unico_fica_como_antes(
    cliente, manifest_diabetes: dict
) -> None:
    corpo = cliente.post(f"{URL_DIABETES}/predicoes", json=ENTRADA_PADRAO_DIABETES).json()
    limiar = manifest_diabetes["limiar"]["valor"]
    classificacao = classificar(corpo["probabilidade"], limiar)
    resposta = RespostaDiabetes.model_validate(
        corpo
        | {
            "limiar": limiar,
            "grupo_de_idade": None,
            "classificacao": classificacao,
            "risco_elevado": classificacao == RISCO_ELEVADO,
        }
    )
    html = montar_relatorio_html(EntradaDiabetes.model_validate(ENTRADA_PADRAO_DIABETES), resposta)
    leitura = LEITURA_RISCO_ELEVADO if resposta.risco_elevado else LEITURA_RISCO_BAIXO
    assert f'<p class="leitura">{leitura}</p>' in html
    assert f"Limiar de triagem: {limiar * 100:.1f}%" in html
    assert "grupo de idade" not in html and POR_QUE_A_IDADE not in html


def test_a_linha_do_porque_e_a_mesma_da_tela() -> None:
    assert POR_QUE_A_IDADE in (RAIZ / TELA).read_text(encoding="utf-8"), TELA
