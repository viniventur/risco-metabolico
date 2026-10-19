import { useQuery } from "@tanstack/react-query";

import { desembrulhar } from "@/shared/api/endpoints/comum";
import { cliente } from "@/shared/api/http";

import { chavesDiabetes } from "./chaves";

/** GET /diabetes/monitoramento/deriva — a única leitura da vertente que depende do banco; 200 mesmo com ele fora. */
export function useDerivaDiabetes(janelaDias: number, feature?: string) {
  return useQuery({
    queryKey: chavesDiabetes.deriva(janelaDias, feature),
    queryFn: async () =>
      desembrulhar(
        await cliente.GET("/api/v1/diabetes/monitoramento/deriva", {
          params: { query: { janela_dias: janelaDias, ...(feature ? { feature } : {}) } },
        }),
      ),
    staleTime: 300_000,
    placeholderData: (anterior) => anterior,
  });
}
