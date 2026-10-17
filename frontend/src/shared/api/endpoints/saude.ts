import { useQuery } from "@tanstack/react-query";

import { cliente } from "../http";
import { chaves } from "../queryKeys";
import { desembrulhar } from "./comum";

/** GET /health — aquecimento no mount e estado "acordando o modelo". Sempre 200 quando a API está no ar. */
export function useSaude() {
  return useQuery({
    queryKey: chaves.saude,
    queryFn: async () => desembrulhar(await cliente.GET("/api/v1/health")),
    staleTime: 30_000,
    retry: 2,
    retryDelay: (tentativa) => Math.min(2_000 * 2 ** tentativa, 15_000),
  });
}
