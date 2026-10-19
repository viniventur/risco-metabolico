import { useMutation } from "@tanstack/react-query";

import { desembrulhar } from "@/shared/api/endpoints/comum";
import { cliente, paraErroApi, type ErroApi } from "@/shared/api/http";

import type { EntradaDiabetes, RespostaDiabetes } from "./tipos";

/** POST /diabetes/predicoes. Sem retentativa automática: 429 vira faixa de aviso, nunca laço (6.8.3). */
export function usePreverDiabetes() {
  return useMutation<RespostaDiabetes, ErroApi, EntradaDiabetes>({
    mutationFn: async (entrada) => desembrulhar(await cliente.POST("/api/v1/diabetes/predicoes", { body: entrada })),
  });
}

/** POST /diabetes/predicoes/relatorio -> HTML autocontido (text/html). O nome é só metadado do relatório. */
export function useRelatorioDiabetes() {
  return useMutation<string, ErroApi, { entrada: EntradaDiabetes; nome?: string }>({
    mutationFn: async ({ entrada, nome }) => {
      const r = await cliente.POST("/api/v1/diabetes/predicoes/relatorio", {
        body: { entrada, nome: nome ?? "" },
        parseAs: "text",
      });
      if (r.error !== undefined || typeof r.data !== "string") throw paraErroApi(r.response.status, r.error);
      return r.data;
    },
  });
}
