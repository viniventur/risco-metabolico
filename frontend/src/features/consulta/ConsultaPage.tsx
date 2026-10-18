import { Download } from "lucide-react";

import { urlExportar } from "@/shared/api/endpoints/registros";
import { BotaoLimparFiltros } from "@/shared/filtros/BotaoLimparFiltros";
import { FiltrosAtivos } from "@/shared/filtros/FiltrosAtivos";
import { useFiltros } from "@/shared/filtros/useFiltros";
import { PageHeader } from "@/shared/layout/PageHeader";
import { Button } from "@/shared/ui/button";

import { BarraDeSlicers } from "./BarraDeSlicers";
import { TabelaRegistros } from "./TabelaRegistros";

/**
 * Consulta (§7.4): os 6 slicers e a tabela de 18 colunas. As duas ações sobre o recorte — limpar e
 * exportar — ficam juntas no cabeçalho (antes, uma no pé do trilho e outra no canto oposto).
 */
export function ConsultaPage() {
  const { filtros } = useFiltros();
  return (
    <>
      <PageHeader
        titulo="Consulta"
        descricao="Os registros da base, linha a linha, com seis filtros que valem também para a Visão Geral. Ordene por qualquer coluna e exporte o recorte em CSV."
        acoes={
          <>
            <BotaoLimparFiltros />
            <Button asChild>
              <a href={urlExportar(filtros)}>
                <Download aria-hidden="true" />
                Exportar CSV
              </a>
            </Button>
          </>
        }
      >
        <FiltrosAtivos />
      </PageHeader>
      <div className="flex flex-col gap-4">
        <BarraDeSlicers />
        <TabelaRegistros />
      </div>
    </>
  );
}
