"""`POST /diabetes/predicoes`, `/diabetes/predicoes/lote` e `/diabetes/predicoes/relatorio`.

O desenho das rotas de predição da obesidade (`app.api.rotas.predicoes`): `def` síncronas (o
`predict_proba` é CPU-bound e vai para o threadpool), a mesma limitação de taxa e o MESMO log de
predição (decisão D5) — a tarefa de fundo só enfileira no sumidouro do lifespan. Vão ao log a
allowlist das dez entradas desta vertente, a rota `/diabetes/...` e a classificação como rótulo;
`risco_acumulado` fica nulo, porque aquela coluna é a soma das classes de risco da outra vertente.
"""

from __future__ import annotations

import time
import uuid
from typing import Any

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, Request, Response, status
from pydantic import ValidationError

from app.api.dependencias import obter_sumidouro
from app.config import CONFIG
from app.diabetes.api.dependencias import obter_artefato_diabetes
from app.diabetes.dominio.features import ENTRADAS
from app.diabetes.dominio.predicao import detectar_fora_do_dominio, prever
from app.diabetes.dominio.regras import RISCO_ELEVADO, classificar
from app.diabetes.dominio.relatorio import montar_relatorio_html
from app.diabetes.esquemas.entrada import EntradaDiabetes, EntradaRelatorioDiabetes, LoteDiabetes
from app.diabetes.esquemas.saida import RespostaDiabetes, RespostaLoteDiabetes
from app.diabetes.nucleo.artefato import ArtefatoDiabetes
from app.dominio.regras import classificar_imc
from app.esquemas.saida import FalhaLote
from app.nucleo.erros import CategoriaDesconhecida, ForaDoDominio
from app.nucleo.limite_taxa import limitador
from app.nucleo.log_predicao import RegistroPredicao, SumidouroLog, origem_de

roteador = APIRouter(prefix="/predicoes", tags=["diabetes"])

# Allowlist, nunca denylist (§6.8.2): só as dez entradas atravessam para o log.
CAMPOS_LOGADOS: frozenset[str] = frozenset(ENTRADAS)


def sanear(valores: dict[str, Any]) -> dict[str, Any]:
    """Só as dez entradas atravessam; `nome`, cabeçalhos e qualquer campo novo ficam de fora."""
    return {k: v for k, v in valores.items() if k in CAMPOS_LOGADOS}


def _registro(
    rota: str,
    origem: str,
    correlacao: uuid.UUID,
    entrada: EntradaDiabetes,
    resposta: RespostaDiabetes,
    artefato: ArtefatoDiabetes,
) -> RegistroPredicao:
    """A linha do log compartilhado, com a rota e as entradas desta vertente."""
    return RegistroPredicao(
        rota=rota,
        origem=origem,
        id_correlacao=str(correlacao),
        entrada=sanear(entrada.valores_do_modelo()),
        saida=resposta.model_dump(),
        rotulo_saida=resposta.classificacao,
        risco_acumulado=None,
        versao_modelo=artefato.versao,
        versao_dados=artefato.versao_dados,
        versao_api=CONFIG.versao_api,
        latencia_ms=resposta.latencia_ms,
        status_http=200,
    )


def _montar_resposta(artefato: ArtefatoDiabetes, entrada: EntradaDiabetes) -> RespostaDiabetes:
    """Prediz a probabilidade, classifica pelo limiar do artefato e devolve o IMC e a faixa."""
    inicio = time.perf_counter()
    valores = entrada.valores_do_modelo()
    probabilidade = prever(artefato, valores)
    classificacao = classificar(probabilidade, artefato.limiar)
    return RespostaDiabetes(
        probabilidade=probabilidade,
        limiar=artefato.limiar,
        risco_elevado=classificacao == RISCO_ELEVADO,
        classificacao=classificacao,
        # IMC e faixa são de tela e de relatório: o modelo usa o IMC arredondado, por dentro.
        imc=round(entrada.imc, 2),
        faixa_imc=classificar_imc(entrada.imc),
        fora_do_dominio_treino=detectar_fora_do_dominio(valores),
        versao_modelo=artefato.versao,
        latencia_ms=round((time.perf_counter() - inicio) * 1000, 2),
    )


@roteador.post(
    "",
    response_model=RespostaDiabetes,
    summary="Estima a probabilidade de diagnóstico de diabetes e a classifica pelo limiar",
)
@limitador.limit(CONFIG.limite_taxa_predicao)
def prever_diabetes(
    request: Request,  # exigido pelo decorador do limitador
    entrada: EntradaDiabetes,
    tarefas: BackgroundTasks,
    artefato: ArtefatoDiabetes = Depends(obter_artefato_diabetes),
    sumidouro: SumidouroLog = Depends(obter_sumidouro),
) -> RespostaDiabetes:
    """Uma pessoa, dez respostas: probabilidade, limiar de triagem e classificação."""
    resposta = _montar_resposta(artefato, entrada)
    tarefas.add_task(
        sumidouro.registrar,
        _registro(
            "/diabetes/predicoes", origem_de(request), uuid.uuid4(), entrada, resposta, artefato
        ),
    )
    return resposta


@roteador.post(
    "/lote",
    response_model=RespostaLoteDiabetes,
    summary="Triagem de diabetes de vários indivíduos; um item inválido não derruba o lote",
    responses={413: {"description": "Lote acima de LIMITE_LOTE"}},
)
@limitador.limit(CONFIG.limite_taxa_lote)
def prever_lote_diabetes(
    request: Request,
    lote: LoteDiabetes,
    tarefas: BackgroundTasks,
    artefato: ArtefatoDiabetes = Depends(obter_artefato_diabetes),
    sumidouro: SumidouroLog = Depends(obter_sumidouro),
) -> RespostaLoteDiabetes:
    """Valida item a item dentro do laço: o inválido volta em `falhas` com o índice de origem."""
    if len(lote.itens) > CONFIG.limite_lote:
        raise HTTPException(
            status.HTTP_413_CONTENT_TOO_LARGE,
            detail=f"Lote com {len(lote.itens)} itens excede o limite de {CONFIG.limite_lote}.",
        )
    resultados: list[RespostaDiabetes] = []
    falhas: list[FalhaLote] = []
    correlacao = uuid.uuid4()  # um lote de N itens gera N linhas com o MESMO id
    for indice, item in enumerate(lote.itens):
        try:
            entrada = EntradaDiabetes.model_validate(item)
            resposta = _montar_resposta(artefato, entrada)
            resultados.append(resposta)
            tarefas.add_task(
                sumidouro.registrar,
                _registro(
                    "/diabetes/predicoes/lote", "lote", correlacao, entrada, resposta, artefato
                ),
            )
        except ValidationError as erro:
            primeiro = erro.errors()[0]
            falhas.append(
                FalhaLote(
                    indice=indice,
                    campo=str(primeiro["loc"][-1]) if primeiro["loc"] else None,
                    mensagem=str(primeiro["msg"]),
                )
            )
        except CategoriaDesconhecida as erro:
            falhas.append(FalhaLote(indice=indice, campo=erro.campo, mensagem=erro.mensagem))
        except (ForaDoDominio, TypeError, ValueError) as erro:
            falhas.append(FalhaLote(indice=indice, mensagem=str(erro)))
    return RespostaLoteDiabetes(
        total=len(lote.itens),
        sucesso=len(resultados),
        resultados=resultados,
        falhas=falhas,
        versao_modelo=artefato.versao,
    )


@roteador.post(
    "/relatorio",
    response_class=Response,
    responses={200: {"content": {"text/html": {}}}},
    summary="Gera o relatório HTML imprimível da triagem de diabetes",
)
@limitador.limit(CONFIG.limite_taxa_predicao)
def gerar_relatorio_diabetes(
    request: Request,
    corpo: EntradaRelatorioDiabetes,
    tarefas: BackgroundTasks,
    artefato: ArtefatoDiabetes = Depends(obter_artefato_diabetes),
    sumidouro: SumidouroLog = Depends(obter_sumidouro),
) -> Response:
    """HTML autocontido. O `nome` existe no HTML devolvido e em lugar nenhum além disso."""
    resposta = _montar_resposta(artefato, corpo.entrada)
    html = montar_relatorio_html(corpo.entrada, resposta, corpo.nome)
    # `corpo.nome` NÃO é passado ao registro: só `corpo.entrada` chega ao log (§6.8.2).
    tarefas.add_task(
        sumidouro.registrar,
        _registro(
            "/diabetes/predicoes/relatorio",
            "painel",
            uuid.uuid4(),
            corpo.entrada,
            resposta,
            artefato,
        ),
    )
    return Response(content=html, media_type="text/html; charset=utf-8")
