import { useEffect } from "react";

import { useLimparFiltros } from "./useLimparFiltros";

/**
 * Atalho Esc: limpa os 6 filtros (§7.4) nas telas que filtram. Uma camada aberta do Radix (lista de
 * um filtro, gaveta do menu) consome o Esc e marca o evento com `preventDefault`: o primeiro Esc
 * fecha a camada, só o segundo limpa os filtros.
 */
export function useAtalhoEsc(ativo: boolean): void {
  const { vazio, limpar } = useLimparFiltros();
  useEffect(() => {
    if (!ativo) return;
    function aoTeclar(evento: KeyboardEvent) {
      if (evento.key !== "Escape" || evento.defaultPrevented || vazio) return;
      limpar();
    }
    window.addEventListener("keydown", aoTeclar);
    return () => window.removeEventListener("keydown", aoTeclar);
  }, [ativo, vazio, limpar]);
}
