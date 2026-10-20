import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it } from "vitest";

import { chaves } from "@/shared/api/queryKeys";

import { ListaEstudosPage } from "./ListaEstudosPage";
import type { EntradaManifesto } from "./tipos";

// O que public/study/manifest.json traz: os dois notebooks, um de cada projeto.
const MANIFESTO: EntradaManifesto[] = [
  {
    slug: "comparacao-de-modelos",
    titulo: "Comparação de modelos para previsão de obesidade",
    n_celulas: 40,
    n_figuras: 3,
    atualizado_em: "2026-10-17T18:39:20.432730Z",
    arquivo_origem: "study/01_comparacao_de_modelos.ipynb",
  },
  {
    slug: "triagem-de-diabetes",
    titulo: "Triagem de diabetes: modelos, calibração e limiar",
    n_celulas: 51,
    n_figuras: 9,
    atualizado_em: "2026-10-19T23:21:33.379260Z",
    arquivo_origem: "study/02_triagem_de_diabetes.ipynb",
  },
];

describe("a lista de estudos (ADR 0016)", () => {
  it("cada notebook leva o selo do projeto dele", () => {
    const cliente = new QueryClient({ defaultOptions: { queries: { retry: false, staleTime: Infinity } } });
    cliente.setQueryData(chaves.estudos, MANIFESTO);
    render(
      <QueryClientProvider client={cliente}>
        <MemoryRouter initialEntries={["/estudos"]}>
          <ListaEstudosPage />
        </MemoryRouter>
      </QueryClientProvider>,
    );
    expect(screen.getByRole("link", { name: /Comparação de modelos/ })).toHaveTextContent(/^Projeto 1 · Obesidade/);
    expect(screen.getByRole("link", { name: /Triagem de diabetes/ })).toHaveTextContent(/^Projeto 2 · Diabetes/);
  });
});
