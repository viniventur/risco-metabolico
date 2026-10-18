"""Relatório HTML imprimível — derivado de `montar_relatorio_html` do app legado.

Muda o título (entra o nome do produto), entra a nota de base fictícia, e a assinatura passa a
ser `(entrada, resposta, nome)`: idade, gênero, peso e altura saem de `entrada`; classe, risco e
as 7 probabilidades saem de `resposta`. `html.escape` em todo texto de usuário.

Desenho da marca Visor (manual 1.0, ADR 0011): o símbolo no cabeçalho, tinta sobre papel, Source
Serif 4 (com Georgia de reserva: o arquivo é autocontido e não baixa fonte de lugar nenhum) e o
magenta só na classe estimada, o resultado da previsão.
"""

from __future__ import annotations

import html

from app.config import CONFIG
from app.esquemas.entrada import EntradaTriagem
from app.esquemas.saida import RespostaTriagem

# Em UMA linha de propósito: o portão test_aviso_de_dados_ficticios_presente procura a frase
# literal e contígua neste arquivo; literais concatenados a esconderiam dele.
# O símbolo Visor, versão principal, do pacote da marca (sem o manifesto C2PA). Decorativo: o nome
# do produto vem no título ao lado.
_SIMBOLO_VISOR = (
    '<svg class="simbolo" viewBox="12 12 76 76" width="44" height="44" aria-hidden="true">'
    '<rect x="12" y="12" width="76" height="76" rx="20" fill="#201e1d"/>'
    '<ellipse cx="37" cy="67" rx="7.5" ry="11" fill="#444141"/>'
    '<ellipse cx="63" cy="67" rx="7.5" ry="11" fill="#444141"/>'
    '<rect x="24" y="22" width="52" height="24" rx="7" fill="#f8f4f4"/>'
    '<path d="M30.16 28.79L32.91 38.4M35.03 27.58L36.17 32.96M39.98 26.7L41.37 36.6'
    "M44.98 26.17L45.36 31.66M55.02 26.17L54.64 31.66M60.02 26.7L58.63 36.6"
    'M64.97 27.58L63.83 32.96M69.84 28.79L67.09 38.4" fill="none" stroke="#201e1d"'
    ' stroke-width="2.2" stroke-linecap="round"/>'
    '<path d="M50 23.5V44.5" fill="none" stroke="#d6006c" stroke-width="3.2"/>'
    "</svg>"
)

FRASE_DADOS_FICTICIOS = "Os dados exibidos são fictícios e servem apenas para demonstração. Nenhum registro corresponde a uma pessoa real. Esta ferramenta é de triagem e não substitui avaliação clínica."  # noqa: E501


def montar_relatorio_html(
    entrada: EntradaTriagem, resposta: RespostaTriagem, nome: str = ""
) -> str:
    """Gera um HTML autocontido para ser impresso ou salvo pela pessoa avaliada."""
    nome_seguro = html.escape(nome.strip() or "Pessoa avaliada")
    produto = html.escape(CONFIG.nome_app)

    prob_rows = "\n".join(
        f"<tr><td>{html.escape(p.classe)}</td><td>{p.probabilidade * 100:.1f}%</td>"
        f"<td>{'sim' if p.de_risco else 'não'}</td></tr>"
        for p in resposta.probabilidades
    )
    extrapolou = ""
    if resposta.fora_do_dominio_treino:
        campos = ", ".join(html.escape(c) for c in resposta.fora_do_dominio_treino)
        extrapolou = f"<p class='nota'>Valores fora da faixa observada no treino: {campos}.</p>"

    return f"""<!DOCTYPE html>
<html lang="pt-BR">
<head>
    <meta charset="utf-8">
    <title>{produto} — relatório de triagem</title>
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
        th {{ background: #e9e7e6; font-size: 12px; letter-spacing: 0.02em;
              text-transform: uppercase; color: #615c5a; }}
        .nota {{ color: #615c5a; font-size: 13px; margin-top: 24px; }}
        @media print {{ body {{ margin: 12mm; background: #ffffff; }} }}
    </style>
</head>
<body>
    <div class="assinatura">{_SIMBOLO_VISOR}<h1>{produto} — relatório de triagem</h1></div>
    <div class="sub">Resumo gerado para {nome_seguro}</div>
    <div class="cards">
        <div class='metric'>
            <div class='metric-label'>Classe estimada</div>
            <div class='metric-value previsao'>{html.escape(resposta.classe_prevista)}</div>
        </div>
        <div class='metric'>
            <div class='metric-label'>Risco acumulado</div>
            <div class='metric-value'>{resposta.risco_acumulado * 100:.1f}%</div>
            <div class='metric-hint'>Sobrepeso I/II + Obesidade I/II/III</div>
        </div>
        <div class='metric'>
            <div class='metric-label'>IMC</div>
            <div class='metric-value'>{resposta.imc:.2f}</div>
            <div class='metric-hint'>{html.escape(resposta.faixa_imc)}</div>
        </div>
    </div>
    <h3 style="margin-top:24px;">Dados informados</h3>
    <table>
        <tbody>
            <tr><td>Gênero</td><td>{html.escape(entrada.genero.value)}</td></tr>
            <tr><td>Idade</td><td>{entrada.idade:.0f} anos</td></tr>
            <tr><td>Altura</td><td>{entrada.altura:.2f} m</td></tr>
            <tr><td>Peso</td><td>{entrada.peso:.1f} kg</td></tr>
        </tbody>
    </table>
    <h3 style="margin-top:24px;">Probabilidades por classe</h3>
    <table>
        <thead><tr><th>Classe</th><th>Probabilidade</th><th>Classe de risco</th></tr></thead>
        <tbody>
            {prob_rows}
        </tbody>
    </table>
    {extrapolou}
    <p class="nota">{FRASE_DADOS_FICTICIOS}</p>
    <p class="nota">Modelo {html.escape(resposta.versao_modelo)} ·
       resposta em {resposta.latencia_ms:.1f} ms</p>
</body>
</html>
"""
