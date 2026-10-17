import { urlExportar } from "@/shared/api/endpoints/registros";
import { useFiltros } from "@/shared/filtros/useFiltros";
import { IconeBaixar } from "@/shared/ui/icones";

import { BarraDeSlicers } from "./BarraDeSlicers";
import { TabelaRegistros } from "./TabelaRegistros";

/** Consulta (§7.4): os 6 slicers e a tabela de 18 colunas; "Limpar filtros" e Esc vivem no trilho. */
export function ConsultaPage() {
  const { filtros } = useFiltros();
  return (
    <div className="flex flex-col gap-4">
      <header className="flex flex-wrap items-end justify-between gap-2">
        <h1 className="text-2xl font-bold">Consulta</h1>
        <a
          href={urlExportar(filtros)}
          className="flex min-h-11 items-center gap-2 rounded-card border border-borda bg-superficie px-3 text-sm text-texto hover:bg-superficie-alta"
        >
          <IconeBaixar /> Exportar CSV
        </a>
      </header>
      <BarraDeSlicers />
      <TabelaRegistros />
    </div>
  );
}
