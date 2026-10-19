import { keepPreviousData, useQueries, useQuery } from "@tanstack/react-query";

import { desembrulhar } from "@/shared/api/endpoints/comum";
import { cliente } from "@/shared/api/http";

import { paraQueryStringDiabetes, type FiltroDiabetes } from "../filtros/filtroDiabetes";
import { chavesDiabetes } from "./chaves";

/** GET /diabetes/dimensoes — os valores dos 6 filtros (domínio global), com rótulo e contagem na base. */
export function useDimensoesDiabetes() {
  return useQuery({
    queryKey: chavesDiabetes.dimensoes,
    queryFn: async () => desembrulhar(await cliente.GET("/api/v1/diabetes/dimensoes")),
    staleTime: 3_600_000,
  });
}

/** GET /diabetes/painel/resumo — o recorte contra a base inteira (respostas, com diabetes, prevalência, IMC). */
export function useResumoDiabetes(filtros: FiltroDiabetes) {
  return useQuery({
    queryKey: chavesDiabetes.resumo(filtros),
    queryFn: async () =>
      desembrulhar(await cliente.GET("/api/v1/diabetes/painel/resumo", { params: { query: paraQueryStringDiabetes(filtros) } })),
    placeholderData: (anterior) => anterior,
  });
}

export type PedidoPorCategoriaDiabetes = { campo: string; filtros: FiltroDiabetes; serie?: string };

/** As opções de consulta de um agregado por categoria: a mesma chave de cache em todo hook que o pede. */
export function consultaPorCategoriaDiabetes({ campo, filtros, serie }: PedidoPorCategoriaDiabetes) {
  return {
    queryKey: chavesDiabetes.porCategoria(campo, serie, filtros),
    queryFn: async () =>
      desembrulhar(
        await cliente.GET("/api/v1/diabetes/painel/por-categoria", {
          params: { query: { campo, ...(serie ? { serie } : {}), ...paraQueryStringDiabetes(filtros) } },
        }),
      ),
    staleTime: 300_000,
  };
}

/**
 * GET /diabetes/painel/por-categoria — contagem, %, casos e prevalência por grupo, domínio completo,
 * com os rótulos do campo e de cada valor em `campos`. Com o recorte vazio, a mesma consulta é a base
 * dos gráficos e a fonte dos rótulos (useCampoDiabetes): por isso o cache longo.
 */
export function usePorCategoriaDiabetes(campo: string, filtros: FiltroDiabetes, serie?: string) {
  return useQuery({ ...consultaPorCategoriaDiabetes({ campo, filtros, serie }), placeholderData: (anterior) => anterior });
}

/** Vários agregados de uma vez, com as MESMAS chaves de cache de `usePorCategoriaDiabetes`. */
export function usePorCategoriasDiabetes(pedidos: PedidoPorCategoriaDiabetes[]) {
  return useQueries({
    queries: pedidos.map((p) => ({ ...consultaPorCategoriaDiabetes(p), placeholderData: keepPreviousData })),
  });
}

/** GET /diabetes/painel/fatores — as 16 variáveis categóricas × resposta numa requisição, com os rótulos. */
export function useFatoresDiabetes(filtros: FiltroDiabetes) {
  return useQuery({
    queryKey: chavesDiabetes.fatores(filtros),
    queryFn: async () =>
      desembrulhar(await cliente.GET("/api/v1/diabetes/painel/fatores", { params: { query: paraQueryStringDiabetes(filtros) } })),
    staleTime: 300_000,
    placeholderData: (anterior) => anterior,
  });
}
