import type { TemaGrafico } from "@/shared/tema/useChartTheme";

/** Tamanho dos ticks (design-tokens.md). Vai por PROP: o Recharts 3 não deixa o CSS alcançar o texto do tick. */
export const FONTE_DO_EIXO = 12;

/** Props comuns de todo eixo: tick a 12 px na cor fraca, sem traço de tick, linha do eixo na cor da grade. */
export function propsDoEixo(tema: TemaGrafico) {
  return {
    tick: { fontSize: FONTE_DO_EIXO, fill: tema.eixo },
    tickLine: false,
    axisLine: { stroke: tema.grade },
    stroke: tema.grade,
  } as const;
}

/**
 * Largura do eixo de categorias a partir do maior rótulo: ~7 px por caractere a 12 px, mais folga.
 * Antes as larguras eram fixas e cortavam "Frequentemente" e "Abaixo do Peso" (redesenho, 1.3).
 */
export function larguraDoRotulo(rotulos: string[], minimo = 48): number {
  const maior = rotulos.reduce((m, r) => Math.max(m, r.length), 0);
  return Math.max(minimo, Math.ceil(maior * 7 + 12));
}

/** Domínio "redondo" [piso, teto] em múltiplos de `passo` — derivado do dado, nunca escrito à mão. */
export function dominioRedondo(minimo: number, maximo: number, passo: number): [number, number] {
  return [Math.floor(minimo / passo) * passo, Math.ceil(maximo / passo) * passo];
}

/** Ticks de `inicio` a `fim` em passos de `passo` (arredondados para não acumular erro de ponto flutuante). */
export function ticksEntre(inicio: number, fim: number, passo: number): number[] {
  const saida: number[] = [];
  for (let v = inicio; v <= fim + passo / 1000; v += passo) saida.push(Math.round(v * 1000) / 1000);
  return saida;
}
