import { useResumo } from "@/shared/api/endpoints/painel";
import { useFiltros } from "@/shared/filtros/useFiltros";
import { fmtInt } from "@/shared/format/ptBR";

import { BarrasPorNivel } from "./BarrasPorNivel";
import { DispersaoAlturaPeso } from "./DispersaoAlturaPeso";
import { DonutCaloricos } from "./DonutCaloricos";
import { FaixaKpis } from "./FaixaKpis";
import { ImcPorAlcool } from "./ImcPorAlcool";
import { ImcPorAtividade } from "./ImcPorAtividade";
import { ImcPorGenero } from "./ImcPorGenero";
import { PainelGenero } from "./PainelGenero";

/**
 * Visão Geral (§7.3): grid de 12 colunas que colapsa para 1 abaixo de 1100 px. As classes de
 * grid-column aqui são o ÚNICO ponto de layout que a skin de F15 pode mover (§ANCORA).
 */
export function PainelPage() {
  const { filtros } = useFiltros();
  const resumo = useResumo(filtros);
  const d = resumo.data;
  return (
    <div className="flex flex-col gap-3">
      <header className="flex flex-wrap items-end justify-between gap-2">
        <h1 className="text-2xl font-bold">Visão Geral</h1>
        <p aria-live="polite" className="text-sm text-texto-fraco">
          {d ? `Recorte: ${fmtInt(d.total_registros)} de ${fmtInt(d.total_global)} registros` : "Recorte: …"}
        </p>
      </header>
      <div className="grid grid-cols-1 gap-3 min-[1100px]:grid-cols-12" style={{ gridAutoRows: "minmax(90px, auto)" }}>
        <FaixaKpis resumo={resumo} />
        <div className="min-[1100px]:col-span-4">
          <BarrasPorNivel />
        </div>
        <div className="min-[1100px]:col-span-3">
          <PainelGenero />
        </div>
        <div className="min-[1100px]:col-span-2">
          <ImcPorGenero />
        </div>
        <div className="min-[1100px]:col-span-3">
          <DonutCaloricos />
        </div>
        <div className="min-[1100px]:col-span-5">
          <DispersaoAlturaPeso />
        </div>
        <div className="min-[1100px]:col-span-4">
          <ImcPorAtividade />
        </div>
        <div className="min-[1100px]:col-span-3">
          <ImcPorAlcool />
        </div>
      </div>
    </div>
  );
}
