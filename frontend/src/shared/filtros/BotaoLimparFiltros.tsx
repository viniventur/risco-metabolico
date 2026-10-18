import { FilterX } from "lucide-react";

import { Button } from "@/shared/ui/button";

import { useLimparFiltros } from "./useLimparFiltros";

/**
 * Um botão só, com rótulo textual, foco visível e 44 px (§7.4) — no painel original eram três
 * visuais empilhados. Fica no cabeçalho das telas que filtram, ao lado do que comanda; desabilitado
 * sem filtro ativo. O atalho Esc (na casca) faz o mesmo.
 */
export function BotaoLimparFiltros() {
  const { vazio, limpar } = useLimparFiltros();
  return (
    <Button variant="outline" onClick={limpar} disabled={vazio} aria-keyshortcuts="Escape" title="Limpar filtros (Esc)">
      <FilterX aria-hidden="true" />
      Limpar filtros
    </Button>
  );
}
