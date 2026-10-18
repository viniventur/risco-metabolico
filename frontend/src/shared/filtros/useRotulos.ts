import { useCallback } from "react";

import { useDimensoes } from "@/shared/api/endpoints/painel";
import { ROTULO_CURTO_ATIVIDADE } from "@/shared/dominio";

/**
 * Escalas ordinais: eixo pelo inteiro, rótulo pelo texto (7.3). Os rótulos das 6 dimensões
 * filtráveis vêm de /dimensoes ("<1L", "1-2L", ">2L"); a atividade física usa o rótulo curto.
 */
export function useRotulos() {
  const dimensoes = useDimensoes();
  return useCallback(
    (campo: string, valor: string): string => {
      if (campo === "atividade") return ROTULO_CURTO_ATIVIDADE[valor] ?? valor;
      const opcoes = dimensoes.data?.[campo];
      const opcao = opcoes?.find((o) => String(o.valor) === valor);
      return opcao?.rotulo ?? valor;
    },
    [dimensoes.data],
  );
}
