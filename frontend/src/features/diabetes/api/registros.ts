import { useQuery } from "@tanstack/react-query";

import { desembrulhar } from "@/shared/api/endpoints/comum";
import type { Direcao } from "@/shared/api/endpoints/registros";
import { ORIGEM_API, cliente } from "@/shared/api/http";

import { paraQueryStringDiabetes, type FiltroDiabetes } from "../filtros/filtroDiabetes";
import { chavesDiabetes } from "./chaves";

/** GET /diabetes/registros — página ordenada do recorte, com as 23 colunas (ordenação e paginação no servidor). */
export function useRegistrosDiabetes(filtros: FiltroDiabetes, pagina: number, tamanho: number, ordenarPor: string, direcao: Direcao) {
  return useQuery({
    queryKey: chavesDiabetes.registros(filtros, pagina, tamanho, ordenarPor, direcao),
    queryFn: async () =>
      desembrulhar(
        await cliente.GET("/api/v1/diabetes/registros", {
          params: { query: { pagina, tamanho, ordenar_por: ordenarPor, direcao, ...paraQueryStringDiabetes(filtros) } },
        }),
      ),
    placeholderData: (anterior) => anterior,
  });
}

/** URL de GET /diabetes/registros/exportar com os filtros correntes: o recorte inteiro, em streaming e sem teto. */
export function urlExportarDiabetes(filtros: FiltroDiabetes): string {
  const params = new URLSearchParams();
  for (const [nome, valores] of Object.entries(paraQueryStringDiabetes(filtros))) {
    for (const v of valores) params.append(nome, v);
  }
  const qs = params.toString();
  return `${ORIGEM_API}/api/v1/diabetes/registros/exportar${qs ? `?${qs}` : ""}`;
}
