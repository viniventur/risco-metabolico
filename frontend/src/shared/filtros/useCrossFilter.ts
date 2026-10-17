import { create } from "zustand";

import { useFiltros } from "./useFiltros";
import type { NomeFiltro } from "./filtroSchema";

// Estado EFÊMERO (hover/cross-highlight) numa store pequena: não vai para a URL.
type Destaque = { origem: string; valor: string } | null;

type EstadoDestaque = {
  destaque: Destaque;
  destacar: (origem: string, valor: string) => void;
  limparDestaque: () => void;
};

export const useDestaque = create<EstadoDestaque>((set) => ({
  destaque: null,
  destacar: (origem, valor) => set({ destaque: { origem, valor } }),
  limparDestaque: () => set({ destaque: null }),
}));

/**
 * Cross-filter: o gráfico de ORIGEM apenas destaca (opacidade), os demais filtram.
 * Clique alterna o valor no filtro da URL; o próprio gráfico não se filtra — o eixo não pula e
 * a cor não se remapeia (7.3).
 */
export function useCrossFilter(origem: string, filtro: NomeFiltro) {
  const { filtros, alternar } = useFiltros();
  const { destaque, destacar, limparDestaque } = useDestaque();
  const selecionados = filtros[filtro];

  function opacidade(valor: string): number {
    if (destaque && destaque.origem === origem) return destaque.valor === valor ? 1 : 0.35;
    if (selecionados.length === 0) return 1;
    return selecionados.includes(valor) ? 1 : 0.35;
  }

  return {
    selecionados,
    aoClicar: (valor: string) => alternar(filtro, valor),
    aoEntrar: (valor: string) => destacar(origem, valor),
    aoSair: () => limparDestaque(),
    opacidade,
  };
}
