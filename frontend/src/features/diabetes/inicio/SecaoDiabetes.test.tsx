import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it } from "vitest";

import { chavesDiabetes } from "../api/chaves";
import type { InfoModeloDiabetes } from "../api/tipos";
import { SecaoDiabetes } from "./SecaoDiabetes";

// O que GET /diabetes/model/info responderia: o Início não tem número da vertente escrito à mão.
const INFO: InfoModeloDiabetes = {
  nome: "risco-metabolico",
  vertente: "diabetes",
  versao: "1.0.0",
  release: "diabetes-v1.0.0",
  algoritmo: "XGBClassifier",
  treinado_em: "2026-10-19T04:50:59+00:00",
  versao_dados: "dee1f27e9777",
  sha256: "2c411582",
  entradas: ["Faixa_Etaria", "Sexo", "IMC", "Pressao_Alta", "Colesterol_Alto", "Fumou_100_Cigarros", "Atividade_Fisica_30_Dias", "Fruta_Diaria", "Verdura_Diaria", "Escolaridade"],
  n_features_entrada: 10,
  n_features_modelo: 10,
  hiperparametros: { n_estimators: 300, max_depth: 3 },
  desbalanceamento: "nenhum",
  calibracao: "nenhuma",
  split: { linhas_treino: 202944, linhas_teste: 50736 },
  validacao_cruzada: { n_splits: 5, shuffle: true, random_state: 42, roc_auc: 0.8001857588934433, roc_auc_dp: 0.0024, pr_auc: 0.38473200918321665, pr_auc_dp: 0.0074, brier: 0.1014 },
  limiar: {
    criterio: "maior limiar com recall >= 0.8 nas predições fora da dobra do treino",
    recall_alvo: 0.8,
    valor: 0.12554778158664703,
    fora_da_dobra: { recall: 0.80001, precisao: 0.2706, especificidade: 0.6508, encaminhados: 0.412 },
  },
  metricas_teste: {
    roc_auc: 0.7966152551099485,
    pr_auc: 0.37227138378839997,
    brier: 0.10226663781349053,
    brier_da_prevalencia: 0.11991648460617611,
    precisao_fixa: 0.3,
    recall_na_precisao_fixa: 0.7216013580421559,
    recall_no_limiar: 0.7945961239213467,
    precisao_no_limiar: 0.2686917005501076,
    especificidade_no_limiar: 0.6498958023221196,
    encaminhados_no_limiar: 0.41203484705140336,
  },
  ambiente: {},
  notebook_origem: "study/02_triagem_de_diabetes.ipynb",
  aviso: "",
};

function renderizar() {
  const cliente = new QueryClient({ defaultOptions: { queries: { retry: false, staleTime: Infinity } } });
  cliente.setQueryData(chavesDiabetes.modelo, INFO);
  return render(
    <QueryClientProvider client={cliente}>
      <MemoryRouter>
        <SecaoDiabetes />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

const finais = (bloco: HTMLElement) => [...bloco.querySelectorAll("[data-numero]")].map((n) => n.textContent);

describe("SecaoDiabetes (Início)", () => {
  it("as quatro métricas do teste vêm do manifest da vertente, já formatadas", () => {
    renderizar();
    expect(screen.getByRole("heading", { level: 2, name: "Triagem de diabetes: o modelo em teste" })).toBeInTheDocument();
    expect(finais(screen.getByRole("list", { name: "Desempenho da triagem de diabetes no teste" }))).toEqual(["0,797", "79,5%", "26,9%", "41,2%"]);
    expect(screen.getByText(/10 respostas viram a probabilidade/)).toBeInTheDocument();
  });

  it("o limiar com o critério e a validação cruzada, e o artefato com o release próprio", () => {
    renderizar();
    expect(screen.getByText("12,6%")).toBeInTheDocument();
    expect(screen.getByText(/recall ≥ 0,80 nas predições fora da dobra do treino/)).toBeInTheDocument();
    expect(screen.getByText("0,800")).toBeInTheDocument();
    expect(screen.getByText("diabetes-v1.0.0")).toBeInTheDocument();
    expect(screen.getByText("dee1f27e9777")).toBeInTheDocument();
  });

  it("os atalhos da vertente num menu próprio: as quatro telas e o notebook", () => {
    renderizar();
    const telas = screen.getByRole("navigation", { name: "Telas da vertente diabetes" });
    expect(within(telas).getAllByRole("link").map((a) => a.getAttribute("href"))).toEqual([
      "/diabetes",
      "/diabetes/consulta",
      "/diabetes/simulador",
      "/diabetes/monitoramento",
      "/estudos/triagem-de-diabetes",
    ]);
  });
});
