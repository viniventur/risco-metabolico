"""Contratos de saída da vertente diabetes: a triagem, o lote, o formulário e o modelo servido.

`CampoFormulario`, `OpcaoCampo` e `FalhaLote` vêm de `app.esquemas.saida` por import, sem edição:
são genéricos, e o mesmo componente no OpenAPI deixa o front montar os dois formulários com a mesma
lógica. O resto é próprio da vertente e leva o sufixo `Diabetes` no nome do componente.
"""

from __future__ import annotations

from typing import Any, Literal

from pydantic import BaseModel, Field

from app.esquemas.saida import CampoFormulario, FalhaLote

Classificacao = Literal["Risco elevado", "Risco baixo"]


class RespostaDiabetes(BaseModel):
    """Contrato de saída da triagem de diabetes: probabilidade, limiar, classificação e IMC."""

    probabilidade: float = Field(
        ge=0.0,
        le=1.0,
        description=(
            "Probabilidade estimada de a pessoa já ter ouvido de um profissional de saúde que tem "
            "diabetes, na escala da base (respondentes do BRFSS 2015): não é a prevalência na "
            "população"
        ),
    )
    limiar: float = Field(
        ge=0.0,
        le=1.0,
        description="Limiar de triagem do modelo servido; critério e valor em /diabetes/model/info",
    )
    risco_elevado: bool = Field(
        description="probabilidade >= limiar: a triagem sugere o exame de glicemia"
    )
    classificacao: Classificacao
    imc: float
    faixa_imc: str
    fora_do_dominio_treino: list[str] = Field(
        default_factory=list,
        description="Campos cujo valor, como o modelo o vê, está fora da faixa observada na base",
    )
    versao_modelo: str
    latencia_ms: float


class RespostaLoteDiabetes(BaseModel):
    """`POST /diabetes/predicoes/lote`: um item inválido volta em `falhas`; os outros seguem."""

    total: int
    sucesso: int
    resultados: list[RespostaDiabetes]
    falhas: list[FalhaLote]
    versao_modelo: str


class GrupoFormularioDiabetes(BaseModel):
    """Os três agrupamentos do formulário: dados iniciais, diagnósticos recebidos e hábitos."""

    id: Literal["dados-iniciais", "saude", "habitos"]
    titulo: str
    campos: list[CampoFormulario]


class MetadadosFormularioDiabetes(BaseModel):
    """`GET /diabetes/metadata`: a espinha do formulário — o front monta os campos daqui."""

    grupos: list[GrupoFormularioDiabetes]
    versao_modelo: str
    aviso: str


class PontoDeOperacaoDiabetes(BaseModel):
    """Recall, precisão, especificidade e fração encaminhada num limiar."""

    recall: float
    precisao: float
    especificidade: float
    encaminhados: float


class LimiarDiabetes(BaseModel):
    """O limiar de triagem: critério escrito, alvo de recall, valor e o ponto fora da dobra."""

    criterio: str
    recall_alvo: float
    valor: float
    fora_da_dobra: PontoDeOperacaoDiabetes


class ValidacaoCruzadaDiabetes(BaseModel):
    """As 5 dobras estratificadas do treino: média e desvio-padrão entre dobras."""

    n_splits: int
    shuffle: bool
    random_state: int
    roc_auc: float
    roc_auc_dp: float
    pr_auc: float
    pr_auc_dp: float
    brier: float


class MetricasTesteDiabetes(BaseModel):
    """A avaliação final, uma vez, no teste — do manifest, nunca escrita à mão."""

    roc_auc: float
    pr_auc: float
    brier: float
    brier_da_prevalencia: float
    precisao_fixa: float
    recall_na_precisao_fixa: float
    recall_no_limiar: float
    precisao_no_limiar: float
    especificidade_no_limiar: float
    encaminhados_no_limiar: float


class InfoModeloDiabetes(BaseModel):
    """`GET /diabetes/model/info`: o manifest da vertente normalizado — as métricas publicadas."""

    nome: str
    vertente: Literal["diabetes"]
    versao: str
    release: str
    algoritmo: str
    treinado_em: str
    versao_dados: str
    sha256: str
    entradas: list[str] = Field(description="As dez entradas, na ordem de feature_names_in_")
    n_features_entrada: int
    n_features_modelo: int
    hiperparametros: dict[str, Any]
    desbalanceamento: str
    calibracao: str
    split: dict[str, Any]
    validacao_cruzada: ValidacaoCruzadaDiabetes
    limiar: LimiarDiabetes
    metricas_teste: MetricasTesteDiabetes
    ambiente: dict[str, Any]
    notebook_origem: str
    aviso: str
