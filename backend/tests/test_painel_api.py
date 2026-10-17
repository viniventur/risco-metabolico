"""`/dimensoes`, `/painel/*`, `/registros*`: servidos de memória, com filtros na URL e ETag."""

from __future__ import annotations

import csv
import io

import pytest

from app.dominio.regras import ORDEM_CLINICA

URL = "/api/v1"


@pytest.fixture(autouse=True)
def _exige_base(cliente) -> None:
    if cliente.app.state.agregados is None:
        pytest.skip("base_painel.parquet ausente: rode python -m app.treino congelar")


def test_ready_200_com_artefato_e_agregados(cliente) -> None:
    resposta = cliente.get(f"{URL}/ready")
    assert resposta.status_code == 200
    assert resposta.json() == {
        "pronto": True,
        "artefato_carregado": True,
        "agregados_carregados": True,
        "motivo": None,
    }


def test_dimensoes_tem_as_seis_com_rotulo_e_contagem(cliente) -> None:
    corpo = cliente.get(f"{URL}/dimensoes").json()
    assert set(corpo) == {"nivel", "genero", "agua", "alcool", "caloricos", "historico_familiar"}
    assert [o["valor"] for o in corpo["nivel"]] == list(ORDEM_CLINICA)
    assert [o["rotulo"] for o in corpo["agua"]] == ["<1L", "1-2L", ">2L"]
    assert sum(o["n"] for o in corpo["genero"]) == 2111


def test_resumo_sem_filtro_e_com_filtro(cliente) -> None:
    tudo = cliente.get(f"{URL}/painel/resumo").json()
    assert tudo["total_registros"] == tudo["total_global"] == 2111
    assert tudo["nivel_predominante"] == "Obesidade I" and tudo["n_predominante"] == 351
    assert tudo["recorte"] == {}
    fem = cliente.get(f"{URL}/painel/resumo?genero=Feminino").json()
    assert fem["total_registros"] == 1043 and fem["recorte"] == {"genero": ["Feminino"]}
    dois = cliente.get(f"{URL}/painel/resumo?nivel=Obesidade%20I&nivel=Obesidade%20II").json()
    assert dois["total_registros"] == 351 + 297


def test_filtro_fora_do_dominio_e_422(cliente) -> None:
    resposta = cliente.get(f"{URL}/painel/resumo?genero=Outro")
    assert resposta.status_code == 422
    assert resposta.json()["detalhes"][0]["campo"] == "genero"
    assert cliente.get(f"{URL}/painel/resumo?agua=x").status_code == 422


def test_por_categoria_contagem_tem_dominio_completo(cliente) -> None:
    doc = cliente.get(
        f"{URL}/painel/por-categoria?campo=nivel&metrica=contagem&genero=Feminino"
    ).json()
    niveis = [ln["nivel"] for ln in doc["linhas"] if ln["medida"] == "contagem"]
    assert niveis == list(ORDEM_CLINICA)
    assert doc["total_filtrado"] == 1043
    assert sum(ln["valor"] for ln in doc["linhas"] if ln["medida"] == "pct") == pytest.approx(
        100.0, abs=1e-9
    )


def test_por_categoria_imc_com_serie_e_supressao(cliente) -> None:
    doc = cliente.get(
        f"{URL}/painel/por-categoria?campo=atividade&metrica=imc_medio&serie=genero"
    ).json()
    assert doc["dimensoes"] == [
        {"nome": "atividade", "tipo": "inteiro"},
        {"nome": "genero", "tipo": "texto"},
    ]
    assert len(doc["linhas"]) == 8
    assert all(isinstance(ln["atividade"], str) for ln in doc["linhas"])  # dimensão é sempre string
    alcool = cliente.get(f"{URL}/painel/por-categoria?campo=alcool&metrica=imc_medio").json()
    sempre = next(ln for ln in alcool["linhas"] if ln["alcool"] == "Sempre")
    assert sempre["suprimido"] is True and sempre["valor"] is None and sempre["n"] == 1


def test_por_categoria_invalido_e_422(cliente) -> None:
    assert cliente.get(f"{URL}/painel/por-categoria?campo=idade").status_code == 422
    assert cliente.get(f"{URL}/painel/por-categoria?campo=nivel&metrica=soma").status_code == 422
    assert cliente.get(f"{URL}/painel/por-categoria?campo=nivel&serie=nivel").status_code == 422


def test_genero_e_pontos(cliente) -> None:
    generos = cliente.get(f"{URL}/painel/genero").json()
    assert [g["genero"] for g in generos] == ["Feminino", "Masculino"]
    assert sum(g["n"] for g in generos) == 2111
    assert sum(g["percentual"] for g in generos) == pytest.approx(100.0, abs=1e-9)
    pontos = cliente.get(f"{URL}/painel/pontos?amostra=100").json()
    assert len(pontos) == 100 and set(pontos[0]) == {"altura", "peso", "imc", "nivel"}
    assert len(cliente.get(f"{URL}/painel/pontos?amostra=2500").json()) == 2111
    assert cliente.get(f"{URL}/painel/pontos?amostra=3000").status_code == 422


def test_etag_e_304_nos_agregados(cliente) -> None:
    primeira = cliente.get(f"{URL}/painel/resumo")
    etag = primeira.headers["etag"]
    assert cliente.get(f"{URL}/painel/resumo", headers={"If-None-Match": etag}).status_code == 304
    assert cliente.get(f"{URL}/painel/resumo?genero=Feminino").headers["etag"] != etag


def test_registros_paginacao_e_ordenacao(cliente) -> None:
    pagina = cliente.get(f"{URL}/registros?tamanho=5").json()
    assert pagina["total"] == 2111 and pagina["pagina"] == 1 and len(pagina["linhas"]) == 5
    assert len(pagina["linhas"][0]) == 19  # 18 colunas + id
    imcs = [ln["IMC"] for ln in pagina["linhas"]]
    assert imcs == sorted(imcs, reverse=True)  # ordem inicial por IMC desc
    asc = cliente.get(f"{URL}/registros?tamanho=5&ordenar_por=Idade&direcao=asc").json()
    assert [ln["Idade"] for ln in asc["linhas"]] == sorted(ln["Idade"] for ln in asc["linhas"])
    ultima = cliente.get(f"{URL}/registros?tamanho=200&pagina=11").json()
    assert len(ultima["linhas"]) == 2111 - 200 * 10
    assert cliente.get(f"{URL}/registros?ordenar_por=senha").status_code == 422
    assert cliente.get(f"{URL}/registros?tamanho=201").status_code == 422


def test_exportar_csv_do_recorte(cliente) -> None:
    resposta = cliente.get(f"{URL}/registros/exportar?caloricos=Não")
    assert resposta.status_code == 200
    assert resposta.headers["content-type"].startswith("text/csv")
    assert "attachment" in resposta.headers["content-disposition"]
    linhas = list(csv.reader(io.StringIO(resposta.text)))
    assert len(linhas[0]) == 18 and len(linhas) - 1 == 245
