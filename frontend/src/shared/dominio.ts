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

/**
 * Limites de IMC das faixas de tela (OMS): regra de domínio, não dado. Desenhados como linhas na
 * dispersão altura × peso e usados no cartão de IMC do simulador.
 */
export const LIMITES_IMC = [18.5, 25, 30, 35, 40] as const;

export type MacroFaixa = "abaixo" | "normal" | "sobrepeso" | "obesidade";

/** Faixas de IMC do cartão do simulador (vocabulário de TELA, distinto das 7 classes) e a macro-faixa da cor. */
export function classificarImc(imc: number): { faixa: string; macro: MacroFaixa } {
  const [magreza, normal, sobrepeso, obesidade1, obesidade2] = LIMITES_IMC;
  if (imc < magreza) return { faixa: "Abaixo do Peso", macro: "abaixo" };
  if (imc < normal) return { faixa: "Peso Ideal", macro: "normal" };
  if (imc < sobrepeso) return { faixa: "Sobrepeso", macro: "sobrepeso" };
  if (imc < obesidade1) return { faixa: "Obesidade Grau I", macro: "obesidade" };
  if (imc < obesidade2) return { faixa: "Obesidade Grau II", macro: "obesidade" };
  return { faixa: "Obesidade Grau III", macro: "obesidade" };
}

export function calcularImc(peso: number, altura: number): number {
  return Math.round((peso / (altura * altura)) * 100) / 100;
}

/**
 * A ordem de LEITURA das respostas de frequência (consumo de álcool, lanches entre refeições): a do
 * servidor é a do código de ponto ("Frequentemente" antes de "Não"), que não diz nada a quem lê.
 */
export const ORDEM_FREQUENCIA = ["Não", "Às vezes", "Frequentemente", "Sempre"] as const;

/** Rótulos curtos de apresentação para a escala ordinal de atividade física (eixo; o tooltip mostra o rótulo de /metadata). */
export const ROTULO_CURTO_ATIVIDADE: Record<string, string> = {
  "0": "nenhuma",
  "1": "1–2×/sem",
  "2": "3–4×/sem",
  "3": "5+×/sem",
};
