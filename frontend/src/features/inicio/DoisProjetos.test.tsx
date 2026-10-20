import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it } from "vitest";

import { chavesDiabetes } from "@/features/diabetes/api/chaves";
import type { InfoModeloDiabetes } from "@/features/diabetes/api/tipos";
import { chaves } from "@/shared/api/queryKeys";
import { ORDEM_CLINICA } from "@/shared/dominio";
import { TooltipProvider } from "@/shared/ui/tooltip";

import { InicioPage } from "./InicioPage";

// O que GET /model/info, GET /metadata e GET /diabetes/model/info responderiam (os manifests dos modelos
// 2.0.0 e 1.1.0): o Início não tem número de nenhum dos dois projetos escrito à mão.
const INFO = {
  nome: "Triagem Metabólica",
  versao: "2.0.0",
  algoritmo: "XGBClassifier",
  treinado_em: "2026-10-17T16:29:44+00:00",
  versao_dados: "f3b7296728f8",
  sha256: "c3386ed5",
  n_features_entrada: 16,
  n_features_modelo: 44,
  binning_ativo: false,
  imc_como_feature: true,
  classes: [...ORDEM_CLINICA].sort(),
  ordem_clinica: [...ORDEM_CLINICA],
  hiperparametros: { n_estimators: 400, max_depth: 5 },
  smote: { k_neighbors: 5 },
  split: { test_size: 0.2, stratify: true, linhas_treino: 1688, linhas_teste: 423 },
  metricas_teste: { acuracia: 0.9881796690307328, f1_macro: 0.9875945763151402, recall_risco: 0.9935691318327974 },
  overfitting: { diff_acuracia: 0.011820330969267157, alerta: false },
  ambiente: {},
  notebook_origem: "study/01_comparacao_de_modelos.ipynb",
  aviso: "",
};

const METADATA = { versao_modelo: "2.0.0", aviso: "", grupos: [] };

const PONTO = { recall: 0.8, precisao: 0.25, especificidade: 0.61, encaminhados: 0.447 };

const INFO_DIABETES: InfoModeloDiabetes = {
  nome: "risco-metabolico",
  vertente: "diabetes",
  versao: "1.1.0",
  release: "diabetes-v1.1.0",
  algoritmo: "XGBClassifier",
  treinado_em: "2026-10-20T00:33:26+00:00",
  versao_dados: "dee1f27e9777",
  sha256: "a3b1debd",
  entradas: ["Faixa_Etaria", "Sexo", "IMC", "Pressao_Alta", "Colesterol_Alto", "Fumou_100_Cigarros", "Atividade_Fisica_30_Dias", "Fruta_Diaria", "Verdura_Diaria", "Escolaridade"],
  n_features_entrada: 10,
  n_features_modelo: 10,
  hiperparametros: { n_estimators: 300, max_depth: 3 },
  desbalanceamento: "nenhum",
  calibracao: "nenhuma",
  split: { linhas_treino: 202944, linhas_teste: 50736, prevalencia_treino: 0.13933400346893723, prevalencia_teste: 0.13932907600126143 },
  validacao_cruzada: { n_splits: 5, shuffle: true, random_state: 42, roc_auc: 0.8001857588934433, roc_auc_dp: 0.0024, pr_auc: 0.38473200918321665, pr_auc_dp: 0.0074, brier: 0.1014 },
  limiar: { criterio: "maior limiar com recall >= 0.8 nas predições fora da dobra do treino", recall_alvo: 0.8, valor: 0.12554778158664703, fora_da_dobra: PONTO },
  limiares_por_idade: {
    criterio: "em cada grupo de idade, o maior limiar com recall >= 0.8 nas predições fora da dobra do treino",
    recall_alvo: 0.8,
    grupos: [
      { grupo: "18 a 44 anos", faixas_etarias: [1, 2, 3, 4, 5], valor: 0.029653484001755714, fora_da_dobra: PONTO },
      { grupo: "45 a 64 anos", faixas_etarias: [6, 7, 8, 9], valor: 0.10843631625175476, fora_da_dobra: PONTO },
      { grupo: "65 anos ou mais", faixas_etarias: [10, 11, 12, 13], valor: 0.16155649721622467, fora_da_dobra: PONTO },
    ],
    fora_da_dobra: PONTO,
  },
  metricas_teste: {
    roc_auc: 0.7966152551099485,
    pr_auc: 0.37227138378839997,
    brier: 0.10226663781349053,
    brier_da_prevalencia: 0.11991648460617611,
    precisao_fixa: 0.3,
    recall_na_precisao_fixa: 0.7216013580421559,
    recall_no_limiar: 0.7999717074550856,
    precisao_no_limiar: 0.24950363997352745,
    especificidade_no_limiar: 0.6104609888474134,
    encaminhados_no_limiar: 0.44672421948912017,
  },
  ambiente: {},
  notebook_origem: "study/02_triagem_de_diabetes.ipynb",
  aviso: "",
};

function renderizar() {
  const cliente = new QueryClient({ defaultOptions: { queries: { retry: false, staleTime: Infinity } } });
  cliente.setQueryData(chaves.modelo(), INFO);
  cliente.setQueryData(chaves.metadata, METADATA);
  cliente.setQueryData(chavesDiabetes.modelo, INFO_DIABETES);
  return render(
    <QueryClientProvider client={cliente}>
      <MemoryRouter>
        <TooltipProvider>
          <InicioPage />
        </TooltipProvider>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

/** Os valores FINAIS dos números que contam (o que o leitor de tela ouve), dentro de um bloco. */
const finais = (bloco: HTMLElement) => [...bloco.querySelectorAll("[data-numero]")].map((n) => n.textContent);

describe("o Início em dois projetos (ADR 0016)", () => {
  it("o herói apresenta os dois projetos, cada um com o que entra e o que sai do modelo, a base e a versão, e leva à seção dele", () => {
    renderizar();
    const projetos = within(screen.getByRole("list", { name: "Os dois projetos" })).getAllByRole("link");
    expect(projetos.map((a) => a.getAttribute("href"))).toEqual(["#projeto-obesidade", "#projeto-diabetes"]);
    expect(projetos[0]).toHaveTextContent("Projeto 1 Obesidade16 respostas → 7 faixas de composição corporal e um risco acumuladodados fictícios · modelo v2.0.0");
    expect(projetos[1]).toHaveTextContent("Projeto 2 Diabetes10 respostas → a chance de já ter recebido o diagnóstico de diabetesdados reais e anonimizados · modelo v1.1.0");
  });

  it("o bloco da obesidade tem tudo o que é dela, e nada da diabetes", () => {
    renderizar();
    const obesidade = screen.getByRole("region", { name: "Projeto 1: Obesidade" });
    expect(within(obesidade).getByRole("heading", { level: 2, name: "Triagem de obesidade: o modelo em teste" })).toBeInTheDocument();
    expect(finais(within(obesidade).getByRole("list", { name: "Como funciona" }))).toEqual(["16", "44", "7"]);
    expect(finais(within(obesidade).getByLabelText("Métricas do modelo em teste"))).toEqual(["98,8%", "98,8%", "99,4%"]);
    expect(within(obesidade).getByText("Modelo servido")).toBeInTheDocument();
    expect(within(obesidade).getByRole("navigation", { name: "Atalhos" })).toBeInTheDocument();
    expect(within(obesidade).getByRole("region", { name: "Objetivo, dados e métodos" })).toBeInTheDocument();
    expect(within(obesidade).getByRole("link", { name: "Abrir o simulador da obesidade" })).toHaveAttribute("href", "/simulador");
    expect(within(obesidade).getByRole("link", { name: "Explorar o painel da obesidade" })).toHaveAttribute("href", "/painel");
    // a base e os limites da diabetes saíram do "Sobre o projeto" da obesidade
    expect(within(obesidade).queryByText(/BRFSS/)).toBeNull();
    expect(within(obesidade).queryByText(/Base de diabetes/)).toBeNull();
  });

  it("o bloco da diabetes tem o cabeçalho, as métricas, o limiar, as telas, a base e os limites dela", () => {
    renderizar();
    const diabetes = screen.getByRole("region", { name: "Projeto 2: Diabetes" });
    expect(within(diabetes).getByRole("heading", { level: 2, name: "Triagem de diabetes: o modelo em teste" })).toBeInTheDocument();
    expect(finais(within(diabetes).getByRole("list", { name: "Como funciona a triagem de diabetes" }))).toEqual(["10", "3"]);
    expect(within(diabetes).getByRole("list", { name: "Desempenho da triagem de diabetes no teste" })).toBeInTheDocument();
    expect(within(diabetes).getByRole("table", { name: "Limiar de cada grupo de idade" })).toBeInTheDocument();
    expect(within(diabetes).getByRole("navigation", { name: "Telas da vertente diabetes" })).toBeInTheDocument();
    expect(within(diabetes).getByRole("link", { name: "Abrir o simulador da diabetes" })).toHaveAttribute("href", "/diabetes/simulador");
    expect(within(diabetes).getByRole("link", { name: "Explorar o painel da diabetes" })).toHaveAttribute("href", "/diabetes");
    // a base: as respostas e o % com diabetes do split (202.944 + 50.736, a média pesada das duas prevalências)
    const base = within(diabetes).getByRole("list", { name: "Dados e limites da triagem de diabetes" });
    expect(finais(base)).toEqual(["253.680", "13,9%"]);
    expect(within(base).getByText(/BRFSS 2015/)).toBeInTheDocument();
    expect(within(base).getByText(/^Base de diabetes real, mas autodeclarada/)).toBeInTheDocument();
    // nada da obesidade
    expect(within(diabetes).queryByText(/Base de obesidade/)).toBeNull();
    expect(within(diabetes).queryByRole("list", { name: "Como funciona" })).toBeNull();
  });
});
