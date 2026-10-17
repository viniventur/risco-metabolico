import { useQuery } from "@tanstack/react-query";

import { cliente } from "../http";
import { chaves } from "../queryKeys";
import { desembrulhar } from "./comum";

/** GET /model/info — as métricas vivas do manifest. Nunca hardcode (7.2). */
export function useModelInfo(versao?: string) {
  return useQuery({
    queryKey: chaves.modelo(versao),
    queryFn: async () =>
      desembrulhar(await cliente.GET("/api/v1/model/info", { params: { query: versao ? { versao } : {} } })),
    staleTime: 300_000,
  });
}

export function useImportancia(top = 10) {
  return useQuery({
    queryKey: chaves.importancia(top),
    queryFn: async () => desembrulhar(await cliente.GET("/api/v1/model/feature-importance", { params: { query: { top } } })),
    staleTime: 300_000,
  });
}
