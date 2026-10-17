import { useQuery } from "@tanstack/react-query";

import type { FiltroPainel } from "@/shared/filtros/filtroSchema";
import { paraQueryString } from "@/shared/filtros/paraQueryString";

import { ORIGEM_API, cliente } from "../http";
import { chaves } from "../queryKeys";
import { desembrulhar } from "./comum";

export type Direcao = "asc" | "desc";

export function useRegistros(filtros: FiltroPainel, pagina: number, tamanho: number, ordenarPor: string, direcao: Direcao) {
  return useQuery({
    queryKey: chaves.registros(filtros, pagina, tamanho, ordenarPor, direcao),
    queryFn: async () =>
      desembrulhar(
        await cliente.GET("/api/v1/registros", {
          params: { query: { pagina, tamanho, ordenar_por: ordenarPor, direcao, ...paraQueryString(filtros) } },
        }),
      ),
    placeholderData: (anterior) => anterior,
  });
}

/** URL de GET /registros/exportar com os filtros correntes (link de download direto). */
export function urlExportar(filtros: FiltroPainel): string {
  const params = new URLSearchParams();
  for (const [nome, valores] of Object.entries(paraQueryString(filtros))) {
    for (const v of valores) params.append(nome, v);
  }
  const qs = params.toString();
  return `${ORIGEM_API}/api/v1/registros/exportar${qs ? `?${qs}` : ""}`;
}
