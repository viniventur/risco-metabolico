"""`POST /predicoes`, `/predicoes/lote` e `/predicoes/relatorio` (§6.4).

As três rotas são `def` síncronas de propósito: o `predict_proba` é CPU-bound e o FastAPI as
manda para o threadpool. A `BackgroundTask` delas também roda fora do event loop, e por isso o
sumidouro enfileira com `call_soon_threadsafe` (§6.8.1). A tarefa de fundo NÃO fala com o banco:
ela só enfileira; quem grava é o consumidor único do lifespan.
"""

from __future__ import annotations

import time
import uuid

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, Request, Response, status
from pydantic import ValidationError

from app.api.dependencias import obter_artefato, obter_sumidouro
from app.config import CONFIG
from app.dominio.predicao import detectar_fora_do_dominio, prever
from app.dominio.regras import calcular_imc, calcular_risco_acumulado, classificar_imc
from app.dominio.relatorio import montar_relatorio_html
from app.esquemas.entrada import EntradaRelatorio, EntradaTriagem, LoteTriagem
from app.esquemas.saida import FalhaLote, RespostaLote, RespostaTriagem
from app.nucleo.artefato import ArtefatoModelo
from app.nucleo.erros import CategoriaDesconhecida, ForaDoDominio
from app.nucleo.limite_taxa import limitador
from app.nucleo.log_predicao import RegistroPredicao, SumidouroLog, origem_de, sanear

roteador = APIRouter(prefix="/predicoes", tags=["predicoes"])

# O limite de lote tem UMA fonte de verdade: CONFIG.limite_lote (variável LIMITE_LOTE). Não há
# constante de módulo nem max_length no schema — três fontes divergem em uma semana.


def _registro(
    rota: str,
    origem: str,
    correlacao: uuid.UUID,
    entrada: EntradaTriagem,
    resposta: RespostaTriagem,
    artefato: ArtefatoModelo,
) -> RegistroPredicao:
    """Monta a linha do log. `sanear` aplica a allowlist: só as 16 features (§6.8.2)."""
    return RegistroPredicao(
        rota=rota,
        origem=origem,
        id_correlacao=str(correlacao),
        entrada=sanear(entrada.valores_do_modelo()),
        saida=resposta.model_dump(),
        rotulo_saida=resposta.classe_prevista,
        risco_acumulado=resposta.risco_acumulado,
        versao_modelo=artefato.versao,
        versao_dados=artefato.versao_dados,
        versao_api=CONFIG.versao_api,
        latencia_ms=resposta.latencia_ms,
        status_http=200,
    )


def _montar_resposta(artefato: ArtefatoModelo, entrada: EntradaTriagem) -> RespostaTriagem:
    """Prediz a distribuição das 7 classes e deriva IMC e risco acumulado."""
    inicio = time.perf_counter()
    valores = entrada.valores_do_modelo()

    probabilidades = prever(artefato, valores)  # já em ordem clínica
    classe_prevista = max(probabilidades, key=lambda p: p.probabilidade).classe

    # IMC e faixa são métrica de tela e de relatório (o modelo usa o IMC cheio, por dentro).
    imc = calcular_imc(entrada.peso, entrada.altura)

    return RespostaTriagem(
        classe_prevista=classe_prevista,
        risco_acumulado=calcular_risco_acumulado(probabilidades),
        probabilidades=probabilidades,
        imc=imc,
        faixa_imc=classificar_imc(imc),
        fora_do_dominio_treino=detectar_fora_do_dominio(artefato, valores),
        versao_modelo=artefato.versao,
        latencia_ms=round((time.perf_counter() - inicio) * 1000, 2),
    )


@roteador.post(
    "",
    response_model=RespostaTriagem,
    summary="Estima a distribuição entre as 7 faixas e o risco metabólico acumulado",
)
@limitador.limit(CONFIG.limite_taxa_predicao)
def prever_individuo(
    request: Request,  # exigido pelo decorador do limitador
    entrada: EntradaTriagem,
    tarefas: BackgroundTasks,
    artefato: ArtefatoModelo = Depends(obter_artefato),
    sumidouro: SumidouroLog = Depends(obter_sumidouro),
) -> RespostaTriagem:
    """Uma pessoa, 16 respostas, 7 probabilidades em ordem clínica e o risco acumulado."""
    resposta = _montar_resposta(artefato, entrada)  # CategoriaDesconhecida -> 422 pelo handler
    # A tarefa de fundo apenas ENFILEIRA: sem I/O, sem await, microssegundos.
    tarefas.add_task(
        sumidouro.registrar,
        _registro("/predicoes", origem_de(request), uuid.uuid4(), entrada, resposta, artefato),
    )
    return resposta


@roteador.post(
    "/lote",
    response_model=RespostaLote,
    summary="Estima o risco para vários indivíduos de uma vez; um item inválido não derruba o lote",
    responses={413: {"description": "Lote acima de LIMITE_LOTE"}},
)
@limitador.limit(CONFIG.limite_taxa_lote)
def prever_lote(
    request: Request,
    lote: LoteTriagem,
    tarefas: BackgroundTasks,
    artefato: ArtefatoModelo = Depends(obter_artefato),
    sumidouro: SumidouroLog = Depends(obter_sumidouro),
) -> RespostaLote:
    """Valida item a item dentro do laço: o inválido volta em `falhas` com o índice de origem."""
    if len(lote.itens) > CONFIG.limite_lote:
        raise HTTPException(
            status.HTTP_413_CONTENT_TOO_LARGE,
            detail=f"Lote com {len(lote.itens)} itens excede o limite de {CONFIG.limite_lote}.",
        )

    resultados: list[RespostaTriagem] = []
    falhas: list[FalhaLote] = []
    correlacao = uuid.uuid4()  # um lote de N itens gera N linhas com o MESMO id
    for indice, item in enumerate(lote.itens):
        try:
            entrada = EntradaTriagem.model_validate(item)
            resposta = _montar_resposta(artefato, entrada)
            resultados.append(resposta)
            tarefas.add_task(
                sumidouro.registrar,
                _registro("/predicoes/lote", "lote", correlacao, entrada, resposta, artefato),
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

    return RespostaLote(
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
    summary="Gera o relatório HTML imprimível do indivíduo avaliado",
)
@limitador.limit(CONFIG.limite_taxa_predicao)
def gerar_relatorio(
    request: Request,
    corpo: EntradaRelatorio,
    tarefas: BackgroundTasks,
    artefato: ArtefatoModelo = Depends(obter_artefato),
    sumidouro: SumidouroLog = Depends(obter_sumidouro),
) -> Response:
    """HTML autocontido. O `nome` existe no HTML devolvido e em lugar nenhum além disso."""
    resposta = _montar_resposta(artefato, corpo.entrada)
    html = montar_relatorio_html(corpo.entrada, resposta, corpo.nome)
    # `corpo.nome` NÃO é passado ao registro: só `corpo.entrada` chega ao log (§6.8.2).
    tarefas.add_task(
        sumidouro.registrar,
        _registro(
            "/predicoes/relatorio", "painel", uuid.uuid4(), corpo.entrada, resposta, artefato
        ),
    )
    return Response(content=html, media_type="text/html; charset=utf-8")
