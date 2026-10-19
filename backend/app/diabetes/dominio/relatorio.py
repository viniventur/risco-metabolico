"""Relatório HTML imprimível da triagem de diabetes, no desenho do relatório da obesidade.

Mesma marca Visor (ADR 0011): o símbolo vem de `app.dominio.relatorio` por import — uma cópia só
do desenho —, tinta sobre papel, Source Serif 4 com Georgia de reserva (o arquivo é autocontido) e
o magenta só na classificação, o resultado da triagem. Muda a nota de dados: a base desta vertente
é de respostas reais e anonimizadas (decisão D3), e a frase dela vive aqui, literal. `html.escape`
em todo texto de usuário; o nome existe no HTML devolvido e em lugar nenhum além disso.
"""

from __future__ import annotations

import html

from app.config import CONFIG
from app.diabetes.dominio.regras import RISCO_ELEVADO, ROTULOS_ENTRADAS, ROTULOS_ESCALA
from app.diabetes.esquemas.entrada import EntradaDiabetes
from app.diabetes.esquemas.saida import RespostaDiabetes
from app.dominio.relatorio import _SIMBOLO_VISOR

# Em UMA linha de propósito: o portão test_aviso_de_dados_reais_presente procura a frase literal e
# contígua neste arquivo; literais concatenados a esconderiam dele.
FRASE_DADOS_REAIS = "Os dados exibidos são respostas reais e anonimizadas de uma pesquisa pública de saúde dos Estados Unidos (BRFSS 2015, CDC) e servem apenas para demonstração. Nenhum registro identifica uma pessoa. Esta ferramenta é de triagem e não substitui avaliação clínica."  # noqa: E501

LEITURA_RISCO_ELEVADO = (
    "A probabilidade estimada está no limiar de triagem ou acima dele: a triagem sugere conversar "
    "com um profissional de saúde sobre um exame de glicemia."
)
LEITURA_RISCO_BAIXO = (
    "A probabilidade estimada está abaixo do limiar de triagem. Isso não descarta a diabetes: o "
    "limiar deixa de fora parte das pessoas que têm a doença."
)
NOTA_ESCALA = (
    "A probabilidade vale na escala da base — os respondentes de uma pesquisa telefônica dos "
    "Estados Unidos em 2015 —, não na população brasileira."
)


def _valor_exibido(campo: str, valor: object) -> str:
    """O valor como a pessoa o leu no formulário: rótulo da escala, IMC com duas casas."""
    if campo in ROTULOS_ESCALA and isinstance(valor, int):
        return ROTULOS_ESCALA[campo][valor]
    if campo == "IMC" and isinstance(valor, float):
        return f"{valor:.2f}"
    return str(valor)


def montar_relatorio_html(
    entrada: EntradaDiabetes, resposta: RespostaDiabetes, nome: str = ""
) -> str:
    """Gera um HTML autocontido para ser impresso ou salvo pela pessoa avaliada."""
    nome_seguro = html.escape(nome.strip() or "Pessoa avaliada")
    produto = html.escape(CONFIG.nome_app)
    leitura = (
        LEITURA_RISCO_ELEVADO if resposta.classificacao == RISCO_ELEVADO else LEITURA_RISCO_BAIXO
    )
    linhas = "\n".join(
        f"<tr><td>{html.escape(ROTULOS_ENTRADAS[campo])}</td>"
        f"<td>{html.escape(_valor_exibido(campo, valor))}</td></tr>"
        for campo, valor in entrada.valores_do_modelo().items()
    )
    extrapolou = ""
    if resposta.fora_do_dominio_treino:
        campos = ", ".join(html.escape(c) for c in resposta.fora_do_dominio_treino)
        extrapolou = f"<p class='nota'>Valores fora da faixa observada na base: {campos}.</p>"

    return f"""<!DOCTYPE html>
<html lang="pt-BR">
<head>
    <meta charset="utf-8">
    <title>{produto} — relatório de triagem de diabetes</title>
    <style>
        /* Marca Visor: tinta #201E1D, papel #F3F2F2, magenta #D6006C só no resultado. */
        body {{ font-family: "Source Serif 4", Georgia, "Times New Roman", serif;
               margin: 32px; color: #201e1d; background: #f3f2f2; line-height: 1.5; }}
        .assinatura {{ display: flex; align-items: center; gap: 14px; }}
        h1 {{ margin: 0; font-weight: 600; font-size: 26px; }}
        h3 {{ font-weight: 600; }}
        .sub {{ color: #615c5a; margin: 6px 0 24px; font-style: italic; }}
        .cards {{ display: flex; gap: 16px; flex-wrap: wrap; }}
        .metric {{ background: #fdfcfc; border: 1px solid #dcd8d7; padding: 12px 16px;
                   border-radius: 10px; min-width: 160px; }}
        .metric-label {{ font-size: 12px; letter-spacing: 0.04em; color: #615c5a;
                         text-transform: uppercase; }}
        .metric-value {{ font-size: 22px; font-weight: 600; font-variant-numeric: tabular-nums; }}
        .previsao {{ color: #d6006c; }}
        .metric-hint {{ color: #201e1d; margin-top: 4px; }}
        table {{ width: 100%; border-collapse: collapse; margin-top: 16px; background: #fdfcfc; }}
        th, td {{ padding: 10px 12px; border-bottom: 1px solid #dcd8d7; text-align: left; }}
        .leitura {{ margin-top: 20px; }}
        .nota {{ color: #615c5a; font-size: 13px; margin-top: 24px; }}
        @media print {{ body {{ margin: 12mm; background: #ffffff; }} }}
    </style>
</head>
<body>
    <div class="assinatura">{_SIMBOLO_VISOR}
        <h1>{produto} — relatório de triagem de diabetes</h1>
    </div>
    <div class="sub">Resumo gerado para {nome_seguro}</div>
    <div class="cards">
        <div class='metric'>
            <div class='metric-label'>Classificação</div>
            <div class='metric-value previsao'>{html.escape(resposta.classificacao)}</div>
            <div class='metric-hint'>Limiar de triagem: {resposta.limiar * 100:.1f}%</div>
        </div>
        <div class='metric'>
            <div class='metric-label'>Probabilidade estimada</div>
            <div class='metric-value'>{resposta.probabilidade * 100:.1f}%</div>
            <div class='metric-hint'>de já ter recebido o diagnóstico</div>
        </div>
        <div class='metric'>
            <div class='metric-label'>IMC</div>
            <div class='metric-value'>{resposta.imc:.2f}</div>
            <div class='metric-hint'>{html.escape(resposta.faixa_imc)}</div>
        </div>
    </div>
    <p class="leitura">{leitura}</p>
    <h3 style="margin-top:24px;">Dados informados</h3>
    <table>
        <tbody>
            {linhas}
        </tbody>
    </table>
    {extrapolou}
    <p class="nota">{NOTA_ESCALA}</p>
    <p class="nota">{FRASE_DADOS_REAIS}</p>
    <p class="nota">Modelo de diabetes {html.escape(resposta.versao_modelo)} ·
       resposta em {resposta.latencia_ms:.1f} ms</p>
</body>
</html>
"""
