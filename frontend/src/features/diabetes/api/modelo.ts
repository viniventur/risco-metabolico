import { useQuery } from "@tanstack/react-query";

import { desembrulhar } from "@/shared/api/endpoints/comum";
import { cliente } from "@/shared/api/http";

import { chavesDiabetes } from "./chaves";

/** GET /diabetes/metadata — a espinha do formulário da vertente: campos, tipos, faixas, opções e padrões. */
export function useMetadataDiabetes() {
  return useQuery({
    queryKey: chavesDiabetes.metadata,
    queryFn: async () => desembrulhar(await cliente.GET("/api/v1/diabetes/metadata")),
    staleTime: 3_600_000,
  });
}

/** GET /diabetes/model/info — o manifest da vertente: limiar, métricas de validação e de teste. Nunca hardcode. */
export function useModelInfoDiabetes() {
  return useQuery({
    queryKey: chavesDiabetes.modelo,
    queryFn: async () => desembrulhar(await cliente.GET("/api/v1/diabetes/model/info")),
    staleTime: 300_000,
  });
}
