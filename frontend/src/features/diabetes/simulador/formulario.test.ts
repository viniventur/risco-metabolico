import { describe, expect, it } from "vitest";

import type { CampoFormulario } from "@/shared/api/endpoints/tipos";

import { montarSchema, padroes, paraEntrada } from "./formulario";

// Os campos como /diabetes/metadata os entrega: uma escala (inteiros), uma resposta de texto e o IMC.
const CAMPOS: CampoFormulario[] = [
  {
    nome: "Faixa_Etaria",
    rotulo: "Faixa etária",
    tipo: "selecao",
    opcoes: [
      { rotulo: "18 a 24 anos", valor: 1 },
      { rotulo: "40 a 44 anos", valor: 5 },
    ],
    padrao: 5,
  },
  {
    nome: "Sexo",
    rotulo: "Sexo",
    tipo: "selecao",
    opcoes: [
      { rotulo: "Feminino", valor: "Feminino" },
      { rotulo: "Masculino", valor: "Masculino" },
    ],
    padrao: "Feminino",
  },
  { nome: "IMC", rotulo: "IMC (kg/m²)", tipo: "numero", minimo: 10, maximo: 100, passo: 0.1, padrao: 25, opcoes: [] },
];

describe("formulário da triagem de diabetes, montado de /diabetes/metadata", () => {
  it("os padrões vêm da API; as seleções guardam string", () => {
    expect(padroes(CAMPOS)).toEqual({ Faixa_Etaria: "5", Sexo: "Feminino", IMC: 25 });
  });

  it("o schema aceita só as opções da API e o IMC dentro da faixa do contrato", () => {
    const schema = montarSchema(CAMPOS);
    expect(schema.safeParse({ Faixa_Etaria: "1", Sexo: "Masculino", IMC: "31.4" }).success).toBe(true);
    expect(schema.safeParse({ Faixa_Etaria: "9", Sexo: "Masculino", IMC: "31.4" }).success).toBe(false);
    const fora = schema.safeParse({ Faixa_Etaria: "1", Sexo: "Masculino", IMC: "150" });
    expect(fora.success).toBe(false);
    expect(fora.error?.issues[0]?.message).toBe("Máximo 100");
  });

  it("o JSON da API leva o inteiro nas escalas, o texto nas respostas e o número no IMC", () => {
    expect(paraEntrada({ Faixa_Etaria: "1", Sexo: "Masculino", IMC: "24.22" }, CAMPOS)).toEqual({ Faixa_Etaria: 1, Sexo: "Masculino", IMC: 24.22 });
  });
});
