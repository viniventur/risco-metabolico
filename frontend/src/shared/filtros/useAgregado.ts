import { usePorCategoria } from "@/shared/api/endpoints/painel";

import type { FiltroPainel } from "./filtroSchema";

/**
 * `useAgregado(campo, metrica, filtros)` (plano, §12/#7): o agregado longo do recorte, servido de
 * memória pelo FastAPI. O domínio vem completo (grupo ausente = n 0) e o valor de dimensão é
 * SEMPRE string; `dimensoes[].tipo` diz quando converter para número no eixo.
 */
export function useAgregado(campo: string, metrica: "contagem" | "imc_medio", filtros: FiltroPainel, serie?: string) {
  return usePorCategoria(campo, metrica, filtros, serie);
}
