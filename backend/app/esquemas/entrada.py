"""Contrato de entrada: os 16 campos que o pipeline espera, com o domínio fechado de cada um (§6.3).

As chaves do JSON são os nomes de coluna do pipeline (contrato do modelo); os atributos Python
seguem `snake_case` (contrato do estilo do projeto). `extra="forbid"`: um campo com erro de
digitação vira 422 em vez de virar silêncio — o legado, com `values.get(...)` e
`handle_unknown='ignore'`, engolia tudo.
"""

from __future__ import annotations

from enum import StrEnum
from typing import Annotated, Any

from pydantic import BaseModel, ConfigDict, Field


class Genero(StrEnum):
    """Sexo biológico, como no dicionário de dados."""

    FEMININO = "Feminino"
    MASCULINO = "Masculino"


class SimNao(StrEnum):
    """Binárias: histórico familiar, calórico frequente, fumante, monitoramento."""

    SIM = "Sim"
    NAO = "Não"


class Frequencia(StrEnum):
    """Lanches entre refeições e álcool: os quatro níveis do dicionário."""

    NAO = "Não"
    AS_VEZES = "Às vezes"
    FREQUENTEMENTE = "Frequentemente"
    SEMPRE = "Sempre"


class MeioTransporte(StrEnum):
    """Domínio corrigido: o formulário legado enviava "Automóvel" e "Motocicleta", valores que não existem nas `categories_` do encoder (divergência 4)."""  # noqa: E501

    TRANSPORTE_PUBLICO = "Transporte Público"
    CARRO = "Carro"
    MOTO = "Moto"
    BICICLETA = "Bicicleta"
    CAMINHADA = "Caminhada"


# Escalas ordinais: inteiros, exatamente como o encoder foi treinado (ADR 0002).
Vegetais = Annotated[int, Field(ge=1, le=3, description="1 raramente, 2 às vezes, 3 sempre")]
Refeicoes = Annotated[
    int, Field(ge=1, le=4, description="Refeições principais por dia (4 = 4 ou mais)")
]
Agua = Annotated[int, Field(ge=1, le=3, description="1 <1L, 2 1-2L, 3 >2L por dia")]
Atividade = Annotated[
    int, Field(ge=0, le=3, description="0 nenhuma, 1 1-2x, 2 3-4x, 3 5+x por semana")
]
Telas = Annotated[int, Field(ge=0, le=2, description="0 0-2h, 1 3-5h, 2 >5h por dia")]

EXEMPLO_ENTRADA: dict[str, Any] = {
    "Genero": "Feminino",
    "Idade": 25,
    "Altura": 1.70,
    "Peso": 70.0,
    "Historico_Familiar_Sobrepeso": "Sim",
    "Consumo_Calorico_Frequente": "Sim",
    "Consumo_Vegetais": 2,
    "Numero_Refeicoes_Principais": 3,
    "Consumo_Alimentos_Entre_Refeicoes": "Às vezes",
    "Fumante": "Não",
    "Consumo_Agua_Diario": 2,
    "Monitoramento_Calorias": "Não",
    "Atividade_Fisica_Frequencia": 1,
    "Tempo_Dispositivos_Tecnologicos": 0,
    "Consumo_Alcool": "Não",
    "Meio_Transporte": "Transporte Público",
}


class EntradaTriagem(BaseModel):
    """Os 16 campos que o pipeline espera, com o domínio fechado de cada um."""

    model_config = ConfigDict(
        extra="forbid",
        populate_by_name=True,
        str_strip_whitespace=True,
        json_schema_extra={"example": EXEMPLO_ENTRADA},
    )

    genero: Genero = Field(alias="Genero")
    idade: Annotated[float, Field(ge=14.0, le=61.0)] = Field(alias="Idade")
    # As faixas da UI são mais largas que as do treino (1,45–1,98; 39–173): a API aceita e devolve
    # o que extrapolou em `fora_do_dominio_treino` (§6.3).
    altura: Annotated[float, Field(ge=1.40, le=2.00)] = Field(alias="Altura")
    peso: Annotated[float, Field(ge=39.0, le=175.0)] = Field(alias="Peso")
    historico_familiar_sobrepeso: SimNao = Field(alias="Historico_Familiar_Sobrepeso")
    consumo_calorico_frequente: SimNao = Field(alias="Consumo_Calorico_Frequente")
    consumo_vegetais: Vegetais = Field(alias="Consumo_Vegetais")
    numero_refeicoes_principais: Refeicoes = Field(alias="Numero_Refeicoes_Principais")
    consumo_alimentos_entre_refeicoes: Frequencia = Field(alias="Consumo_Alimentos_Entre_Refeicoes")
    fumante: SimNao = Field(alias="Fumante")
    consumo_agua_diario: Agua = Field(alias="Consumo_Agua_Diario")
    monitoramento_calorias: SimNao = Field(alias="Monitoramento_Calorias")
    atividade_fisica_frequencia: Atividade = Field(alias="Atividade_Fisica_Frequencia")
    tempo_dispositivos_tecnologicos: Telas = Field(alias="Tempo_Dispositivos_Tecnologicos")
    consumo_alcool: Frequencia = Field(alias="Consumo_Alcool")
    meio_transporte: MeioTransporte = Field(alias="Meio_Transporte")

    def valores_do_modelo(self) -> dict[str, Any]:
        """O dicionário pelas CHAVES DO MODELO (alias), com enums já como texto."""
        return {
            k: (v.value if isinstance(v, StrEnum) else v)
            for k, v in self.model_dump(by_alias=True).items()
        }


class LoteTriagem(BaseModel):
    """Corpo de `POST /predicoes/lote`."""

    model_config = ConfigDict(extra="forbid")
    # SEM max_length: com ele o Pydantic devolveria 422 antes de a rota rodar e o caminho do 413
    # prometido em §6.2 seria código morto. O limite é único e vive em CONFIG.limite_lote.
    # `list[dict]` de propósito: com `list[EntradaTriagem]` o Pydantic reprovaria o lote inteiro
    # no primeiro item malformado e a lista `falhas` seria inalcançável (§6.4).
    itens: list[dict[str, Any]] = Field(min_length=1)


class EntradaRelatorio(BaseModel):
    """Corpo de `POST /predicoes/relatorio`: a entrada mais o nome opcional (só metadado)."""

    model_config = ConfigDict(extra="forbid")
    entrada: EntradaTriagem
    nome: str = Field(default="", max_length=120)
