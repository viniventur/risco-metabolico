"""`GET /monitoramento/deriva`: a ÚNICA rota de leitura que depende do banco em runtime (§6.8.5).

Executa os três `sql/deriva/*.sql` (lidos de `SQL_DIR`, traduzidos para `$1..$n`) e degrada com
`200` + `disponivel: false` quando o banco está desligado, frio demais ou pausado — o front mostra
uma faixa de aviso, nunca uma tela de erro. Nenhum outro endpoint pode ser acrescentado a esta
classe sem passar pelo mesmo desenho.
"""

from __future__ import annotations

import math
from datetime import UTC, datetime
from functools import lru_cache
from typing import Any

from fastapi import APIRouter, Depends, Query, Request, Response

from app.api.dependencias import obter_artefato, obter_banco
from app.config import CONFIG
from app.esquemas.deriva import (
    EstatisticaNumerica,
    FaixaComparada,
    IndicadorFeature,
    RespostaDeriva,
)
from app.nucleo.artefato import ArtefatoModelo
from app.nucleo.banco import Banco
from app.nucleo.respostas import resposta_cacheavel
from app.nucleo.sql_param import para_posicional

roteador = APIRouter(prefix="/monitoramento", tags=["monitoramento"])

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


@lru_cache(maxsize=8)
def consultas() -> dict[str, tuple[str, list[str]]]:
    """Os três `.sql` lidos uma vez de `CONFIG.sql_dir/deriva`, já traduzidos para posicionais."""
    pasta = CONFIG.sql_dir / "deriva"
    return {
        nome: para_posicional((pasta / nome).read_text(encoding="utf-8"), ORDENS[nome])
        for nome in ARQUIVOS
    }


def _f(v: Any) -> float | None:
    if v is None:
        return None
    f = float(v)
    return None if (math.isnan(f) or math.isinf(f)) else f


def _indisponivel(janela: int, artefato: ArtefatoModelo, motivo: str) -> RespostaDeriva:
    return RespostaDeriva(
        janela_dias=janela,
        n_minimo=int(CONFIG.n_minimo_deriva or 0),
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
    summary="A entrada real se parece com a de treino? PSI por feature; 200 mesmo com o banco fora",
)
async def deriva(
    request: Request,
    janela_dias: int = Query(default=30, ge=1, le=365),
    feature: str | None = Query(default=None, description="restringe `faixas` a uma feature"),
    banco: Banco = Depends(obter_banco),
    artefato: ArtefatoModelo = Depends(obter_artefato),
) -> Response:
    """Uma requisição, três consultas, `Cache-Control: public, max-age=300`."""
    if not banco.habilitado:
        corpo = _indisponivel(janela_dias, artefato, "banco desligado (BANCO_HABILITADO=false)")
        return resposta_cacheavel(request, corpo.model_dump(), max_age=60, com_etag=False)
    valores = {
        "janela_dias": janela_dias,
        "versao_modelo": artefato.versao,
        "versao_dados": artefato.versao_dados,
        "n_minimo": int(CONFIG.n_minimo_deriva or 0),
    }
    resultados: dict[str, list[Any]] = {}
    for nome, (sql, nomes) in consultas().items():
        linhas = await banco.consultar(sql, *[valores[n] for n in nomes])
        if linhas is None:
            corpo = _indisponivel(
                janela_dias,
                artefato,
                "O histórico de predições está indisponível no momento — o banco do plano "
                f"gratuito hiberna por inatividade (estado: {banco.estado}). "
                "O restante do painel não depende dele.",
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
