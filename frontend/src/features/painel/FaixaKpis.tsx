import type { UseQueryResult } from "@tanstack/react-query";

import { useResumo } from "@/shared/api/endpoints/painel";
import type { Resumo } from "@/shared/api/endpoints/tipos";
import type { ErroApi } from "@/shared/api/http";
import { CLASSES_RISCO } from "@/shared/dominio";
import { ErroInline } from "@/shared/estados/ErroInline";
import { FILTRO_VAZIO } from "@/shared/filtros/filtroSchema";
import { useFiltros } from "@/shared/filtros/useFiltros";
import { fmtDiferenca, fmtDiferencaPontos, fmtInt, fmtNum, fmtPct } from "@/shared/format/ptBR";
import { cn } from "@/shared/lib/utils";
import { KpiCard } from "@/shared/ui/KpiCard";
import { Skeleton } from "@/shared/ui/skeleton";

import { BarraDeNiveis } from "./BarraDeNiveis";
import { CLASSES_OBESIDADE, FUNDO_DO_NIVEL, useResumoNiveis } from "./niveis";

/** "na base 73,5% · −3,6 p.p." — só existe com filtro ativo; sem filtro, o recorte É a base. */
function ContraABase({ base, diferenca }: { base: number | null; diferenca: number | null }) {
  return (
    <span className="tabular-nums">
      na base {fmtPct(base)} · <span className="font-medium text-foreground">{fmtDiferencaPontos(diferenca)}</span>
    </span>
  );
}

/**
 * A faixa de KPIs com hierarquia: um TITULAR (registros no recorte, o número que muda a cada filtro)
 * e quatro apoios. Os dois do meio contam a história clínica do recorte — quanto dele está em excesso
 * de peso e em obesidade —, com a barra das 7 classes no degradê de cada família e, com filtro ativo,
 * a diferença para a base inteira (o que o recorte tem de diferente salta sem conta de cabeça).
 * Idade, altura e peso médios, que eram três cartões, dividem um cartão de perfil.
 */
export function FaixaKpis({ resumo }: { resumo: UseQueryResult<Resumo, ErroApi> }) {
  const { filtros, vazio } = useFiltros();
  const global = useResumo(FILTRO_VAZIO);
  const niveis = useResumoNiveis(filtros);
  const niveisGlobal = useResumoNiveis(FILTRO_VAZIO);
  const d = resumo.data;
  const g = global.data;
  const n = niveis.resumo;
  const ng = niveisGlobal.resumo;
  const carregando = resumo.isPending;
  const carregandoNiveis = niveis.isPending;
  if (resumo.isError && !d) {
    return (
      <div className="col-span-full">
        <ErroInline erro={resumo.error} titulo="Os indicadores não carregaram" aoTentarNovamente={() => void resumo.refetch()} />
      </div>
    );
  }
  const fracao = d && d.total_global > 0 ? d.total_registros / d.total_global : null;
  const comparar = !vazio && ng !== undefined;
  const diferencaPontos = (a: number | null | undefined, b: number | null | undefined) =>
    a === null || a === undefined || b === null || b === undefined ? null : (a - b) * 100;
  const atualizando = (resumo.isFetching && !carregando) || (niveis.isFetching && !carregandoNiveis);
  return (
    <div className={cn("grid grid-cols-2 gap-4 lg:grid-cols-4 xl:grid-cols-[1.4fr_1fr_1fr_1.1fr_1.25fr]", atualizando && "refetching")}>
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
      <KpiCard
        rotulo="Excesso de peso"
        valor={fmtPct(n?.excesso)}
        carregando={carregandoNiveis}
        detalhe={comparar ? <ContraABase base={ng.excesso} diferenca={diferencaPontos(n?.excesso, ng.excesso)} /> : "sobrepeso e obesidade"}
      >
        {n ? <BarraDeNiveis porNivel={n.porNivel} total={n.total} destacar={CLASSES_RISCO} /> : null}
      </KpiCard>
      <KpiCard
        rotulo="Obesidade"
        valor={fmtPct(n?.obesidade)}
        carregando={carregandoNiveis}
        detalhe={comparar ? <ContraABase base={ng.obesidade} diferenca={diferencaPontos(n?.obesidade, ng.obesidade)} /> : "obesidade I a III"}
      >
        {n ? <BarraDeNiveis porNivel={n.porNivel} total={n.total} destacar={CLASSES_OBESIDADE} /> : null}
      </KpiCard>
      <KpiCard
        rotulo="Nível predominante"
        variante="texto"
        valor={
          d?.nivel_predominante ? (
            <span className="inline-flex items-center gap-2">
              <span aria-hidden="true" className={cn("size-3 shrink-0 rounded-full", FUNDO_DO_NIVEL[d.nivel_predominante])} />
              {d.nivel_predominante}
            </span>
          ) : (
            "—"
          )
        }
        carregando={carregando}
        detalhe={d ? `moda do recorte · n = ${fmtInt(d.n_predominante)}` : undefined}
      />
      <CartaoPerfil resumo={d} base={comparar ? g : undefined} carregando={carregando} className="col-span-2 lg:col-span-4 xl:col-span-1" />
    </div>
  );
}

/**
 * Idade, altura e peso médios num cartão só: os três descrevem o mesmo "registro típico" do recorte e,
 * em cartões separados, ocupavam a vaga de dois indicadores clínicos. Com filtro, cada um traz a
 * diferença para a média da base.
 */
function CartaoPerfil({ resumo, base, carregando, className }: { resumo?: Resumo; base?: Resumo; carregando: boolean; className?: string }) {
  const linhas = [
    { rotulo: "Idade", valor: resumo?.idade_media, base: base?.idade_media, casas: 1, unidade: "anos" },
    { rotulo: "Altura", valor: resumo?.altura_media, base: base?.altura_media, casas: 2, unidade: "m" },
    { rotulo: "Peso", valor: resumo?.peso_medio, base: base?.peso_medio, casas: 1, unidade: "kg" },
  ];
  return (
    <div className={cn("flex min-w-0 flex-col gap-2 rounded-lg border bg-card p-4 text-card-foreground shadow-sm", className)} aria-busy={carregando || undefined}>
      <span className="text-xs font-medium tracking-wide text-muted-foreground uppercase">Perfil médio</span>
      {carregando ? (
        <>
          <span className="sr-only">Carregando…</span>
          <Skeleton className="h-16 w-full" />
        </>
      ) : (
        <dl className="grid grid-cols-3 gap-2 xl:grid-cols-1 xl:gap-1">
          {linhas.map((l) => (
            <div key={l.rotulo} className="flex min-w-0 flex-col xl:flex-row xl:items-baseline xl:justify-between xl:gap-2">
              <dt className="text-xs text-muted-foreground">{l.rotulo}</dt>
              <dd className="text-base leading-tight font-semibold tabular-nums">
                {fmtNum(l.valor, l.casas)}
                <span className="ml-0.5 text-xs font-normal text-muted-foreground">{l.unidade}</span>
                {l.base !== undefined && l.base !== null && l.valor !== undefined && l.valor !== null ? (
                  <span className="ml-1.5 text-xs font-normal text-muted-foreground">{fmtDiferenca(l.valor - l.base, l.casas)}</span>
                ) : null}
              </dd>
            </div>
          ))}
        </dl>
      )}
      {base ? <p className="mt-auto text-[11px] text-muted-foreground">± diferença para a média da base</p> : null}
    </div>
  );
}
