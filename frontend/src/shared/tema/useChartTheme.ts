import { useEffect, useState } from "react";

import { ORDEM_CLINICA } from "@/shared/dominio";

function lerVar(nome: string): string {
  if (typeof window === "undefined") return "";
  return getComputedStyle(document.documentElement).getPropertyValue(nome).trim();
}

export type TemaGrafico = {
  primaria: string;
  secundaria: string;
  rosa: string;
  azulClaro: string;
  texto: string;
  textoFraco: string;
  grade: string;
  eixo: string;
  superficie: string;
  /** cor por ENTIDADE (nível clínico), nunca por índice do array */
  corDoNivel: Record<string, string>;
  /** macro-faixa (4 tons de uma rampa ordinal) para a dispersão */
  corDaMacroFaixa: Record<string, string>;
};

const MACRO: Record<string, string> = {
  "Abaixo do Peso": "--faixa-abaixo",
  "Peso Normal": "--faixa-normal",
  "Sobrepeso I": "--faixa-sobrepeso",
  "Sobrepeso II": "--faixa-sobrepeso",
  "Obesidade I": "--faixa-obesidade",
  "Obesidade II": "--faixa-obesidade",
  "Obesidade III": "--faixa-obesidade",
};

function montar(): TemaGrafico {
  const corDoNivel: Record<string, string> = {};
  ORDEM_CLINICA.forEach((nivel, i) => {
    corDoNivel[nivel] = lerVar(`--nivel-${i + 1}`);
  });
  const corDaMacroFaixa: Record<string, string> = {};
  for (const [nivel, variavel] of Object.entries(MACRO)) corDaMacroFaixa[nivel] = lerVar(variavel);
  return {
    primaria: lerVar("--primaria"),
    secundaria: lerVar("--secundaria"),
    rosa: lerVar("--rosa"),
    azulClaro: lerVar("--azul-claro"),
    texto: lerVar("--texto"),
    textoFraco: lerVar("--texto-fraco"),
    grade: lerVar("--grade"),
    eixo: lerVar("--eixo"),
    superficie: lerVar("--superficie"),
    corDoNivel,
    corDaMacroFaixa,
  };
}

/** Lê os tokens de cor do <html> e reage à troca de data-theme (o Recharts/Plotly recebem valores, não var()). */
export function useChartTheme(): TemaGrafico {
  const [tema, setTema] = useState<TemaGrafico>(() => montar());
  useEffect(() => {
    const observador = new MutationObserver(() => setTema(montar()));
    observador.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const aoMudar = () => setTema(montar());
    mq.addEventListener("change", aoMudar);
    return () => {
      observador.disconnect();
      mq.removeEventListener("change", aoMudar);
    };
  }, []);
  return tema;
}
