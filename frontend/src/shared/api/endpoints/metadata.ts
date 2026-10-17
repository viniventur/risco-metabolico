import { useQuery } from "@tanstack/react-query";

import { cliente } from "../http";
import { chaves } from "../queryKeys";
import { desembrulhar } from "./comum";

/** GET /metadata — a espinha do formulário: campos, tipos, faixas, opções e defaults vêm daqui. */
export function useMetadata() {
  return useQuery({
    queryKey: chaves.metadata,
    queryFn: async () => desembrulhar(await cliente.GET("/api/v1/metadata")),
    staleTime: 3_600_000,
  });
}
