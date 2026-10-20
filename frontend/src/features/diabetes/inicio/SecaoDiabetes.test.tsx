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

// O que GET /diabetes/model/info responde com o modelo 1.1.0 (artifacts/diabetes/manifest.json): o limiar de cada
// grupo de idade, o que classifica, com o ponto fora da dobra; as métricas do teste medidas com ele; e o limiar
// único, que fica como referência.
const INFO_POR_IDADE: InfoModeloDiabetes = {
  ...INFO,
  versao: "1.1.0",
  release: "diabetes-v1.1.0",
  treinado_em: "2026-10-20T00:33:26+00:00",
  sha256: "a3b1debd",
  limiar: {
    criterio: "maior limiar com recall >= 0.8 nas predições fora da dobra do treino",
    recall_alvo: 0.8,
    valor: 0.12554778158664703,
    fora_da_dobra: { recall: 0.8000141457721823, precisao: 0.270552778242878, especificidade: 0.650809826698804, encaminhados: 0.4120052822453485 },
  },
  limiares_por_idade: {
    criterio: "em cada grupo de idade, o maior limiar com recall >= 0.8 nas predições fora da dobra do treino",
    recall_alvo: 0.8,
    grupos: [
      {
        grupo: "18 a 44 anos",
        faixas_etarias: [1, 2, 3, 4, 5],
        valor: 0.029653484001755714,
        fora_da_dobra: { recall: 0.8, precisao: 0.09782001117942984, especificidade: 0.6902780109861114, encaminhados: 0.3294735145836691 },
      },
      {
        grupo: "45 a 64 anos",
        faixas_etarias: [6, 7, 8, 9],
        valor: 0.10843631625175476,
        fora_da_dobra: { recall: 0.8000168265185933, precisao: 0.254162991473552, especificidade: 0.635089187634043, encaminhados: 0.42344432623310774 },
      },
      {
        grupo: "65 anos ou mais",
        faixas_etarias: [10, 11, 12, 13],
        valor: 0.16155649721622467,
        fora_da_dobra: { recall: 0.8000136602691073, precisao: 0.30032563267608525, especificidade: 0.517112015572465, encaminhados: 0.5481440879256791 },
      },
    ],
    fora_da_dobra: { recall: 0.8000141457721823, precisao: 0.2493441791768622, especificidade: 0.6100923471520092, encaminhados: 0.44704943235572375 },
  },
  metricas_teste: {
    ...INFO.metricas_teste,
    recall_no_limiar: 0.7999717074550856,
    precisao_no_limiar: 0.24950363997352745,
    especificidade_no_limiar: 0.6104609888474134,
    encaminhados_no_limiar: 0.44672421948912017,
  },
};

function renderizarCom(info: InfoModeloDiabetes) {
  const cliente = new QueryClient({ defaultOptions: { queries: { retry: false, staleTime: Infinity } } });
  cliente.setQueryData(chavesDiabetes.modelo, info);
  return render(
    <QueryClientProvider client={cliente}>
      <MemoryRouter>
        <SecaoDiabetes />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

/** As células de cada linha da tabela, na ordem: o cabeçalho de linha (o grupo) e os números. */
const celulas = (tabela: HTMLElement) => within(tabela).getAllByRole("row").map((linha) => [...linha.children].map((c) => c.textContent));

describe("SecaoDiabetes com o limiar por grupo de idade", () => {
  it("o cartão do limiar vira a tabela por grupo: limiar, recall e encaminhados fora da dobra, e o total", () => {
    renderizarCom(INFO_POR_IDADE);
    const tabela = screen.getByRole("table", { name: "Limiar de cada grupo de idade" });
    expect(celulas(tabela)).toEqual([
      ["Grupo de idade", "Limiar", "Recall", "Encaminhados"],
      ["18 a 44 anos", "3,0%", "80,0%", "32,9%"],
      ["45 a 64 anos", "10,8%", "80,0%", "42,3%"],
      ["65 anos ou mais", "16,2%", "80,0%", "54,8%"],
      ["Todas as idades", "80,0%", "44,7%"],
    ]);
    // o grupo é o cabeçalho da linha: o leitor de tela o anuncia em cada número
    expect(within(tabela).getAllByRole("rowheader").map((c) => c.textContent)).toEqual(["18 a 44 anos", "45 a 64 anos", "65 anos ou mais", "Todas as idades"]);
    expect(within(tabela).getByText("Recall e encaminhados nas predições fora da dobra do treino.")).toBeInTheDocument();
  });

  it("o critério dentro de cada grupo, a validação cruzada e o limiar único como referência", () => {
    renderizarCom(INFO_POR_IDADE);
    expect(screen.getByText(/^Em cada grupo de idade, o maior limiar com recall ≥ 0,80 nas predições fora da dobra do treino\./)).toBeInTheDocument();
    expect(screen.getByText("0,800")).toBeInTheDocument();
    expect(screen.getByText("12,6%")).toBeInTheDocument();
    expect(screen.getByText(/^Um limiar só, para todas as idades, seria/)).toHaveTextContent(
      "Um limiar só, para todas as idades, seria 12,6%: no total, recall de 80,0% e 41,2% das respostas encaminhadas.",
    );
    expect(screen.getByText("diabetes-v1.1.0")).toBeInTheDocument();
  });

  it("as métricas medem a regra por grupo, e os textos de apoio, a descrição e o atalho do Simulador falam no limiar do grupo", () => {
    renderizarCom(INFO_POR_IDADE);
    const metricas = screen.getByRole("list", { name: "Desempenho da triagem de diabetes no teste" });
    expect(finais(metricas)).toEqual(["0,797", "80,0%", "25,0%", "44,7%"]);
    expect(within(metricas).getByText("dos casos de diabetes, os que o limiar do grupo de idade encaminha")).toBeInTheDocument();
    expect(within(metricas).getByText("dos encaminhados pelo limiar do grupo de idade, os que têm diabetes")).toBeInTheDocument();
    expect(within(metricas).getByText("das respostas, as que o limiar do grupo de idade encaminha")).toBeInTheDocument();
    expect(screen.getByText(/^10 respostas viram a probabilidade de já ter recebido o diagnóstico de diabetes; o limiar do grupo de idade encaminha/)).toBeInTheDocument();
    const telas = screen.getByRole("navigation", { name: "Telas da vertente diabetes" });
    expect(within(telas).getByRole("link", { name: /^Simulador/ })).toHaveTextContent("A probabilidade, o limiar do grupo de idade, a classificação e o relatório.");
  });

  it("sem limiares_por_idade (o manifest de um modelo de limiar único), nem a tabela nem o grupo de idade aparecem", () => {
    renderizarCom(INFO);
    expect(screen.queryByRole("table", { name: "Limiar de cada grupo de idade" })).toBeNull();
    expect(screen.queryByText(/grupo de idade/)).toBeNull();
    expect(screen.getByText("12,6%")).toBeInTheDocument();
  });
});
