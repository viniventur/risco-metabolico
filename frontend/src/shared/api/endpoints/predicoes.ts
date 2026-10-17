import { useMutation } from "@tanstack/react-query";

import { cliente, paraErroApi, type ErroApi } from "../http";
import { desembrulhar } from "./comum";
import type { EntradaTriagem, RespostaTriagem } from "./tipos";

/** POST /predicoes. Sem retentativa automática: 429 vira faixa de aviso, nunca laço (6.8.3). */
export function usePrever() {
  return useMutation<RespostaTriagem, ErroApi, EntradaTriagem>({
    mutationFn: async (entrada) => desembrulhar(await cliente.POST("/api/v1/predicoes", { body: entrada })),
  });
}

/** POST /predicoes/relatorio -> HTML autocontido (text/html). O nome é só metadado do relatório. */
export function useRelatorio() {
  return useMutation<string, ErroApi, { entrada: EntradaTriagem; nome?: string }>({
    mutationFn: async ({ entrada, nome }) => {
      const r = await cliente.POST("/api/v1/predicoes/relatorio", {
        body: { entrada, nome: nome ?? "" },
        parseAs: "text",
      });
      if (r.error !== undefined || typeof r.data !== "string") throw paraErroApi(r.response.status, r.error);
      return r.data;
    },
  });
}
