import { useQuery } from "@tanstack/react-query";

import { cliente } from "../http";
import { chaves } from "../queryKeys";
import { desembrulhar } from "./comum";

/** GET /monitoramento/deriva — a única leitura que depende do banco; responde 200 mesmo com ele fora. */
export function useDeriva(janelaDias: number, feature?: string) {
  return useQuery({
    queryKey: chaves.deriva(janelaDias, feature),
    queryFn: async () =>
      desembrulhar(
        await cliente.GET("/api/v1/monitoramento/deriva", {
          params: { query: { janela_dias: janelaDias, ...(feature ? { feature } : {}) } },
        }),
      ),
    staleTime: 300_000,
    placeholderData: (anterior) => anterior,
  });
}
