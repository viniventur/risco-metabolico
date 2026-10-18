import { describe, expect, it } from "vitest";

import type { Agregado } from "@/shared/api/endpoints/tipos";

import { categoriasDe, maximoDe, pivotar, seriesDe, tetoDoEixo } from "./agregadoUtil";

const base: Agregado = {
  campo: "atividade",
  metrica: "imc_medio",
  serie: "genero",
  dimensoes: [
    { nome: "atividade", tipo: "inteiro" },
    { nome: "genero", tipo: "texto" },
  ],
  medidas: [{ nome: "imc_medio", classe: "media_limitada" }],
  amostra_minima: 15,
  total_filtrado: 10,
  total_global: 2111,
  recorte: {},
  linhas: [
    { ordem: 3, atividade: "1", genero: "Feminino", medida: "imc_medio", valor: 29.2, n: 305, suprimido: false },
    { ordem: 1, atividade: "0", genero: "Feminino", medida: "imc_medio", valor: 31.5, n: 475, suprimido: false },
    { ordem: 2, atividade: "0", genero: "Masculino", medida: "imc_medio", valor: null, n: 3, suprimido: true },
    { ordem: 4, atividade: "1", genero: "Masculino", medida: "imc_medio", valor: 30.4, n: 471, suprimido: false },
  ],
};

describe("pivotar", () => {
  it("respeita a ordem do domínio e separa categoria × série", () => {
    const linhas = pivotar(base);
    expect(linhas.map((l) => `${l.categoria}/${l.serie}`)).toEqual(["0/Feminino", "0/Masculino", "1/Feminino", "1/Masculino"]);
    expect(categoriasDe(linhas)).toEqual(["0", "1"]);
    expect(seriesDe(linhas)).toEqual(["Feminino", "Masculino"]);
  });

  it("junta as medidas de uma mesma categoria e preserva a supressão", () => {
    const contagem: Agregado = {
      ...base,
      campo: "nivel",
      serie: null,
      metrica: "contagem",
      linhas: [
        { ordem: 1, nivel: "Peso Normal", medida: "contagem", valor: 287, n: 287, suprimido: false },
        { ordem: 2, nivel: "Peso Normal", medida: "pct", valor: 13.6, n: 287, suprimido: false },
      ],
    };
    const [linha] = pivotar(contagem);
    expect(linha?.valores).toEqual({ contagem: 287, pct: 13.6 });
    expect(pivotar(base)[1]?.suprimido).toBe(true);
    expect(pivotar(undefined)).toEqual([]);
  });

  it("maximoDe ignora nulos e tetoDoEixo arredonda para cima", () => {
    expect(maximoDe(pivotar(base), "imc_medio")).toBe(31.5);
    expect(tetoDoEixo(31.5)).toBe(40);
    expect(tetoDoEixo(351)).toBe(400);
    expect(tetoDoEixo(0)).toBe(1);
  });
});
