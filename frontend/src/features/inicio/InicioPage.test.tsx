import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it } from "vitest";

import { chaves } from "@/shared/api/queryKeys";
import { ORDEM_CLINICA } from "@/shared/dominio";
import { TooltipProvider } from "@/shared/ui/tooltip";

import { InicioPage } from "./InicioPage";

// O que GET /model/info e GET /metadata responderiam: o Início não tem número do modelo escrito à mão.
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

const campo = (nome: string, rotulo: string) => ({ nome, rotulo, tipo: "selecao", minimo: null, maximo: null, passo: null, opcoes: [], padrao: null, ajuda: null });

const METADATA = {
  versao_modelo: "2.0.0",
  aviso: "",
  grupos: [
    { id: "dados-iniciais", titulo: "Dados iniciais", campos: [campo("Genero", "Gênero"), campo("Idade", "Idade")] },
    { id: "dieta", titulo: "Descreva brevemente sua dieta", campos: [campo("Consumo_Vegetais", "Consumo de vegetais")] },
    { id: "habitos", titulo: "Como são seus hábitos?", campos: [campo("Fumante", "Fumante")] },
  ],
};

function renderizar() {
  const cliente = new QueryClient({ defaultOptions: { queries: { retry: false, staleTime: Infinity } } });
  cliente.setQueryData(chaves.modelo(), INFO);
  cliente.setQueryData(chaves.metadata, METADATA);
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

describe("InicioPage", () => {
  it("o herói: o nome no h1 e 'como funciona' com 16 → 44 → 7, lidos da API", () => {
    renderizar();
    expect(screen.getByRole("heading", { level: 1, name: "Triagem Metabólica" })).toBeInTheDocument();
    expect(finais(screen.getByRole("list", { name: "Como funciona" }))).toEqual(["16", "44", "7"]);
  });

  it("as três métricas do modelo vêm do manifest, já formatadas", () => {
    renderizar();
    expect(finais(screen.getByLabelText("Métricas do modelo em teste"))).toEqual(["98,8%", "98,8%", "99,4%"]);
  });

  it("a visão geral do projeto: objetivo, dados, entradas, métodos, validação e limites, com os números da API", () => {
    renderizar();
    const secao = screen.getByRole("region", { name: "Objetivo, dados e métodos" });
    for (const titulo of ["Objetivo", "Dados", "Entradas", "Métodos", "Validação", "Serviço", "Monitoramento", "Auditoria do legado", "Limitações"]) {
      expect(within(secao).getByText(titulo, { selector: "p" })).toBeInTheDocument();
    }
    // 1.688 + 423 registros; 16 entradas + o alvo; o split; o gap em pontos percentuais.
    expect(finais(secao)).toEqual(expect.arrayContaining(["2.111", "17", "1.688", "423", "1,2 p.p."]));
    expect(within(secao).getByText("4 respostas, em 3 blocos")).toBeInTheDocument();
    expect(within(secao).getByText("Gênero")).toBeInTheDocument();
    expect(within(secao).getByText("Perfil e medidas")).toBeInTheDocument();
    // As 7 faixas em ordem clínica; as 5 de excesso de peso somam o risco acumulado.
    expect(within(within(secao).getByRole("list", { name: "Faixas que somam o risco acumulado" })).getAllByRole("listitem")).toHaveLength(5);
    expect(within(secao).getAllByText("f3b7296728f8").length).toBeGreaterThan(0);
  });

  it("o modelo servido, os atalhos e a autoria com o link para o site e a política de privacidade", () => {
    renderizar();
    expect(screen.getByText("Modelo servido")).toBeInTheDocument();
    const atalhos = screen.getByRole("navigation", { name: "Atalhos" });
    expect(within(atalhos).getAllByRole("link").map((a) => a.getAttribute("href"))).toEqual([
      "/simulador",
      "/painel",
      "/consulta",
      "/monitoramento",
      "/estudos/comparacao-de-modelos",
    ]);
    expect(screen.getByRole("link", { name: /Desenvolvido por Vinícius Ventura/ })).toHaveAttribute("href", "https://viniciusventura.com.br");
    expect(screen.getAllByRole("link", { name: /Política de Privacidade/ })[0]).toHaveAttribute("href", "/privacidade");
  });

  it("a frase de dados fictícios não se repete no Início: ela mora uma vez só, no rodapé da casca", () => {
    renderizar();
    expect(screen.queryByText(/Os dados exibidos são fictícios/)).toBeNull();
  });
});
