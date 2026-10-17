import { describe, expect, it } from "vitest";

import { FILTRO_VAZIO } from "./filtroSchema";
import { paraQueryString, paraStringLegivel } from "./paraQueryString";

describe("paraQueryString", () => {
  it("omite filtros vazios e ordena os valores", () => {
    const qs = paraQueryString({ ...FILTRO_VAZIO, nivel: ["Obesidade I", "Abaixo do Peso"] });
    expect(qs).toEqual({ nivel: ["Abaixo do Peso", "Obesidade I"] });
  });

  it("remove duplicatas e serializa como parâmetros repetidos na ordem canônica dos filtros", () => {
    expect(paraQueryString({ ...FILTRO_VAZIO, agua: ["2", "1", "2"] })).toEqual({ agua: ["1", "2"] });
    expect(paraStringLegivel({ ...FILTRO_VAZIO, agua: ["2", "1"], genero: ["Feminino"] })).toBe(
      "genero=Feminino&agua=1&agua=2",
    );
  });

  it("gera a mesma string para o mesmo recorte em ordem diferente (chave de cache estável)", () => {
    const a = paraStringLegivel({ ...FILTRO_VAZIO, nivel: ["Peso Normal", "Obesidade I"], alcool: ["0"] });
    const b = paraStringLegivel({ ...FILTRO_VAZIO, alcool: ["0"], nivel: ["Obesidade I", "Peso Normal"] });
    expect(a).toBe(b);
    expect(a).toBe("nivel=Obesidade%20I&nivel=Peso%20Normal&alcool=0");
  });

  it("recorte vazio vira objeto vazio (nenhum parâmetro viaja)", () => {
    expect(paraQueryString(FILTRO_VAZIO)).toEqual({});
    expect(paraStringLegivel(FILTRO_VAZIO)).toBe("");
  });
});
