import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { chavesDiabetes } from "../api/chaves";
import type { InfoModeloDiabetes, MetadadosFormularioDiabetes } from "../api/tipos";
import { SimuladorDiabetesPage } from "./SimuladorDiabetesPage";

const campo = (nome: string) => ({ nome, rotulo: nome, tipo: "selecao" as const, minimo: null, maximo: null, passo: null, opcoes: [], padrao: null, ajuda: null });

// O que GET /diabetes/metadata responderia, só com o que a descrição conta: as dez respostas, nos três grupos.
const METADATA: MetadadosFormularioDiabetes = {
  versao_modelo: "1.1.0",
  aviso: "",
  grupos: [
    { id: "dados-iniciais", titulo: "Dados iniciais", campos: ["Faixa_Etaria", "Sexo", "IMC", "Escolaridade"].map(campo) },
    { id: "saude", titulo: "Diagnósticos que você já recebeu", campos: ["Pressao_Alta", "Colesterol_Alto"].map(campo) },
    { id: "habitos", titulo: "Como são seus hábitos?", campos: ["Fumou_100_Cigarros", "Atividade_Fisica_30_Dias", "Fruta_Diaria", "Verdura_Diaria"].map(campo) },
  ],
};

// O que GET /diabetes/model/info responde com o modelo 1.1.0 (artifacts/diabetes/manifest.json).
const INFO: InfoModeloDiabetes = {
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
  split: { linhas_treino: 202944, linhas_teste: 50736 },
  validacao_cruzada: { n_splits: 5, shuffle: true, random_state: 42, roc_auc: 0.8001857588934433, roc_auc_dp: 0.0024, pr_auc: 0.38473200918321665, pr_auc_dp: 0.0074, brier: 0.1014 },
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

function renderizar(info: InfoModeloDiabetes) {
  const cliente = new QueryClient({ defaultOptions: { queries: { retry: false, staleTime: Infinity } } });
  cliente.setQueryData(chavesDiabetes.metadata, METADATA);
  cliente.setQueryData(chavesDiabetes.modelo, info);
  return render(
    <QueryClientProvider client={cliente}>
      <SimuladorDiabetesPage />
    </QueryClientProvider>,
  );
}

describe("SimuladorDiabetesPage", () => {
  it("com limiares_por_idade no manifest, a descrição diz que o limiar do grupo de idade da pessoa classifica", () => {
    renderizar(INFO);
    expect(screen.getByRole("heading", { level: 1, name: "Simulador de triagem de diabetes" })).toBeInTheDocument();
    expect(
      screen.getByText(
        "10 respostas viram a probabilidade de já ter recebido o diagnóstico de diabetes; o limiar do grupo de idade da pessoa a classifica em risco elevado ou baixo. Triagem, não diagnóstico.",
      ),
    ).toBeInTheDocument();
  });

  it("sem eles (um modelo de limiar único), a descrição fala no limiar do modelo", () => {
    renderizar({ ...INFO, versao: "1.0.0", release: "diabetes-v1.0.0", limiares_por_idade: null });
    expect(screen.getByText(/^10 respostas viram a probabilidade de já ter recebido o diagnóstico de diabetes; o limiar do modelo a classifica/)).toBeInTheDocument();
    expect(screen.queryByText(/grupo de idade/)).toBeNull();
  });
});
