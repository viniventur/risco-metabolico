import { useDestaque } from "@/shared/filtros/useCrossFilter";

import type { NomeFiltroDiabetes } from "./filtroDiabetes";
import { useFiltrosDiabetes } from "./useFiltrosDiabetes";

/**
 * Cross-filter da vertente, no desenho de shared/filtros/useCrossFilter: o gráfico de ORIGEM só
 * destaca (opacidade), os demais filtram; o clique alterna o valor no filtro da URL. O destaque do
 * hover é a mesma store efêmera (não vai para a URL), com origens próprias ("diabetes-…").
 */
export function useCrossFilterDiabetes(origem: string, filtro: NomeFiltroDiabetes) {
  const { filtros, alternar } = useFiltrosDiabetes();
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
