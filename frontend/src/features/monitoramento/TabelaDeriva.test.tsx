import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import type { RespostaDeriva } from "@/shared/api/endpoints/tipos";

import { TabelaDeriva } from "./TabelaDeriva";

function resposta(nAmostra: number): RespostaDeriva {
  return {
    janela_dias: 30,
    n_minimo: 200,
    n_amostra: nAmostra,
    versao_modelo: "2.0.0",
    versao_dados: "abc123",
    atualizado_em: "2026-10-17T00:00:00Z",
    disponivel: true,
    motivo: null,
    consultas: [],
    features: [
      { feature: "Peso", tipo: "numerica", n_amostra: nAmostra, psi: 0.3123, classificacao: "deriva significativa" },
      { feature: "Genero", tipo: "categorica", n_amostra: nAmostra, psi: 0.0123, classificacao: "estavel" },
    ],
    estatisticas: [
      {
        feature: "Peso",
        n_linhas: nAmostra,
        n_nulos: 0,
        n_validos: nAmostra,
        media_log: 90.5,
        media_treino: 86.6,
        desvio_treino: 26.2,
        desvio_log: 20,
        deslocamento_desvios: 0.15,
        minimo_log: 40,
        maximo_log: 160,
        minimo_treino: 39,
        maximo_treino: 173,
        p50_log: 88,
        p50_treino: 83,
        extrapolou_faixa_de_treino: false,
      },
    ],
    faixas: [],
  };
}

describe("TabelaDeriva", () => {
  it("com amostra suficiente, mostra a coluna de PSI com 3 casas e as médias numéricas", () => {
    render(<TabelaDeriva dado={resposta(250)} featureSelecionada="" aoSelecionar={() => {}} />);
    expect(screen.getByRole("columnheader", { name: "PSI" })).toBeInTheDocument();
    expect(screen.getByText("0,312")).toBeInTheDocument();
    expect(screen.getByText("90,50")).toBeInTheDocument();
  });

  it("abaixo do n mínimo, a coluna de PSI some", () => {
    render(<TabelaDeriva dado={resposta(12)} featureSelecionada="" aoSelecionar={() => {}} />);
    expect(screen.queryByRole("columnheader", { name: "PSI" })).toBeNull();
    expect(screen.queryByText("0,312")).toBeNull();
    expect(screen.getAllByRole("row")).toHaveLength(3);
  });
});
