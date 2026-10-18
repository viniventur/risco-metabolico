import { Link2 } from "lucide-react";

import { useResumo } from "@/shared/api/endpoints/painel";
import { BotaoLimparFiltros } from "@/shared/filtros/BotaoLimparFiltros";
import { FiltrosAtivos } from "@/shared/filtros/FiltrosAtivos";
import { useFiltros } from "@/shared/filtros/useFiltros";
import { fmtInt } from "@/shared/format/ptBR";
import { PageHeader } from "@/shared/layout/PageHeader";
import { avisar } from "@/shared/ui/avisos";
import { Button } from "@/shared/ui/button";

import { BarrasPorNivel } from "./BarrasPorNivel";
import { DispersaoAlturaPeso } from "./DispersaoAlturaPeso";
import { DonutCaloricos } from "./DonutCaloricos";
import { FaixaKpis } from "./FaixaKpis";
import { ImcPorAlcool } from "./ImcPorAlcool";
import { ImcPorAtividade } from "./ImcPorAtividade";
import { ImcPorGenero } from "./ImcPorGenero";
import { PainelGenero } from "./PainelGenero";

/** O painel se compartilha por link (os filtros moram na URL): copiar é levar o recorte junto. */
function BotaoCompartilhar() {
  async function copiar() {
    try {
      await navigator.clipboard.writeText(window.location.href);
      avisar.sucesso("Link do recorte copiado", "Quem abrir verá o painel com os mesmos filtros.");
    } catch {
      avisar.erro("Não foi possível copiar o link", "Copie o endereço da barra do navegador.");
    }
  }
  return (
    <Button variant="outline" onClick={() => void copiar()}>
      <Link2 aria-hidden="true" />
      Copiar link
    </Button>
  );
}

/**
 * Visão Geral (§7.3) na grade de docs/redesenho-front.md §2.2: um titular e quatro apoios, depois
 * gráficos em 12 colunas a partir de 1280 px, 2 colunas entre 768 e 1279 px e 1 abaixo disso. Os
 * cartões de uma linha têm a mesma altura (ChartFrame estica a área do gráfico até o fundo).
 */
export function PainelPage() {
  const { filtros } = useFiltros();
  const resumo = useResumo(filtros);
  const d = resumo.data;
  return (
    <>
      <PageHeader
        titulo="Visão Geral"
        descricao={
          <>
            A base de triagem em indicadores e sete visuais com filtros cruzados: clique numa barra, fatia ou coluna para filtrar o
            painel inteiro. <kbd className="rounded border bg-muted px-1 font-mono text-[11px]">Esc</kbd> limpa os filtros.
          </>
        }
        acoes={
          <>
            <BotaoCompartilhar />
            <BotaoLimparFiltros />
          </>
        }
      >
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
          <p aria-live="polite" className="text-sm font-medium text-muted-foreground tabular-nums">
            {d ? `Recorte: ${fmtInt(d.total_registros)} de ${fmtInt(d.total_global)} registros` : "Recorte: …"}
          </p>
          <FiltrosAtivos />
        </div>
      </PageHeader>

      <div className="flex flex-col gap-4">
        <FaixaKpis resumo={resumo} />
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-12">
          <div className="md:col-span-2 xl:col-span-7">
            <BarrasPorNivel />
          </div>
          <div className="xl:col-span-5">
            <DonutCaloricos />
          </div>
          <div className="xl:col-span-5">
            <PainelGenero />
          </div>
          <div className="xl:col-span-3">
            <ImcPorGenero />
          </div>
          <div className="xl:col-span-4">
            <ImcPorAlcool />
          </div>
          <div className="md:col-span-2 xl:col-span-7">
            <DispersaoAlturaPeso />
          </div>
          <div className="md:col-span-2 xl:col-span-5">
            <ImcPorAtividade />
          </div>
        </div>
      </div>
    </>
  );
}
