"""Domínio fechado (§10.4): os dois bugs do legado viram teste."""

from __future__ import annotations

import pytest

from tests.conftest import ENTRADA_PADRAO

URL = "/api/v1/predicoes"


@pytest.mark.parametrize("valor", ["Automóvel", "Motocicleta", "Uber", ""])
def test_transporte_fora_do_dominio_e_recusado(cliente, valor: str) -> None:
    """O formulário legado enviava 'Automóvel'/'Motocicleta', fora das categories_ do encoder."""
    resposta = cliente.post(URL, json=ENTRADA_PADRAO | {"Meio_Transporte": valor})
    assert resposta.status_code == 422
    corpo = resposta.json()
    assert corpo["erro"] == "entrada_invalida"
    assert corpo["detalhes"][0]["campo"] == "Meio_Transporte"


def test_campo_desconhecido_e_recusado(cliente) -> None:
    """extra='forbid': um typo vira 422, não vira silêncio."""
    resposta = cliente.post(URL, json=ENTRADA_PADRAO | {"IMC": 27.3})
    assert resposta.status_code == 422
    assert resposta.json()["detalhes"][0]["campo"] == "IMC"


@pytest.mark.parametrize(
    ("campo", "valor"),
    [
        ("Idade", 13),
        ("Idade", 62),
        ("Altura", 1.39),
        ("Altura", 2.01),
        ("Peso", 38.9),
        ("Peso", 175.1),
    ],
)
def test_faixas_numericas_da_ui_sao_o_limite(cliente, campo: str, valor: float) -> None:
    resposta = cliente.post(URL, json=ENTRADA_PADRAO | {campo: valor})
    assert resposta.status_code == 422
    assert resposta.json()["detalhes"][0]["campo"] == campo


@pytest.mark.parametrize(
    ("campo", "valor"),
    [("Consumo_Vegetais", 4), ("Consumo_Vegetais", 0), ("Atividade_Fisica_Frequencia", 4)],
)
def test_escalas_fora_da_faixa_sao_recusadas(cliente, campo: str, valor: int) -> None:
    assert cliente.post(URL, json=ENTRADA_PADRAO | {campo: valor}).status_code == 422


def test_escala_como_string_de_faixa_e_recusada(cliente) -> None:
    """A divergência 3 do legado: strings de binning no lugar dos inteiros. Aqui é 422."""
    resposta = cliente.post(URL, json=ENTRADA_PADRAO | {"Consumo_Vegetais": "moderada"})
    assert resposta.status_code == 422
    assert resposta.json()["detalhes"][0]["campo"] == "Consumo_Vegetais"


@pytest.mark.parametrize("valor", ["Não", "Às vezes", "Frequentemente", "Sempre"])
def test_toda_frequencia_de_alcool_e_aceita(cliente, valor: str) -> None:
    """Inclusive 'Sempre', que tem 1 ocorrência na base: categories= explícito (ADR 0002)."""
    assert cliente.post(URL, json=ENTRADA_PADRAO | {"Consumo_Alcool": valor}).status_code == 200


@pytest.mark.parametrize("valor", ["Transporte Público", "Carro", "Moto", "Bicicleta", "Caminhada"])
def test_todo_transporte_do_dominio_e_aceito(cliente, valor: str) -> None:
    assert cliente.post(URL, json=ENTRADA_PADRAO | {"Meio_Transporte": valor}).status_code == 200


def test_extrapolacao_da_faixa_de_treino_e_declarada(cliente) -> None:
    """A UI aceita 1,40–2,00 m e até 175 kg; o treino viu 1,45–1,98 e 173. A API avisa."""
    resposta = cliente.post(URL, json=ENTRADA_PADRAO | {"Altura": 1.40, "Peso": 175.0})
    assert resposta.status_code == 200
    assert set(resposta.json()["fora_do_dominio_treino"]) == {"Altura", "Peso"}
    assert cliente.post(URL, json=ENTRADA_PADRAO).json()["fora_do_dominio_treino"] == []
