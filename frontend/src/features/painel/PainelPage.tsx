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
import { FaixaKpis } from "./FaixaKpis";
import { FatoresAssociados } from "./FatoresAssociados";
import { FiltrosDoPainel } from "./FiltrosDoPainel";
import { ImcPorAlcool } from "./ImcPorAlcool";
import { ImcPorAtividade } from "./ImcPorAtividade";
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

/** O título de uma parte do painel: a pergunta que os cartões embaixo respondem. */
function TituloDaSecao({ titulo, descricao }: { titulo: string; descricao: string }) {
  return (
    <div className="col-span-full mt-4 flex flex-col gap-0.5 first:mt-0">
      <h2 className="text-lg leading-tight font-semibold tracking-tight">{titulo}</h2>
      <p className="text-sm text-muted-foreground">{descricao}</p>
    </div>
  );
}

/**
 * Visão Geral (§7.3) contada em três partes: QUEM está no recorte (KPIs, níveis e gênero), O QUE ANDA
 * JUNTO com a obesidade (os fatores de hábito e histórico) e O CORPO (altura, peso e IMC). Acima de
 * tudo, a faixa de filtros em dropdowns, presa ao topo no desktop; o clique nos visuais filtra igual.
 * Gráficos em 12 colunas a partir de 1280 px, 2 colunas entre 768 e 1279 px e 1 abaixo disso; os
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
            A base de triagem em indicadores e visuais com filtros cruzados: escolha nos filtros abaixo ou clique numa barra
            para filtrar o painel inteiro. <kbd className="rounded border bg-muted px-1 font-mono text-[11px]">Esc</kbd> limpa os
            filtros.
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
        <FiltrosDoPainel />
        <FaixaKpis resumo={resumo} />
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-12">
          <TituloDaSecao titulo="Quem está no recorte" descricao="Os sete níveis de obesidade em ordem clínica e como eles se dividem entre os gêneros." />
          <div className="md:col-span-2 xl:col-span-7">
            <BarrasPorNivel />
          </div>
          <div className="md:col-span-2 xl:col-span-5">
            <PainelGenero />
          </div>

          <TituloDaSecao
            titulo="O que anda junto com a obesidade"
            descricao="Histórico familiar e hábitos: a composição dos níveis em cada resposta. Associação observada na base — não causa."
          />
          <div className="md:col-span-2 xl:col-span-12">
            <FatoresAssociados />
          </div>

          <TituloDaSecao titulo="O corpo: altura, peso e IMC" descricao="Onde cada nível cai entre as linhas de IMC, e o IMC médio por atividade física e por consumo de álcool." />
          <div className="md:col-span-2 xl:col-span-12">
            <DispersaoAlturaPeso />
          </div>
          <div className="xl:col-span-6">
            <ImcPorAtividade />
          </div>
          <div className="xl:col-span-6">
            <ImcPorAlcool />
          </div>
        </div>
      </div>
    </>
  );
}
