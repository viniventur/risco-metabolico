import { describe, expect, it } from "vitest";

import type { Agregado } from "@/shared/api/endpoints/tipos";

import { resumirNiveis } from "./niveis";

/** As contagens da base (docs/dicionario-de-dados.md), em ordem clínica, no formato de /painel/por-categoria. */
const CONTAGENS: Array<[string, number]> = [
  ["Abaixo do Peso", 272],
  ["Peso Normal", 287],
  ["Sobrepeso I", 290],
  ["Sobrepeso II", 290],
  ["Obesidade I", 351],
  ["Obesidade II", 297],
  ["Obesidade III", 324],
];

function agregado(contagens: Array<[string, number]>): Agregado {
  const total = contagens.reduce((s, [, n]) => s + n, 0);
  return {
    campo: "nivel",
    metrica: "contagem",
    serie: null,
    dimensoes: [{ nome: "nivel", tipo: "texto" }],
    medidas: [
      { nome: "contagem", classe: "contagem" },
      { nome: "pct", classe: "proporcao" },
    ],
    amostra_minima: null,
    total_filtrado: total,
    total_global: 2111,
    recorte: {},
    linhas: contagens.flatMap(([nivel, n], i) => [
      { ordem: 2 * i + 1, nivel, medida: "contagem", valor: n, n, suprimido: false },
      { ordem: 2 * i + 2, nivel, medida: "pct", valor: total ? (100 * n) / total : null, n, suprimido: false },
    ]),
  };
}

describe("resumirNiveis", () => {
  it("excesso de peso = as 5 classes de sobrepeso e obesidade; obesidade = as 3 últimas", () => {
    const r = resumirNiveis(agregado(CONTAGENS));
    expect(r.total).toBe(2111);
    expect(r.excesso).toBeCloseTo((290 + 290 + 351 + 297 + 324) / 2111);
    expect(r.obesidade).toBeCloseTo((351 + 297 + 324) / 2111);
  });

  it("classe ausente do recorte vale 0, e recorte vazio dá frações nulas (não NaN)", () => {
    const r = resumirNiveis(agregado([["Obesidade III", 0]]));
    expect(r.porNivel["Peso Normal"]).toBe(0);
    expect(r.excesso).toBeNull();
    expect(r.obesidade).toBeNull();
  });
});
