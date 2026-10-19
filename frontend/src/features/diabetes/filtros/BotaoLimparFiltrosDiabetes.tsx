import { FilterX } from "lucide-react";

import { Button } from "@/shared/ui/button";

import { useLimparFiltrosDiabetes } from "./useLimparFiltrosDiabetes";

/** "Limpar filtros" das telas da vertente (o desenho de shared/filtros/BotaoLimparFiltros); o Esc faz o mesmo. */
export function BotaoLimparFiltrosDiabetes() {
  const { vazio, limpar } = useLimparFiltrosDiabetes();
  return (
    <Button variant="outline" onClick={limpar} disabled={vazio} aria-keyshortcuts="Escape" title="Limpar filtros (Esc)">
      <FilterX aria-hidden="true" />
      Limpar filtros
    </Button>
  );
}
