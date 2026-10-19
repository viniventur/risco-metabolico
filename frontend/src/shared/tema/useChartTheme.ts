import { useMemo } from "react";

import { useTema } from "./useTema";

function lerVar(nome: string): string {
  if (typeof window === "undefined") return "";
  const trio = getComputedStyle(document.documentElement).getPropertyValue(nome).trim();
  return trio ? `hsl(${trio})` : "";
}

export type TemaGrafico = {
  primaria: string;
  /** o resultado da previsão (a classe estimada): o magenta da marca, e só ele */
  previsao: string;
  secundaria: string;
  feminino: string;
  masculino: string;
  texto: string;
  textoFraco: string;
  grade: string;
  eixo: string;
  superficie: string;
  /** macro-faixa (rampa ordinal de 4 tons) — ponto do nível na tabela, classe estimada, cartão de IMC */
  corDaMacroFaixa: Record<string, string>;
  /** os 7 níveis: a matiz da macro-faixa com um degradê por grau dentro da família (a Visão Geral) */
  corDoNivel: Record<string, string>;
  /** vertente diabetes: "com diabetes", a cor de todos os gráficos dela */
  diabetes: string;
};

/** Nível clínico -> token da macro-faixa (a cor segue a ENTIDADE, nunca o índice do array). */
export const MACRO_FAIXA: Record<string, "abaixo" | "normal" | "sobrepeso" | "obesidade"> = {
  "Abaixo do Peso": "abaixo",
  "Peso Normal": "normal",
  "Sobrepeso I": "sobrepeso",
  "Sobrepeso II": "sobrepeso",
  "Obesidade I": "obesidade",
  "Obesidade II": "obesidade",
  "Obesidade III": "obesidade",
};

/** Nível clínico -> token do nível: a família (matiz) e o grau dentro dela (o passo do degradê). */
export const TOKEN_DO_NIVEL: Record<string, string> = {
  "Abaixo do Peso": "--nivel-abaixo",
  "Peso Normal": "--nivel-normal",
  "Sobrepeso I": "--nivel-sobrepeso-1",
  "Sobrepeso II": "--nivel-sobrepeso-2",
  "Obesidade I": "--nivel-obesidade-1",
  "Obesidade II": "--nivel-obesidade-2",
  "Obesidade III": "--nivel-obesidade-3",
};

function montar(): TemaGrafico {
  const corDaMacroFaixa: Record<string, string> = {};
  for (const [nivel, faixa] of Object.entries(MACRO_FAIXA)) corDaMacroFaixa[nivel] = lerVar(`--faixa-${faixa}`);
  const corDoNivel: Record<string, string> = {};
  for (const [nivel, token] of Object.entries(TOKEN_DO_NIVEL)) corDoNivel[nivel] = lerVar(token);
  return {
    primaria: lerVar("--grafico-primaria"),
    previsao: lerVar("--previsao"),
    secundaria: lerVar("--grafico-secundaria"),
    feminino: lerVar("--feminino"),
    masculino: lerVar("--masculino"),
    texto: lerVar("--foreground"),
    textoFraco: lerVar("--muted-foreground"),
    grade: lerVar("--border"),
    eixo: lerVar("--muted-foreground"),
    superficie: lerVar("--card"),
    corDaMacroFaixa,
    corDoNivel,
    diabetes: lerVar("--diabetes"),
  };
}

/**
 * Os tokens de cor como VALORES (`hsl(...)`), porque o Recharts e o Plotly escrevem a cor em
 * atributo de SVG, onde `var()` não resolve de forma confiável. Recalcula quando o tema muda.
 */
export function useChartTheme(): TemaGrafico {
  const { tema } = useTema();
  // eslint-disable-next-line react-hooks/exhaustive-deps -- `tema` é o gatilho: os valores vêm do CSS vigente
  return useMemo(() => montar(), [tema]);
}
