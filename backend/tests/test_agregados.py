"""Materializador (§6.7): cabeçalho `@`, as 7 invariantes do contrato e a base do painel."""

from __future__ import annotations

from pathlib import Path
from typing import Any

import pandas as pd
import pytest

from app.dominio.regras import ROTULOS_ESCALA
from app.treino import agregar

CABECALHO = """-- @id:              por-nivel
-- @titulo:          Distribuicao dos registros pelas 7 faixas
-- @mede:            Quantos registros a base tem em cada faixa,
--                   e quanto isso representa do total.
-- @origem:          docs/agregados.md
-- @fonte:           dados.registros_triagem
-- @dimensao:        nivel:texto
-- @medida:          contagem:contagem
-- @medida:          pct:proporcao
-- @amostra_minima:  -
-- @divergencia:     -

SELECT 1;
"""


def _cab(
    tmp_path: Path, texto: str = CABECALHO, nome: str = "por-nivel.sql", tipo: str = "agregado"
):
    arquivo = tmp_path / nome
    arquivo.write_text(texto, encoding="utf-8")
    return agregar.ler_cabecalho(arquivo, tipo)


def _linha(
    ordem: int, nivel: str, medida: str, valor: float | None, n: int, **extra: Any
) -> dict[str, Any]:
    base = {
        "agregado_id": "por-nivel",
        "ordem": ordem,
        "dim1_nome": "nivel",
        "dim1_valor": nivel,
        "dim2_nome": None,
        "dim2_valor": None,
        "medida": medida,
        "valor": valor,
        "valor_texto": None,
        "n": n,
        "suprimido": False,
    }
    base.update(extra)
    return base


def _linhas_ok() -> list[dict[str, Any]]:
    return [
        _linha(1, "Abaixo do Peso", "contagem", 272.0, 272),
        _linha(2, "Abaixo do Peso", "pct", 12.88, 272),
        _linha(3, "Peso Normal", "contagem", 287.0, 287),
        _linha(4, "Peso Normal", "pct", 13.6, 287),
    ]


def test_cabecalho_e_parseado_com_continuacao(tmp_path: Path) -> None:
    cab = _cab(tmp_path)
    assert cab.id == "por-nivel" and cab.tipo == "agregado"
    assert cab.mede.startswith("Quantos registros") and cab.mede.endswith("do total.")
    assert cab.fonte == ["dados.registros_triagem"]
    assert cab.dimensoes == [("nivel", "texto")]
    assert cab.medidas == [("contagem", "contagem"), ("pct", "proporcao")]
    assert cab.amostra_minima is None and cab.divergencia is None
    assert "SELECT 1;" in cab.sql


def test_id_diferente_do_nome_do_arquivo_e_recusado(tmp_path: Path) -> None:
    with pytest.raises(agregar.ContratoViolado, match="@id"):
        _cab(tmp_path, nome="outro-nome.sql")


def test_pontos_exige_prefixo_no_id(tmp_path: Path) -> None:
    texto = CABECALHO.replace("@id:              por-nivel", "@id:              pontos-altura-peso")
    cab = _cab(tmp_path, texto, nome="altura-peso.sql", tipo="pontos")
    assert cab.id == "pontos-altura-peso"


def test_classe_de_medida_e_tipo_de_dimensao_fechados(tmp_path: Path) -> None:
    with pytest.raises(agregar.ContratoViolado, match="classe de medida"):
        _cab(tmp_path, CABECALHO.replace("pct:proporcao", "pct:correlacao"))
    with pytest.raises(agregar.ContratoViolado, match="dimensão"):
        _cab(tmp_path, CABECALHO.replace("nivel:texto", "nivel:data"))
    with pytest.raises(agregar.ContratoViolado, match="desconhecida"):
        _cab(tmp_path, CABECALHO.replace("@divergencia", "@qualquer"))


def test_linhas_validas_passam(tmp_path: Path) -> None:
    agregar._validar_agregado(_cab(tmp_path), _linhas_ok(), agregar.COLUNAS_CONTRATO)


@pytest.mark.parametrize(
    ("mutacao", "trecho"),
    [
        (lambda ls: ls[0].update(agregado_id="outro"), "invariante 1"),
        (lambda ls: ls[0].update(dim1_valor=None), "invariante 2"),
        (lambda ls: ls[0].update(dim2_nome="x", dim2_valor="y"), "não declarada"),
        (lambda ls: ls[0].update(medida="media"), "não declarada"),
        (lambda ls: ls[0].update(suprimido=True), "suprimida com valor"),
        (lambda ls: ls[0].update(valor_texto="dois"), "valor E valor_texto"),
        (lambda ls: ls[0].update(valor=None, n=5), "sem valor com n=5"),
        (lambda ls: ls[1].update(dim1_valor="Abaixo do Peso", medida="contagem"), "chave repetida"),
        (lambda ls: ls[2].update(ordem=5), "invariante 6"),
        (lambda ls: ls[0].update(valor=float("nan")), "NaN"),
    ],
)
def test_cada_invariante_e_vigiada(tmp_path: Path, mutacao, trecho: str) -> None:
    linhas = _linhas_ok()
    mutacao(linhas)
    with pytest.raises(agregar.ContratoViolado, match=trecho):
        agregar._validar_agregado(_cab(tmp_path), linhas, agregar.COLUNAS_CONTRATO)


def test_colunas_fora_do_contrato_sao_recusadas(tmp_path: Path) -> None:
    with pytest.raises(agregar.ContratoViolado, match="diferem do contrato"):
        agregar._validar_agregado(_cab(tmp_path), _linhas_ok(), ("a", "b"))


def test_grupo_vazio_legitimo_passa(tmp_path: Path) -> None:
    linhas = _linhas_ok()
    linhas[0].update(valor=None, n=0)
    agregar._validar_agregado(_cab(tmp_path), linhas, agregar.COLUNAS_CONTRATO)


def test_linha_json_achata_dimensoes_e_valor_e_string(tmp_path: Path) -> None:
    doc = agregar._linha_json(_cab(tmp_path), _linha(1, "Peso Normal", "pct", 13.6, 287))
    assert doc == {
        "ordem": 1,
        "nivel": "Peso Normal",
        "medida": "pct",
        "valor": 13.6,
        "n": 287,
        "suprimido": False,
    }


def test_validar_pontos(tmp_path: Path) -> None:
    texto = CABECALHO.replace("@id:              por-nivel", "@id:              pontos-altura-peso")
    cab = _cab(tmp_path, texto, nome="altura-peso.sql", tipo="pontos")
    boas = [{"altura": 1.6, "peso": 64.0, "imc": 64.0 / 1.6**2, "nivel": "Peso Normal"}]
    agregar._validar_pontos(cab, boas, agregar.COLUNAS_PONTOS, 1)
    with pytest.raises(agregar.ContratoViolado, match="esperado 2"):
        agregar._validar_pontos(cab, boas, agregar.COLUNAS_PONTOS, 2)
    ruim = [{"altura": 1.6, "peso": 64.0, "imc": 20.0, "nivel": "Peso Normal"}]
    with pytest.raises(agregar.ContratoViolado, match="não bate"):
        agregar._validar_pontos(cab, ruim, agregar.COLUNAS_PONTOS, 1)
    fora = [{"altura": 1.6, "peso": 64.0, "imc": 64.0 / 1.6**2, "nivel": "Magro"}]
    with pytest.raises(agregar.ContratoViolado, match="fora do domínio"):
        agregar._validar_pontos(cab, fora, agregar.COLUNAS_PONTOS, 1)


def test_derivar_base_painel(base_referencia: pd.DataFrame) -> None:
    base = agregar.derivar_base_painel(base_referencia, ROTULOS_ESCALA)
    assert list(base.columns[:1]) == ["linha_origem"]
    assert "IMC" in base.columns
    for col in ROTULOS_ESCALA:
        assert f"{col}_rotulo" in base.columns
        assert base[f"{col}_rotulo"].map(lambda r: isinstance(r, str)).all()
    assert (base["IMC"] == base["Peso"] / base["Altura"] ** 2).all()
    with pytest.raises(agregar.ContratoViolado, match="rótulo ausente"):
        agregar.derivar_base_painel(base_referencia, {})


@pytest.mark.banco
def test_materializar_ponta_a_ponta_contra_o_banco(
    tmp_path: Path, dsn: str, manifest: dict
) -> None:
    """Uma query real no contrato longo, materializada e validada: o que F8 repete 8 vezes."""
    import psycopg

    sql = CABECALHO.replace(
        "SELECT 1;",
        """WITH dominio AS (
    SELECT * FROM (VALUES ('Abaixo do Peso', 1), ('Peso Normal', 2), ('Sobrepeso I', 3),
                          ('Sobrepeso II', 4), ('Obesidade I', 5), ('Obesidade II', 6),
                          ('Obesidade III', 7)) AS d(nivel, ord)
), contagem AS (
    SELECT nivel_obesidade AS nivel, count(*) AS n
    FROM dados.registros_triagem GROUP BY nivel_obesidade
), completo AS (
    -- O total sai AQUI, por janela: window function nao e permitida dentro de VALUES.
    SELECT d.nivel, d.ord, coalesce(c.n, 0) AS n, sum(coalesce(c.n, 0)) OVER () AS total
    FROM dominio AS d LEFT JOIN contagem AS c ON c.nivel = d.nivel
)
SELECT 'por-nivel'::text AS agregado_id,
       (row_number() OVER (ORDER BY completo.ord, m.ordem_medida))::integer AS ordem,
       'nivel'::text AS dim1_nome, completo.nivel AS dim1_valor,
       NULL::text AS dim2_nome, NULL::text AS dim2_valor,
       m.nome AS medida, m.valor AS valor, NULL::text AS valor_texto,
       completo.n::bigint AS n, false AS suprimido
FROM completo
CROSS JOIN LATERAL (VALUES
    ('contagem', completo.n::double precision, 1),
    ('pct', 100.0 * completo.n::double precision / nullif(completo.total, 0)::double precision, 2)
) AS m(nome, valor, ordem_medida)
ORDER BY completo.ord, m.ordem_medida;""",
    )
    cab = _cab(tmp_path, sql)
    with psycopg.connect(dsn) as con:
        arquivo = agregar.materializar(
            con, cab, manifest["dataset"]["versao_dados"], tmp_path / "out", n_registros=2111
        )
    import json

    doc = json.loads(arquivo.read_text(encoding="utf-8"))
    assert doc["id"] == "por-nivel" and doc["total_linhas"] == 14
    assert [ln["nivel"] for ln in doc["linhas"]][::2] == [
        "Abaixo do Peso",
        "Peso Normal",
        "Sobrepeso I",
        "Sobrepeso II",
        "Obesidade I",
        "Obesidade II",
        "Obesidade III",
    ]
    assert sum(ln["valor"] for ln in doc["linhas"] if ln["medida"] == "pct") == pytest.approx(
        100.0, abs=1e-9
    )
    assert sum(ln["n"] for ln in doc["linhas"] if ln["medida"] == "contagem") == 2111
