// Constantes de domínio que o front precisa conhecer para ORDENAR e COLORIR — os valores em si
// vêm sempre da API (/dimensoes, /metadata, /model/info). Espelha dominio/regras.py.
export const ORDEM_CLINICA = [
  "Abaixo do Peso",
  "Peso Normal",
  "Sobrepeso I",
  "Sobrepeso II",
  "Obesidade I",
  "Obesidade II",
  "Obesidade III",
] as const;

export type Nivel = (typeof ORDEM_CLINICA)[number];

export const CLASSES_RISCO: readonly string[] = ORDEM_CLINICA.slice(2);

export const FRASE_DADOS_FICTICIOS =
  "Os dados exibidos são fictícios e servem apenas para demonstração. Nenhum registro corresponde a uma pessoa real. Esta ferramenta é de triagem e não substitui avaliação clínica.";

export const AVISO_REGISTRO_ANONIMO = "As entradas são registradas de forma anônima para monitoramento do modelo.";

/** Faixas de IMC do cartão do simulador (vocabulário de TELA, distinto das 7 classes). */
export function classificarImc(imc: number): { faixa: string; tom: "info" | "sucesso" | "alerta" | "perigo" } {
  if (imc < 18.5) return { faixa: "Abaixo do Peso", tom: "info" };
  if (imc < 25) return { faixa: "Peso Ideal", tom: "sucesso" };
  if (imc < 30) return { faixa: "Sobrepeso", tom: "alerta" };
  if (imc < 35) return { faixa: "Obesidade Grau I", tom: "perigo" };
  if (imc < 40) return { faixa: "Obesidade Grau II", tom: "perigo" };
  return { faixa: "Obesidade Grau III", tom: "perigo" };
}

export function calcularImc(peso: number, altura: number): number {
  return Math.round((peso / (altura * altura)) * 100) / 100;
}

/** Rótulos curtos de apresentação para a escala ordinal de atividade física (eixo; o tooltip mostra o rótulo de /metadata). */
export const ROTULO_CURTO_ATIVIDADE: Record<string, string> = {
  "0": "nenhuma",
  "1": "1–2×/sem",
  "2": "3–4×/sem",
  "3": "5+×/sem",
};

type Forma = "circle" | "square" | "diamond" | "triangle";

/** Forma da marca na dispersão: segundo canal além da cor por macro-faixa (7.3). */
export const FORMA_DO_NIVEL: Record<Nivel, Forma> = {
  "Abaixo do Peso": "circle",
  "Peso Normal": "square",
  "Sobrepeso I": "diamond",
  "Sobrepeso II": "triangle",
  "Obesidade I": "circle",
  "Obesidade II": "square",
  "Obesidade III": "diamond",
};

export const FORMA_LEGENDA: Record<Forma, "circulo" | "quadrado" | "losango" | "triangulo"> = {
  circle: "circulo",
  square: "quadrado",
  diamond: "losango",
  triangle: "triangulo",
};
