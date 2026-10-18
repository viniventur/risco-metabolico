/**
 * A pessoa pediu menos movimento (`prefers-reduced-motion`)? Toda animação feita em JavaScript
 * consulta aqui e, se sim, entrega o estado final direto. As feitas em CSS se desligam sozinhas (a
 * regra global de tokens.css e o `motion-reduce:` de cada classe). Sem `matchMedia`, anima.
 */
export function pedeMovimentoReduzido(): boolean {
  if (typeof window === "undefined" || !window.matchMedia) return false;
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}
