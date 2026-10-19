"""`GET /diabetes/metadata`: a especificação do formulário da vertente diabetes.

Os rótulos curtos saem de `regras.ROTULOS_ENTRADAS` e os das escalas de `regras.ROTULOS_ESCALA`; a
ajuda de cada pergunta repete o sentido da pergunta do BRFSS (docs/dicionario-de-dados-diabetes.md),
para a pessoa responder o mesmo que a pesquisa perguntou. A faixa observada do IMC na ajuda vem de
`regras.FAIXAS_TREINO`, nunca de um número escrito aqui.
"""

from __future__ import annotations

from fastapi import APIRouter, Depends, Request, Response

from app.diabetes.api.dependencias import obter_artefato_diabetes
from app.diabetes.dominio.regras import FAIXAS_TREINO, ROTULOS_ENTRADAS, ROTULOS_ESCALA
from app.diabetes.dominio.relatorio import FRASE_DADOS_REAIS
from app.diabetes.esquemas.entrada import IMC_MAXIMO, IMC_MINIMO, EntradaDiabetes
from app.diabetes.esquemas.saida import GrupoFormularioDiabetes, MetadadosFormularioDiabetes
from app.diabetes.nucleo.artefato import ArtefatoDiabetes
from app.esquemas.saida import CampoFormulario, OpcaoCampo
from app.nucleo.respostas import resposta_cacheavel

roteador = APIRouter(tags=["diabetes"])

AVISO_REGISTRO_ANONIMO = (
    FRASE_DADOS_REAIS
    + " As entradas são registradas de forma anônima para monitoramento do modelo."
)

_SIM_NAO = [OpcaoCampo(rotulo="Sim", valor="Sim"), OpcaoCampo(rotulo="Não", valor="Não")]
_IMC_MIN_BASE, _IMC_MAX_BASE = FAIXAS_TREINO["IMC"]


def _selecao(
    nome: str, opcoes: list[OpcaoCampo], padrao: str | int, ajuda: str | None = None
) -> CampoFormulario:
    return CampoFormulario(
        nome=nome,
        rotulo=ROTULOS_ENTRADAS[nome],
        tipo="selecao",
        opcoes=opcoes,
        padrao=padrao,
        ajuda=ajuda,
    )


def _escala(nome: str, padrao: int, ajuda: str | None = None) -> CampoFormulario:
    opcoes = [OpcaoCampo(rotulo=r, valor=v) for v, r in ROTULOS_ESCALA[nome].items()]
    return _selecao(nome, opcoes, padrao, ajuda)


GRUPOS: list[GrupoFormularioDiabetes] = [
    GrupoFormularioDiabetes(
        id="dados-iniciais",
        titulo="Dados iniciais",
        campos=[
            _escala("Faixa_Etaria", 5),
            _selecao(
                "Sexo",
                [
                    OpcaoCampo(rotulo="Feminino", valor="Feminino"),
                    OpcaoCampo(rotulo="Masculino", valor="Masculino"),
                ],
                "Feminino",
                "Como a pesquisa registrou o sexo de quem respondeu.",
            ),
            CampoFormulario(
                nome="IMC",
                rotulo=ROTULOS_ENTRADAS["IMC"],
                tipo="numero",
                minimo=IMC_MINIMO,
                maximo=IMC_MAXIMO,
                passo=0.1,
                padrao=25.0,
                ajuda=(
                    "Peso (kg) dividido pela altura (m) ao quadrado. A base viu IMC de "
                    f"{_IMC_MIN_BASE:.0f} a {_IMC_MAX_BASE:.0f}; fora disso a resposta avisa. O "
                    "modelo arredonda ao inteiro, como a pesquisa arredondou."
                ),
            ),
            _escala("Escolaridade", 4, "A maior série ou o maior curso que você concluiu."),
        ],
    ),
    GrupoFormularioDiabetes(
        id="saude",
        titulo="Diagnósticos que você já recebeu",
        campos=[
            _selecao(
                "Pressao_Alta",
                _SIM_NAO,
                "Não",
                "Algum médico, enfermeiro ou outro profissional de saúde já disse que você tem "
                "pressão alta? Só na gravidez, ou limítrofe, conta como não.",
            ),
            _selecao(
                "Colesterol_Alto",
                _SIM_NAO,
                "Não",
                "Algum profissional de saúde já disse que o seu colesterol está alto?",
            ),
        ],
    ),
    GrupoFormularioDiabetes(
        id="habitos",
        titulo="Como são seus hábitos?",
        campos=[
            _selecao(
                "Fumou_100_Cigarros",
                _SIM_NAO,
                "Não",
                "Pelo menos 100 cigarros (5 maços) na vida inteira, mesmo que não fume hoje.",
            ),
            _selecao(
                "Atividade_Fisica_30_Dias",
                _SIM_NAO,
                "Sim",
                "Algum exercício ou atividade física nos últimos 30 dias, fora do trabalho.",
            ),
            _selecao("Fruta_Diaria", _SIM_NAO, "Sim", "Fruta uma vez ou mais por dia."),
            _selecao(
                "Verdura_Diaria", _SIM_NAO, "Sim", "Verduras ou legumes uma vez ou mais por dia."
            ),
        ],
    ),
]


def nomes_do_formulario() -> set[str]:
    """Os `nome` de todos os campos — o contrato exige 100% dos alias de EntradaDiabetes."""
    return {campo.nome for grupo in GRUPOS for campo in grupo.campos}


assert nomes_do_formulario() == {f.alias for f in EntradaDiabetes.model_fields.values() if f.alias}


@roteador.get(
    "/metadata",
    response_model=MetadadosFormularioDiabetes,
    summary="Formulário da triagem de diabetes: grupos, campos, tipos, faixas, opções e padrões",
)
def metadata_diabetes(
    request: Request, artefato: ArtefatoDiabetes = Depends(obter_artefato_diabetes)
) -> Response:
    """O front monta o formulário a partir daqui; nenhuma regra de formulário mora no JSX."""
    corpo = MetadadosFormularioDiabetes(
        grupos=GRUPOS, versao_modelo=artefato.versao, aviso=AVISO_REGISTRO_ANONIMO
    )
    return resposta_cacheavel(request, corpo.model_dump(), max_age=3600)
