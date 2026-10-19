import { describe, expect, it } from "vitest";

import { FILTRO_VAZIO_DIABETES, filtroVazioDiabetes, normalizarFiltroDiabetes, paraQueryStringDiabetes, semFiltros } from "./filtroDiabetes";

describe("filtros da vertente diabetes", () => {
  it("normaliza: valores únicos e as faixas etárias em ordem numérica (2 antes de 10)", () => {
    const f = normalizarFiltroDiabetes({ faixa_etaria: ["10", "2", "10"], sexo: ["Masculino"] });
    expect(f.faixa_etaria).toEqual(["2", "10"]);
    expect(f.sexo).toEqual(["Masculino"]);
    expect(f.pressao_alta).toEqual([]);
  });

  it("só os filtros com valor viajam como parâmetro; o recorte vazio não manda nenhum", () => {
    expect(paraQueryStringDiabetes({ ...FILTRO_VAZIO_DIABETES, faixa_imc: ["Sobrepeso"], colesterol_alto: ["Sim"] })).toEqual({
      faixa_imc: ["Sobrepeso"],
      colesterol_alto: ["Sim"],
    });
    expect(paraQueryStringDiabetes(FILTRO_VAZIO_DIABETES)).toEqual({});
    expect(filtroVazioDiabetes(FILTRO_VAZIO_DIABETES)).toBe(true);
  });

  it("o gráfico de origem tira o próprio filtro do recorte e mantém os outros", () => {
    const f = { ...FILTRO_VAZIO_DIABETES, sexo: ["Feminino"], faixa_etaria: ["9"] };
    expect(semFiltros(f, "faixa_etaria")).toEqual({ ...FILTRO_VAZIO_DIABETES, sexo: ["Feminino"] });
    expect(filtroVazioDiabetes(semFiltros(f, "sexo", "faixa_etaria"))).toBe(true);
    // não muda o recorte de quem chamou
    expect(f.faixa_etaria).toEqual(["9"]);
  });
});
