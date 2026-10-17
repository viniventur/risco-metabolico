import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import type { RespostaTriagem } from "@/shared/api/endpoints/tipos";
import { ORDEM_CLINICA } from "@/shared/dominio";

import { BarrasProbabilidade } from "./BarrasProbabilidade";

const resposta: RespostaTriagem = {
  classe_prevista: "Peso Normal",
  faixa_imc: "Peso Ideal",
  imc: 22.5,
  latencia_ms: 3.2,
  risco_acumulado: 0.12,
  versao_modelo: "2.0.0",
  fora_do_dominio_treino: [],
  probabilidades: ORDEM_CLINICA.map((classe, i) => ({ classe, probabilidade: i === 1 ? 0.82 : 0.03, de_risco: i >= 2 })),
};

describe("BarrasProbabilidade", () => {
  it("desenha exatamente 7 barras, uma por classe, na ordem clínica", () => {
    const { container } = render(<BarrasProbabilidade resposta={resposta} />);
    expect(container.querySelectorAll(".recharts-bar-rectangle")).toHaveLength(7);
  });

  it("a tabela equivalente traz as mesmas 7 linhas, na ordem clínica e formatadas em pt-BR", () => {
    render(<BarrasProbabilidade resposta={resposta} mostrarTabela />);
    const linhas = screen.getAllByRole("row");
    expect(linhas).toHaveLength(8);
    const classes = linhas.slice(1).map((l) => l.querySelector("td")?.textContent);
    expect(classes).toEqual([...ORDEM_CLINICA]);
    expect(screen.getByText("82,0%")).toBeInTheDocument();
  });
});
