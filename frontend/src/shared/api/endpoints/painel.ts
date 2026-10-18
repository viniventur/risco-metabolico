import { keepPreviousData, useQueries, useQuery } from "@tanstack/react-query";

import type { FiltroPainel } from "@/shared/filtros/filtroSchema";
import { paraQueryString } from "@/shared/filtros/paraQueryString";

import { cliente } from "../http";
import { chaves } from "../queryKeys";
import { desembrulhar } from "./comum";

export function useDimensoes() {
  return useQuery({
    queryKey: chaves.dimensoes,
    queryFn: async () => desembrulhar(await cliente.GET("/api/v1/dimensoes")),
    staleTime: 3_600_000,
  });
}

export function useResumo(filtros: FiltroPainel) {
  return useQuery({
    queryKey: chaves.resumo(filtros),
    queryFn: async () => desembrulhar(await cliente.GET("/api/v1/painel/resumo", { params: { query: paraQueryString(filtros) } })),
    placeholderData: (anterior) => anterior,
  });
}

export type PedidoPorCategoria = { campo: string; metrica: "contagem" | "imc_medio"; filtros: FiltroPainel; serie?: string };

function consultaPorCategoria({ campo, metrica, filtros, serie }: PedidoPorCategoria) {
  return {
    queryKey: chaves.porCategoria(campo, metrica, serie, filtros),
    queryFn: async () =>
      desembrulhar(
        await cliente.GET("/api/v1/painel/por-categoria", {
          params: { query: { campo, metrica, ...(serie ? { serie } : {}), ...paraQueryString(filtros) } },
        }),
      ),
  };
}

/** `useAgregado(campo, metrica, filtros)` do plano (§12/#7), sobre TanStack Query. */
export function usePorCategoria(campo: string, metrica: "contagem" | "imc_medio", filtros: FiltroPainel, serie?: string) {
  return useQuery({ ...consultaPorCategoria({ campo, metrica, filtros, serie }), placeholderData: (anterior) => anterior });
}

/** Vários agregados de uma vez (o gráfico de fatores), com as MESMAS chaves de cache de `usePorCategoria`. */
export function usePorCategorias(pedidos: PedidoPorCategoria[]) {
  return useQueries({
    queries: pedidos.map((p) => ({ ...consultaPorCategoria(p), placeholderData: keepPreviousData })),
  });
}

export function useGenero(filtros: FiltroPainel) {
  return useQuery({
    queryKey: chaves.genero(filtros),
    queryFn: async () => desembrulhar(await cliente.GET("/api/v1/painel/genero", { params: { query: paraQueryString(filtros) } })),
    placeholderData: (anterior) => anterior,
  });
}

export function usePontos(amostra: number, filtros: FiltroPainel) {
  return useQuery({
    queryKey: chaves.pontos(amostra, filtros),
    queryFn: async () =>
      desembrulhar(await cliente.GET("/api/v1/painel/pontos", { params: { query: { amostra, ...paraQueryString(filtros) } } })),
    placeholderData: (anterior) => anterior,
  });
}
