"""Contratos de saída: resposta da triagem, lote e a especificação do formulário (§6.3)."""

from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, ConfigDict, Field


class ProbabilidadeClasse(BaseModel):
    """Uma das 7 classes com a sua probabilidade e a marcação de risco."""

    classe: str
    probabilidade: float = Field(ge=0.0, le=1.0)
    de_risco: bool


class RespostaTriagem(BaseModel):
    """Contrato de saída da triagem: classe, distribuição completa e risco acumulado."""

    classe_prevista: str
    risco_acumulado: float = Field(ge=0.0, le=1.0, description="Soma das 5 classes de risco")
    probabilidades: list[ProbabilidadeClasse] = Field(
        min_length=7,
        max_length=7,
        description="Sempre as 7 classes, em ordem clínica crescente (não alfabética)",
    )
    imc: float
    faixa_imc: str
    fora_do_dominio_treino: list[str] = Field(
        default_factory=list,
        description="Campos cujo valor está fora da faixa observada no treino",
    )
    versao_modelo: str
    latencia_ms: float


class FalhaLote(BaseModel):
    """Um item recusado dentro de um lote, com o índice de origem preservado."""

    indice: int
    campo: str | None = None  # opcional: nem toda falha aponta um campo
    mensagem: str


class RespostaLote(BaseModel):
    """`POST /predicoes/lote`: um item inválido volta em `falhas`; os outros são processados."""

    total: int
    sucesso: int
    resultados: list[RespostaTriagem]
    falhas: list[FalhaLote]
    versao_modelo: str


class OpcaoCampo(BaseModel):
    """Uma opção de campo de seleção: o rótulo da tela e o valor que vai no JSON."""

    rotulo: str
    valor: str | int


class CampoFormulario(BaseModel):
    """Um campo do formulário de triagem; `nome` é a CHAVE do JSON de `EntradaTriagem`."""

    model_config = ConfigDict(extra="forbid")

    nome: str
    rotulo: str
    tipo: Literal["numero", "selecao"]
    minimo: float | None = None
    maximo: float | None = None
    passo: float | None = None
    opcoes: list[OpcaoCampo] = Field(default_factory=list)
    padrao: str | int | float | None = None
    ajuda: str | None = None


class GrupoFormulario(BaseModel):
    """Os três agrupamentos do legado: dados iniciais, dieta, hábitos."""

    id: Literal["dados-iniciais", "dieta", "habitos"]
    titulo: str
    campos: list[CampoFormulario]


class MetadadosFormulario(BaseModel):
    """`GET /metadata`: a espinha do formulário — o React monta os campos a partir daqui."""

    grupos: list[GrupoFormulario]
    versao_modelo: str
    aviso: str
