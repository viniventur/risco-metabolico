"""Contrato de entrada da vertente diabetes: as dez respostas do modelo, com o domínio de cada uma.

As chaves do JSON são os nomes de coluna do modelo (ENTRADAS, em app/diabetes/dominio/features.py);
os atributos Python seguem `snake_case`. `extra="forbid"`: um campo com erro de digitação — ou um
campo da vertente de obesidade, como `Peso` — vira 422 nomeando o campo, nunca silêncio. Os
domínios fechados são `Literal`, e não os enums de `app.esquemas.entrada`: os valores coincidem
("Sim", "Não", "Feminino"), mas as duas vertentes não dividem componente no OpenAPI. A conferência
contra `regras.DOMINIOS` é de teste: este pacote não importa o domínio (nem pandas).
"""

from __future__ import annotations

from typing import Annotated, Any, Literal

from pydantic import BaseModel, ConfigDict, Field

SimNao = Literal["Não", "Sim"]
Sexo = Literal["Feminino", "Masculino"]
# As escalas do BRFSS: inteiros, exatamente como o modelo foi treinado (os rótulos estão em
# /diabetes/metadata e em regras.ROTULOS_ESCALA).
FaixaEtaria = Annotated[
    int, Field(ge=1, le=13, description="Faixa de 5 anos: 1 = 18 a 24 anos … 13 = 80 ou mais")
]
Escolaridade = Annotated[
    int, Field(ge=1, le=6, description="Maior série concluída: 1 = nunca estudou … 6 = superior")
]
# A faixa ACEITA é mais larga que a da base (regras.FAIXAS_TREINO): o que fica fora da base volta
# em `fora_do_dominio_treino`, como na vertente de obesidade.
IMC_MINIMO = 10.0
IMC_MAXIMO = 100.0

EXEMPLO_ENTRADA: dict[str, Any] = {
    "Faixa_Etaria": 5,
    "Sexo": "Feminino",
    "IMC": 25.0,
    "Pressao_Alta": "Não",
    "Colesterol_Alto": "Não",
    "Fumou_100_Cigarros": "Não",
    "Atividade_Fisica_30_Dias": "Sim",
    "Fruta_Diaria": "Sim",
    "Verdura_Diaria": "Sim",
    "Escolaridade": 4,
}


class EntradaDiabetes(BaseModel):
    """As dez respostas que o pipeline da vertente espera, com o domínio fechado de cada uma."""

    model_config = ConfigDict(
        extra="forbid",
        populate_by_name=True,
        str_strip_whitespace=True,
        json_schema_extra={"example": EXEMPLO_ENTRADA},
    )

    faixa_etaria: FaixaEtaria = Field(alias="Faixa_Etaria")
    sexo: Sexo = Field(alias="Sexo")
    imc: Annotated[float, Field(ge=IMC_MINIMO, le=IMC_MAXIMO)] = Field(
        alias="IMC", description="kg/m²; o modelo o arredonda ao inteiro, como a pesquisa"
    )
    pressao_alta: SimNao = Field(alias="Pressao_Alta")
    colesterol_alto: SimNao = Field(alias="Colesterol_Alto")
    fumou_100_cigarros: SimNao = Field(alias="Fumou_100_Cigarros")
    atividade_fisica_30_dias: SimNao = Field(alias="Atividade_Fisica_30_Dias")
    fruta_diaria: SimNao = Field(alias="Fruta_Diaria")
    verdura_diaria: SimNao = Field(alias="Verdura_Diaria")
    escolaridade: Escolaridade = Field(alias="Escolaridade")

    def valores_do_modelo(self) -> dict[str, Any]:
        """O dicionário pelas CHAVES DO MODELO (alias), na ordem das ENTRADAS."""
        return self.model_dump(by_alias=True)


class LoteDiabetes(BaseModel):
    """Corpo de `POST /diabetes/predicoes/lote`."""

    model_config = ConfigDict(extra="forbid")
    # SEM max_length e `list[dict]`, pelas mesmas razões de `app.esquemas.entrada.LoteTriagem`: o
    # limite é único (CONFIG.limite_lote, 413) e um item malformado não pode reprovar o lote.
    itens: list[dict[str, Any]] = Field(min_length=1)


class EntradaRelatorioDiabetes(BaseModel):
    """Corpo de `POST /diabetes/predicoes/relatorio`: a entrada e o nome opcional (só metadado)."""

    model_config = ConfigDict(extra="forbid")
    entrada: EntradaDiabetes
    nome: str = Field(default="", max_length=120)
