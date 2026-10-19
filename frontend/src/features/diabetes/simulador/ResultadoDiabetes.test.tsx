import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { describe, expect, it } from "vitest";

import type { EntradaDiabetes, RespostaDiabetes } from "../api/tipos";
import { ResultadoDiabetes } from "./ResultadoDiabetes";

const ENTRADA: EntradaDiabetes = {
  Faixa_Etaria: 9,
  Sexo: "Masculino",
  IMC: 31,
  Pressao_Alta: "Sim",
  Colesterol_Alto: "Sim",
  Fumou_100_Cigarros: "Não",
  Atividade_Fisica_30_Dias: "Não",
  Fruta_Diaria: "Sim",
  Verdura_Diaria: "Sim",
  Escolaridade: 4,
};

const RESPOSTA: RespostaDiabetes = {
  probabilidade: 0.3412,
  limiar: 0.12554778158664703,
  risco_elevado: true,
  classificacao: "Risco elevado",
  imc: 31,
  faixa_imc: "Obesidade Grau I",
  fora_do_dominio_treino: [],
  versao_modelo: "1.0.0",
  latencia_ms: 4.2,
};

function comCliente(no: ReactNode) {
  return <QueryClientProvider client={new QueryClient()}>{no}</QueryClientProvider>;
}

describe("ResultadoDiabetes", () => {
  it("sem resposta, diz onde o resultado vai aparecer", () => {
    render(comCliente(<ResultadoDiabetes entrada={null} nome="" calculando={false} />));
    expect(screen.getByText("O resultado aparece aqui")).toBeInTheDocument();
  });

  it("a classificação é o resultado da previsão: em magenta, com a leitura do limiar", () => {
    render(comCliente(<ResultadoDiabetes resposta={RESPOSTA} entrada={ENTRADA} nome="" calculando={false} />));
    const classificacao = screen.getByText("Risco elevado");
    expect(classificacao).toHaveClass("text-previsao");
    expect(screen.getByText(/a triagem sugere conversar com um profissional de saúde sobre o exame de glicemia/)).toBeInTheDocument();
    // probabilidade e limiar como a API os mandou (0 a 1), em pt-BR
    expect(screen.getByText("34,1%")).toBeInTheDocument();
    expect(screen.getByText("12,6%")).toBeInTheDocument();
    expect(screen.getByText("31,00")).toBeInTheDocument();
    expect(screen.getByText("Obesidade Grau I")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Baixar relatório (HTML)" })).toBeInTheDocument();
  });

  it("abaixo do limiar, a leitura lembra que o limiar não descarta a doença; fora da faixa da base, avisa", () => {
    const baixo = { ...RESPOSTA, probabilidade: 0.05, risco_elevado: false, classificacao: "Risco baixo" as const, fora_do_dominio_treino: ["IMC"] };
    render(comCliente(<ResultadoDiabetes resposta={baixo} entrada={ENTRADA} nome="" calculando={false} />));
    expect(screen.getByText("Risco baixo")).toHaveClass("text-previsao");
    expect(screen.getByText(/Isso não descarta a diabetes/)).toBeInTheDocument();
    expect(screen.getByRole("status")).toHaveTextContent("Fora da faixa do treino");
    expect(screen.getByRole("status")).toHaveTextContent("IMC");
  });
});
