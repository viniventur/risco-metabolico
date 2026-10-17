import { describe, expect, it } from "vitest";

import { fmtImc, fmtInt, fmtMs, fmtPct, fmtPontosPct } from "./ptBR";

describe("formatação pt-BR", () => {
  it("fmtPct(0.413) === '41,3%'", () => {
    expect(fmtPct(0.413)).toBe("41,3%");
    expect(fmtPct(1)).toBe("100,0%");
    expect(fmtPct(0.12346, 2)).toBe("12,35%");
  });

  it("fmtPontosPct recebe o valor já em pontos percentuais", () => {
    expect(fmtPontosPct(41.3)).toBe("41,3%");
  });

  it("fmtInt agrupa milhar com ponto", () => {
    expect(fmtInt(2111)).toBe("2.111");
  });

  it("fmtImc tem sempre 2 casas, fmtMs uma", () => {
    expect(fmtImc(24.2)).toBe("24,20");
    expect(fmtMs(3.25)).toBe("3,3 ms");
  });

  it("nulos viram travessão, nunca NaN", () => {
    expect(fmtPct(null)).toBe("—");
    expect(fmtInt(undefined)).toBe("—");
    expect(fmtPct(Number.NaN)).toBe("—");
  });
});
