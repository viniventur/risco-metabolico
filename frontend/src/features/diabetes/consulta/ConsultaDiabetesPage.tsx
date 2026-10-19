import { Download } from "lucide-react";

import { PageHeader } from "@/shared/layout/PageHeader";
import { Button } from "@/shared/ui/button";

import { urlExportarDiabetes } from "../api/registros";
import { BotaoLimparFiltrosDiabetes } from "../filtros/BotaoLimparFiltrosDiabetes";
import { FiltrosAtivosDiabetes } from "../filtros/FiltrosAtivosDiabetes";
import { useFiltrosDiabetes } from "../filtros/useFiltrosDiabetes";
import { useAtalhoEscDiabetes } from "../filtros/useLimparFiltrosDiabetes";
import { BarraDeSlicersDiabetes } from "./BarraDeSlicersDiabetes";
import { TabelaRegistrosDiabetes } from "./TabelaRegistrosDiabetes";

/**
 * Consulta da vertente (o desenho da Consulta da obesidade): os 6 slicers e a tabela das 23 colunas.
 * Limpar e exportar ficam juntos no cabeçalho; a exportação sai em streaming e sem teto (o recorte
 * inteiro, gerado em blocos pela API).
 */
export function ConsultaDiabetesPage() {
  const { filtros } = useFiltrosDiabetes();
  useAtalhoEscDiabetes();
  return (
    <>
      <PageHeader
        titulo="Consulta da base de diabetes"
        descricao="As respostas da base, linha a linha, com os seis filtros da Visão Geral. Ordene por qualquer coluna e exporte o recorte inteiro em CSV."
        acoes={
          <>
            <BotaoLimparFiltrosDiabetes />
            <Button asChild>
              <a href={urlExportarDiabetes(filtros)}>
                <Download aria-hidden="true" />
                Exportar CSV
              </a>
            </Button>
          </>
        }
      >
        <FiltrosAtivosDiabetes />
      </PageHeader>
      <div className="flex flex-col gap-4">
        <BarraDeSlicersDiabetes />
        <TabelaRegistrosDiabetes />
      </div>
    </>
  );
}
