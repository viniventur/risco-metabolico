import type { UseQueryResult } from "@tanstack/react-query";

import type { ErroApi } from "@/shared/api/http";
import { ErroInline } from "@/shared/estados/ErroInline";
import { fmtDiferenca, fmtDiferencaPontos, fmtInt, fmtNum, fmtPct, fmtPontosPct } from "@/shared/format/ptBR";
import { cn } from "@/shared/lib/utils";
import { KpiCard } from "@/shared/ui/KpiCard";

import { useResumoDiabetes } from "../api/painel";
import type { ResumoDiabetes } from "../api/tipos";
import { FILTRO_VAZIO_DIABETES } from "../filtros/filtroDiabetes";
import { useFiltrosDiabetes } from "../filtros/useFiltrosDiabetes";

/**
 * A fração com diabetes do recorte numa barra de 0 a 100% (o violeta da vertente sobre o trilho do
 * mesmo tom) e, com filtro, o traço da base. Só desenho: o número está escrito ao lado.
 */
function MedidorDiabetes({ prevalencia, base }: { prevalencia: number | null; base: number | null }) {
  return (
    <div aria-hidden="true" className="relative h-2 w-full rounded-full bg-diabetes/20">
      <div className="h-full rounded-full bg-diabetes transition-[width] duration-300 motion-reduce:transition-none" style={{ width: `${prevalencia ?? 0}%` }} />
      {base !== null ? <span className="absolute -top-1 -bottom-1 w-0.5 -translate-x-1/2 rounded-full bg-foreground/80" style={{ left: `${base}%` }} /> : null}
    </div>
  );
}

/**
 * Os KPIs da vertente, com a hierarquia da Visão Geral da obesidade: um TITULAR (respostas no recorte,
 * o número que muda a cada filtro) e dois apoios. O % com diabetes é o indicador da vertente: com
 * filtro, diz o da base e a diferença em pontos percentuais. O IMC médio, com filtro, a diferença para
 * a média da base. Tudo de /diabetes/painel/resumo.
 */
export function FaixaKpisDiabetes({ resumo }: { resumo: UseQueryResult<ResumoDiabetes, ErroApi> }) {
  const { vazio } = useFiltrosDiabetes();
  const base = useResumoDiabetes(FILTRO_VAZIO_DIABETES);
  const d = resumo.data;
  const b = base.data;
  const carregando = resumo.isPending;
  if (resumo.isError && !d) {
    return <ErroInline erro={resumo.error} titulo="Os indicadores não carregaram" aoTentarNovamente={() => void resumo.refetch()} />;
  }
  const fracao = d && d.total_global > 0 ? d.total_registros / d.total_global : null;
  const comparar = !vazio && d !== undefined;
  const diferenca = d && d.prevalencia !== null && d.prevalencia_global !== null ? d.prevalencia - d.prevalencia_global : null;
  const imcBase = comparar && b ? b.imc_medio : null;
  return (
    <div className={cn("grid grid-cols-2 gap-4 lg:grid-cols-3 xl:grid-cols-[1.4fr_1fr_1fr]", resumo.isFetching && !carregando && "refetching")}>
      <KpiCard
        variante="destaque"
        className="col-span-2 lg:col-span-1"
        rotulo="Respostas no recorte"
        valor={fmtInt(d?.total_registros)}
        carregando={carregando}
        detalhe={d ? `de ${fmtInt(d.total_global)} na base · ${fmtPct(fracao)}` : undefined}
      >
        <div className="h-1.5 w-full overflow-hidden rounded-full bg-primary/15" aria-hidden="true">
          <div className="h-full rounded-full bg-primary transition-[width] duration-300" style={{ width: `${Math.round((fracao ?? 0) * 1000) / 10}%` }} />
        </div>
      </KpiCard>
      <KpiCard
        rotulo="Com diabetes"
        valor={fmtPontosPct(d?.prevalencia)}
        carregando={carregando}
        detalhe={
          d ? (
            <span className="tabular-nums">
              {fmtInt(d.n_diabetes)} respostas
              {comparar ? (
                <>
                  {" "}
                  · na base {fmtPontosPct(d.prevalencia_global)} · <span className="font-medium text-foreground">{fmtDiferencaPontos(diferenca)}</span>
                </>
              ) : (
                " com o diagnóstico"
              )}
            </span>
          ) : undefined
        }
      >
        {d ? <MedidorDiabetes prevalencia={d.prevalencia} base={comparar ? d.prevalencia_global : null} /> : null}
      </KpiCard>
      <KpiCard
        rotulo="IMC médio"
        valor={fmtNum(d?.imc_medio, 1)}
        unidade="kg/m²"
        carregando={carregando}
        detalhe={
          imcBase !== null && d?.imc_medio !== null && d?.imc_medio !== undefined ? (
            <span className="tabular-nums">
              na base {fmtNum(imcBase, 1)} · <span className="font-medium text-foreground">{fmtDiferenca(d.imc_medio - imcBase, 1)}</span>
            </span>
          ) : (
            "média das respostas do recorte"
          )
        }
      />
    </div>
  );
}
