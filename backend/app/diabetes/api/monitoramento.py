"""`GET /diabetes/monitoramento/deriva`: a deriva da vertente, a única rota dela que lê o banco.

O desenho de `app.api.rotas.monitoramento`, que não é tocado: os três `.sql` de
sql/diabetes/deriva/ (lidos de `SQL_DIR`, traduzidos para `$1..$n`) sobre as referências
operacao.diabetes_*, o contrato de resposta da vertente de obesidade e a mesma degradação — `200`
com `disponivel: false` quando o banco está desligado ou não responde, nunca uma tela de erro.

Uma diferença: `N_MINIMO_DERIVA_DIABETES` não é obrigatória para a API subir (a da obesidade é),
porque uma variável nova obrigatória derrubaria quem atualiza a imagem sem ela. Sem ela, esta rota
responde `disponivel: false` e diz qual variável falta; o compose e o deploy a definem com o valor
medido (artifacts/diabetes/metricas/n-minimo-deriva.json).
"""

from __future__ import annotations

import math
from datetime import UTC, datetime
from functools import lru_cache
from typing import Any

from fastapi import APIRouter, Depends, Query, Request, Response

from app.api.dependencias import obter_banco
from app.config import CONFIG
from app.diabetes.api.dependencias import obter_artefato_diabetes
from app.diabetes.nucleo.artefato import ArtefatoDiabetes
from app.esquemas.deriva import (
    EstatisticaNumerica,
    FaixaComparada,
    IndicadorFeature,
    RespostaDeriva,
)
from app.nucleo.banco import Banco
from app.nucleo.respostas import resposta_cacheavel
from app.nucleo.sql_param import para_posicional

roteador = APIRouter(prefix="/monitoramento", tags=["diabetes"])

ARQUIVOS = (
    "01_distribuicao_numerica.sql",
    "02_contagem_por_faixa.sql",
    "03_indicador_divergencia.sql",
)
ORDENS = {
    "01_distribuicao_numerica.sql": ["janela_dias", "versao_modelo", "versao_dados"],
    "02_contagem_por_faixa.sql": ["janela_dias", "versao_modelo", "versao_dados"],
    "03_indicador_divergencia.sql": ["janela_dias", "versao_modelo", "versao_dados", "n_minimo"],
}
SEM_N_MINIMO = (
    "N_MINIMO_DERIVA_DIABETES não está definida no ambiente da API: sem a amostra mínima medida, "
    "nenhum PSI é calculado."
)


@lru_cache(maxsize=8)
def consultas() -> dict[str, tuple[str, list[str]]]:
    """Os três `.sql` lidos uma vez de `CONFIG.sql_dir/diabetes/deriva`, já posicionais."""
    pasta = CONFIG.sql_dir / "diabetes" / "deriva"
    return {
        nome: para_posicional((pasta / nome).read_text(encoding="utf-8"), ORDENS[nome])
        for nome in ARQUIVOS
    }


def _f(v: Any) -> float | None:
    if v is None:
        return None
    f = float(v)
    return None if (math.isnan(f) or math.isinf(f)) else f


def _indisponivel(janela: int, artefato: ArtefatoDiabetes, motivo: str) -> RespostaDeriva:
    return RespostaDeriva(
        janela_dias=janela,
        n_minimo=int(CONFIG.n_minimo_deriva_diabetes or 0),
        n_amostra=0,
        versao_modelo=artefato.versao,
        versao_dados=artefato.versao_dados,
        atualizado_em=datetime.now(UTC).isoformat(timespec="seconds"),
        disponivel=False,
        motivo=motivo,
        consultas=list(ARQUIVOS),
    )


@roteador.get(
    "/deriva",
    response_model=RespostaDeriva,
    summary="A entrada real da triagem de diabetes se parece com a base? PSI por entrada; 200 "
    "mesmo com o banco fora",
)
async def deriva_diabetes(
    request: Request,
    janela_dias: int = Query(default=30, ge=1, le=365),
    feature: str | None = Query(default=None, description="restringe `faixas` a uma entrada"),
    banco: Banco = Depends(obter_banco),
    artefato: ArtefatoDiabetes = Depends(obter_artefato_diabetes),
) -> Response:
    """Uma requisição, três consultas, `Cache-Control: public, max-age=300`."""
    if not banco.habilitado:
        corpo = _indisponivel(janela_dias, artefato, "banco desligado (BANCO_HABILITADO=false)")
        return resposta_cacheavel(request, corpo.model_dump(), max_age=60, com_etag=False)
    if CONFIG.n_minimo_deriva_diabetes is None:
        corpo = _indisponivel(janela_dias, artefato, SEM_N_MINIMO)
        return resposta_cacheavel(request, corpo.model_dump(), max_age=60, com_etag=False)
    valores = {
        "janela_dias": janela_dias,
        "versao_modelo": artefato.versao,
        "versao_dados": artefato.versao_dados,
        "n_minimo": int(CONFIG.n_minimo_deriva_diabetes),
    }
    resultados: dict[str, list[Any]] = {}
    for nome, (sql, nomes) in consultas().items():
        linhas = await banco.consultar(sql, *[valores[n] for n in nomes])
        if linhas is None:
            corpo = _indisponivel(
                janela_dias,
                artefato,
                "O histórico de predições está indisponível no momento — o banco não "
                f"respondeu (estado: {banco.estado}). O restante do painel não depende dele.",
            )
            return resposta_cacheavel(request, corpo.model_dump(), max_age=60, com_etag=False)
        resultados[nome] = [dict(ln) for ln in linhas]

    tipos = {r["feature"]: r["tipo"] for r in resultados["02_contagem_por_faixa.sql"]}
    features = [
        IndicadorFeature(
            feature=str(r["feature"]),
            tipo=tipos.get(str(r["feature"]), "categorica"),
            n_amostra=int(r["n_amostra"] or 0),
            psi=_f(r["psi"]),
            classificacao=str(r["classificacao"]),
        )
        for r in resultados["03_indicador_divergencia.sql"]
    ]
    estatisticas = [
        EstatisticaNumerica(
            feature=str(r["feature"]),
            n_linhas=int(r["n_linhas"] or 0),
            n_validos=int(r["n_validos"] or 0),
            n_nulos=int(r["n_nulos"] or 0),
            media_log=_f(r["media_log"]),
            media_treino=_f(r["media_treino"]),
            desvio_log=_f(r["desvio_log"]),
            desvio_treino=_f(r["desvio_treino"]),
            p50_log=_f(r["p50_log"]),
            p50_treino=_f(r["p50_treino"]),
            minimo_log=_f(r["minimo_log"]),
            maximo_log=_f(r["maximo_log"]),
            minimo_treino=_f(r["minimo_treino"]),
            maximo_treino=_f(r["maximo_treino"]),
            deslocamento_desvios=_f(r["deslocamento_desvios"]),
            extrapolou_faixa_de_treino=r["extrapolou_faixa_de_treino"],
        )
        for r in resultados["01_distribuicao_numerica.sql"]
    ]
    faixas = [
        FaixaComparada(
            feature=str(r["feature"]),
            faixa_idx=int(r["faixa_idx"]),
            tipo=str(r["tipo"]),
            faixa_rotulo=r["faixa_rotulo"],
            limite_inf=_f(r["limite_inf"]),
            limite_sup=_f(r["limite_sup"]),
            n_log=int(r["n_log"] or 0),
            prop_log=_f(r["prop_log"]),
            proporcao_treino=float(r["proporcao_treino"]),
            n_treino=int(r["n_treino"]),
            n_total_log=int(r["n_total_log"] or 0),
        )
        for r in resultados["02_contagem_por_faixa.sql"]
        if feature is None or r["feature"] == feature
    ]
    corpo = RespostaDeriva(
        janela_dias=janela_dias,
        n_minimo=valores["n_minimo"],
        n_amostra=max((f.n_amostra for f in features), default=0),
        versao_modelo=artefato.versao,
        versao_dados=artefato.versao_dados,
        atualizado_em=datetime.now(UTC).isoformat(timespec="seconds"),
        disponivel=True,
        features=features,
        estatisticas=estatisticas,
        faixas=faixas,
        consultas=list(ARQUIVOS),
    )
    return resposta_cacheavel(request, corpo.model_dump(), max_age=300, com_etag=False)
