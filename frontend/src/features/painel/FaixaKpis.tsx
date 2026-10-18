import type { UseQueryResult } from "@tanstack/react-query";
import { CalendarDays, Ruler, Weight } from "lucide-react";

import type { Resumo } from "@/shared/api/endpoints/tipos";
import type { ErroApi } from "@/shared/api/http";
import { ErroInline } from "@/shared/estados/ErroInline";
import { fmtInt, fmtNum, fmtPct } from "@/shared/format/ptBR";
import { KpiCard } from "@/shared/ui/KpiCard";

/**
 * A faixa de KPIs de §7.3 com hierarquia: um TITULAR (registros no recorte, o número que muda a cada
 * clique) e quatro apoios. Correções em relação ao painel de referência: COUNT(*) do recorte (o
 * original contava uma coluna), médias de verdade (o original somava com um TopN parasita) e a MODA
 * explícita para o nível predominante (era Max + TopN). A <Marca> saiu daqui para a barra lateral.
 */
export function FaixaKpis({ resumo }: { resumo: UseQueryResult<Resumo, ErroApi> }) {
  const d = resumo.data;
  const carregando = resumo.isPending;
  if (resumo.isError && !d) {
    return (
      <div className="col-span-full">
        <ErroInline erro={resumo.error} titulo="Os indicadores não carregaram" aoTentarNovamente={() => void resumo.refetch()} />
      </div>
    );
  }
  const fracao = d && d.total_global > 0 ? d.total_registros / d.total_global : null;
  return (
    <div className={`grid grid-cols-2 gap-4 lg:grid-cols-4 xl:grid-cols-[1.5fr_1fr_1fr_1fr_1.25fr] ${resumo.isFetching && !carregando ? "refetching" : ""}`}>
      <KpiCard
        variante="destaque"
        className="col-span-2 lg:col-span-4 xl:col-span-1"
        rotulo="Registros no recorte"
        valor={fmtInt(d?.total_registros)}
        carregando={carregando}
        detalhe={d ? `de ${fmtInt(d.total_global)} na base · ${fmtPct(fracao)}` : undefined}
      >
        <div className="h-1.5 w-full overflow-hidden rounded-full bg-primary/15" aria-hidden="true">
          <div className="h-full rounded-full bg-primary transition-[width] duration-300" style={{ width: `${Math.round((fracao ?? 0) * 1000) / 10}%` }} />
        </div>
      </KpiCard>
      <KpiCard rotulo="Idade média" valor={fmtNum(d?.idade_media, 1)} unidade="anos" carregando={carregando} icone={<CalendarDays />} detalhe="média do recorte" />
      <KpiCard rotulo="Altura média" valor={fmtNum(d?.altura_media, 2)} unidade="m" carregando={carregando} icone={<Ruler />} detalhe="média do recorte" />
      <KpiCard rotulo="Peso médio" valor={fmtNum(d?.peso_medio, 1)} unidade="kg" carregando={carregando} icone={<Weight />} detalhe="média do recorte" />
      <KpiCard
        rotulo="Nível predominante"
        variante="texto"
        valor={d?.nivel_predominante ?? "—"}
        carregando={carregando}
        detalhe={d ? `moda do recorte · n = ${fmtInt(d.n_predominante)}` : undefined}
      />
    </div>
  );
}
