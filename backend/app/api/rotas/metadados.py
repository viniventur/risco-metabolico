"""`GET /metadata`: a especificação do formulário. A regra de formulário deixa de morar no JSX.

Os rótulos saem dos dicionários `*_map` do app legado (`collect_user_input`) — é a única coisa
daquele bloco que atravessa — com o domínio de transporte corrigido (`Carro`/`Moto`).
"""

from __future__ import annotations

from fastapi import APIRouter, Depends, Request, Response

from app.api.dependencias import obter_artefato
from app.dominio.relatorio import FRASE_DADOS_FICTICIOS
from app.esquemas.entrada import EntradaTriagem
from app.esquemas.saida import CampoFormulario, GrupoFormulario, MetadadosFormulario, OpcaoCampo
from app.nucleo.artefato import ArtefatoModelo
from app.nucleo.respostas import resposta_cacheavel

roteador = APIRouter(tags=["formulario"])

AVISO_REGISTRO_ANONIMO = (
    FRASE_DADOS_FICTICIOS
    + " As entradas são registradas de forma anônima para monitoramento do modelo."
)

# Rótulo de cada feature de entrada (e do IMC derivado), usado também em /model/feature-importance.
ROTULOS_FEATURES: dict[str, str] = {
    "Genero": "Gênero",
    "Idade": "Idade (anos)",
    "Altura": "Altura (m)",
    "Peso": "Peso (kg)",
    "Historico_Familiar_Sobrepeso": "Histórico familiar de sobrepeso",
    "Consumo_Calorico_Frequente": "Consumo frequente de alimentos calóricos",
    "Consumo_Vegetais": "Frequência de consumo de vegetais",
    "Numero_Refeicoes_Principais": "Refeições principais por dia",
    "Consumo_Alimentos_Entre_Refeicoes": "Lanches entre refeições",
    "Fumante": "Fumante",
    "Consumo_Agua_Diario": "Consumo diário de água",
    "Monitoramento_Calorias": "Monitora calorias",
    "Atividade_Fisica_Frequencia": "Atividade física semanal",
    "Tempo_Dispositivos_Tecnologicos": "Tempo diário em dispositivos eletrônicos",
    "Consumo_Alcool": "Consumo de álcool",
    "Meio_Transporte": "Meio de transporte principal",
    "IMC": "IMC (derivado de peso e altura)",
}

_SIM_NAO = [OpcaoCampo(rotulo="Sim", valor="Sim"), OpcaoCampo(rotulo="Não", valor="Não")]
_FREQUENCIA = [
    OpcaoCampo(rotulo="Não", valor="Não"),
    OpcaoCampo(rotulo="Às vezes", valor="Às vezes"),
    OpcaoCampo(rotulo="Frequentemente", valor="Frequentemente"),
    OpcaoCampo(rotulo="Sempre", valor="Sempre"),
]


def _selecao(
    nome: str, opcoes: list[OpcaoCampo], padrao: str | int, ajuda: str | None = None
) -> CampoFormulario:
    return CampoFormulario(
        nome=nome,
        rotulo=ROTULOS_FEATURES[nome],
        tipo="selecao",
        opcoes=opcoes,
        padrao=padrao,
        ajuda=ajuda,
    )


def _numero(
    nome: str, minimo: float, maximo: float, passo: float, padrao: float, ajuda: str
) -> CampoFormulario:
    return CampoFormulario(
        nome=nome,
        rotulo=ROTULOS_FEATURES[nome],
        tipo="numero",
        minimo=minimo,
        maximo=maximo,
        passo=passo,
        padrao=padrao,
        ajuda=ajuda,
    )


GRUPOS: list[GrupoFormulario] = [
    GrupoFormulario(
        id="dados-iniciais",
        titulo="Dados iniciais",
        campos=[
            _selecao(
                "Genero",
                [
                    OpcaoCampo(rotulo="Feminino", valor="Feminino"),
                    OpcaoCampo(rotulo="Masculino", valor="Masculino"),
                ],
                "Feminino",
            ),
            _numero("Idade", 14, 61, 1, 25, "Faixa observada no treino: 14 a 61 anos."),
            _numero(
                "Altura",
                1.40,
                2.00,
                0.01,
                1.70,
                "O treino viu 1,45 a 1,98 m; fora disso a resposta avisa.",
            ),
            _numero(
                "Peso",
                39.0,
                175.0,
                0.5,
                70.0,
                "O treino viu 39 a 173 kg; fora disso a resposta avisa.",
            ),
        ],
    ),
    GrupoFormulario(
        id="dieta",
        titulo="Descreva brevemente sua dieta",
        campos=[
            _selecao(
                "Numero_Refeicoes_Principais",
                [
                    OpcaoCampo(rotulo="1 refeição", valor=1),
                    OpcaoCampo(rotulo="2 refeições", valor=2),
                    OpcaoCampo(rotulo="3 refeições", valor=3),
                    OpcaoCampo(rotulo="4 ou mais", valor=4),
                ],
                3,
            ),
            _selecao("Consumo_Alimentos_Entre_Refeicoes", _FREQUENCIA, "Às vezes"),
            _selecao(
                "Consumo_Vegetais",
                [
                    OpcaoCampo(rotulo="Raramente", valor=1),
                    OpcaoCampo(rotulo="Às vezes", valor=2),
                    OpcaoCampo(rotulo="Sempre", valor=3),
                ],
                2,
            ),
            _selecao(
                "Consumo_Agua_Diario",
                [
                    OpcaoCampo(rotulo="Menos de 1L/dia", valor=1),
                    OpcaoCampo(rotulo="1 a 2L/dia", valor=2),
                    OpcaoCampo(rotulo="Mais de 2L/dia", valor=3),
                ],
                2,
            ),
            _selecao("Consumo_Calorico_Frequente", _SIM_NAO, "Sim"),
            _selecao("Consumo_Alcool", _FREQUENCIA, "Não"),
        ],
    ),
    GrupoFormulario(
        id="habitos",
        titulo="Como são seus hábitos?",
        campos=[
            _selecao("Fumante", _SIM_NAO, "Não"),
            _selecao("Monitoramento_Calorias", _SIM_NAO, "Não"),
            _selecao(
                "Atividade_Fisica_Frequencia",
                [
                    OpcaoCampo(rotulo="Nenhuma", valor=0),
                    OpcaoCampo(rotulo="1 a 2 vezes por semana", valor=1),
                    OpcaoCampo(rotulo="3 a 4 vezes por semana", valor=2),
                    OpcaoCampo(rotulo="5 ou mais vezes por semana", valor=3),
                ],
                1,
            ),
            _selecao(
                "Tempo_Dispositivos_Tecnologicos",
                [
                    OpcaoCampo(rotulo="0 a 2 horas/dia", valor=0),
                    OpcaoCampo(rotulo="3 a 5 horas/dia", valor=1),
                    OpcaoCampo(rotulo="Mais de 5 horas/dia", valor=2),
                ],
                0,
            ),
            _selecao(
                "Meio_Transporte",
                [
                    OpcaoCampo(rotulo="Transporte Público", valor="Transporte Público"),
                    OpcaoCampo(rotulo="Caminhada", valor="Caminhada"),
                    OpcaoCampo(rotulo="Carro", valor="Carro"),
                    OpcaoCampo(rotulo="Moto", valor="Moto"),
                    OpcaoCampo(rotulo="Bicicleta", valor="Bicicleta"),
                ],
                "Transporte Público",
            ),
            _selecao("Historico_Familiar_Sobrepeso", _SIM_NAO, "Sim"),
        ],
    ),
]


def nomes_do_formulario() -> set[str]:
    """Os `nome` de todos os campos — o teste de §10.6 exige 100% dos alias de EntradaTriagem."""
    return {campo.nome for grupo in GRUPOS for campo in grupo.campos}


assert nomes_do_formulario() == {f.alias for f in EntradaTriagem.model_fields.values() if f.alias}


@roteador.get(
    "/metadata",
    response_model=MetadadosFormulario,
    summary="Especificação do formulário: grupos, campos, tipos, faixas, opções e defaults",
)
def metadata(request: Request, artefato: ArtefatoModelo = Depends(obter_artefato)) -> Response:
    """O React monta o formulário a partir daqui; nenhuma regra de formulário mora no JSX."""
    corpo = MetadadosFormulario(
        grupos=GRUPOS, versao_modelo=artefato.versao, aviso=AVISO_REGISTRO_ANONIMO
    )
    return resposta_cacheavel(request, corpo.model_dump(), max_age=3600)
