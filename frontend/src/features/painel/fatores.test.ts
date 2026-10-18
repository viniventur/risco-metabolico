import { describe, expect, it } from "vitest";

import type { Agregado } from "@/shared/api/endpoints/tipos";

import { AMOSTRA_MINIMA, FATORES, montarGrupo } from "./fatores";

/** A tabela longa de /painel/por-categoria?campo=alcool&serie=nivel&metrica=contagem, só com contagens. */
function agregado(celulas: Array<[string, string, number]>): Agregado {
  return {
    campo: "alcool",
    metrica: "contagem",
    serie: "nivel",
    dimensoes: [
      { nome: "alcool", tipo: "texto" },
      { nome: "nivel", tipo: "texto" },
    ],
    medidas: [{ nome: "contagem", classe: "contagem" }],
    amostra_minima: null,
    total_filtrado: celulas.reduce((s, [, , n]) => s + n, 0),
    total_global: 2111,
    recorte: {},
    linhas: celulas.map(([alcool, nivel, n], i) => ({ ordem: i + 1, alcool, nivel, medida: "contagem", valor: n, n, suprimido: false })),
  };
}

const ALCOOL = FATORES.find((f) => f.campo === "alcool")!;
const rotulo = (_campo: string, valor: string) => valor;

describe("montarGrupo (fatores associados)", () => {
  // Na ordem do servidor (código de ponto): "Frequentemente" < "Não" < "Sempre" < "Às vezes".
  const dados = agregado([
    ["Frequentemente", "Peso Normal", 18],
    ["Frequentemente", "Obesidade I", 14],
    ["Não", "Abaixo do Peso", 30],
    ["Não", "Obesidade III", 10],
    ["Sempre", "Peso Normal", 1],
    ["Às vezes", "Obesidade II", 40],
    ["Às vezes", "Peso Normal", 60],
  ]);

  it("lê as respostas na ordem de frequência, não na do código de ponto", () => {
    expect(montarGrupo(ALCOOL, dados, rotulo).linhas.map((l) => l.valor)).toEqual(["Não", "Às vezes", "Frequentemente", "Sempre"]);
  });

  it("soma a categoria nos 7 níveis e calcula a fração em obesidade", () => {
    const [nao, asVezes] = montarGrupo(ALCOOL, dados, rotulo).linhas;
    expect(nao).toMatchObject({ n: 40, obesidade: 10 / 40 });
    expect(asVezes?.porNivel).toEqual({ "Obesidade II": 40, "Peso Normal": 60 });
    expect(asVezes?.obesidade).toBeCloseTo(0.4);
  });

  it(`suprime a composição abaixo de ${AMOSTRA_MINIMA} registros, sem tirar a categoria do gráfico`, () => {
    const linhas = montarGrupo(ALCOOL, dados, rotulo).linhas;
    expect(linhas.find((l) => l.valor === "Sempre")).toMatchObject({ n: 1, suprimido: true });
    expect(linhas.find((l) => l.valor === "Frequentemente")).toMatchObject({ n: 32, suprimido: false });
  });

  it("a média do grupo é a obesidade do conjunto (ponderada pelo n), não a média das linhas", () => {
    const { media } = montarGrupo(ALCOOL, dados, rotulo);
    expect(media).toBeCloseTo((14 + 10 + 40) / 173);
  });

  it("sem dado (primeira carga), nenhuma linha e média nula", () => {
    expect(montarGrupo(ALCOOL, undefined, rotulo)).toMatchObject({ linhas: [], media: null });
  });
});
