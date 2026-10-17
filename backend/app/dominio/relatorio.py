"""Relatório HTML imprimível — cópia quase literal de `montar_relatorio_html` do app legado.

Muda o título (entra o nome do produto), entra a nota de base fictícia, e a assinatura passa a
ser `(entrada, resposta, nome)`: idade, gênero, peso e altura saem de `entrada`; classe, risco e
as 7 probabilidades saem de `resposta`. `html.escape` em todo texto de usuário.
"""

from __future__ import annotations

import html

from app.config import CONFIG
from app.esquemas.entrada import EntradaTriagem
from app.esquemas.saida import RespostaTriagem

FRASE_DADOS_FICTICIOS = (
    "Os dados exibidos são fictícios e servem apenas para demonstração. "
    "Nenhum registro corresponde a uma pessoa real. "
    "Esta ferramenta é de triagem e não substitui avaliação clínica."
)


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
        body {{ font-family: Arial, sans-serif; margin: 32px; color: #1f2937; }}
        h1 {{ margin-bottom: 4px; }}
        .sub {{ color: #6b7280; margin-bottom: 24px; }}
        .cards {{ display: flex; gap: 16px; flex-wrap: wrap; }}
        .metric {{ background: #f3f4f6; padding: 12px 16px; border-radius: 8px; min-width: 160px; }}
        .metric-label {{ font-size: 12px; letter-spacing: 0.04em; color: #6b7280;
                         text-transform: uppercase; }}
        .metric-value {{ font-size: 22px; font-weight: 700; }}
        .metric-hint {{ color: #111827; margin-top: 4px; }}
        table {{ width: 100%; border-collapse: collapse; margin-top: 16px; }}
        th, td {{ padding: 10px 12px; border-bottom: 1px solid #e5e7eb; text-align: left; }}
        th {{ background: #f9fafb; font-size: 12px; letter-spacing: 0.02em;
              text-transform: uppercase; color: #6b7280; }}
        .nota {{ color: #6b7280; font-size: 13px; margin-top: 24px; }}
        @media print {{ body {{ margin: 12mm; }} }}
    </style>
</head>
<body>
    <h1>{produto} — relatório de triagem</h1>
    <div class="sub">Resumo gerado para {nome_seguro}</div>
    <div class="cards">
        <div class='metric'>
            <div class='metric-label'>Classe estimada</div>
            <div class='metric-value'>{html.escape(resposta.classe_prevista)}</div>
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
