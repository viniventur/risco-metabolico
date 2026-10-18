import { useGenero } from "@/shared/api/endpoints/painel";
import type { GeneroResumo } from "@/shared/api/endpoints/tipos";
import { ORDEM_CLINICA } from "@/shared/dominio";
import { QueryState } from "@/shared/estados/QueryState";
import { maximoDe, pivotar } from "@/shared/filtros/agregadoUtil";
import { FILTRO_VAZIO } from "@/shared/filtros/filtroSchema";
import { useAgregado } from "@/shared/filtros/useAgregado";
import { useCrossFilter } from "@/shared/filtros/useCrossFilter";
import { useFiltros } from "@/shared/filtros/useFiltros";
import { fmtInt, fmtNum, fmtPontosPct } from "@/shared/format/ptBR";
import { ChartFrame } from "@/shared/graficos/ChartFrame";
import { TabelaEquivalente } from "@/shared/graficos/TabelaEquivalente";
import { cn } from "@/shared/lib/utils";
import { Skeleton } from "@/shared/ui/skeleton";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/shared/ui/tooltip";

import { FUNDO_DO_NIVEL } from "./niveis";

const ORDEM = ["Feminino", "Masculino"] as const;
/** Regra de cor legítima herdada (§7.3): feminino e masculino, pela entidade. */
const COR: Record<string, { fundo: string; texto: string }> = {
  Feminino: { fundo: "bg-feminino", texto: "text-feminino" },
  Masculino: { fundo: "bg-masculino", texto: "text-masculino" },
};

function PercentBadge({ dado, alinhar }: { dado: GeneroResumo; alinhar: "esquerda" | "direita" }) {
  const cor = COR[dado.genero] ?? COR.Masculino!;
  return (
    <div className={cn("flex min-w-0 flex-col", alinhar === "direita" && "items-end text-right")}>
      <span className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
        <span aria-hidden="true" className={cn("size-2 rounded-full", cor.fundo)} />
        {dado.genero}
      </span>
      <span className="text-2xl leading-tight font-semibold tabular-nums">{fmtPontosPct(dado.percentual)}</span>
      <span className="text-xs text-muted-foreground tabular-nums">
        {fmtInt(dado.n)} registros · IMC médio <span className="font-medium text-foreground">{dado.imc_medio === null ? "n < 15" : fmtNum(dado.imc_medio, 1)}</span>
      </span>
    </div>
  );
}

type LinhaPiramide = { nivel: string; Feminino: number; Masculino: number };

/**
 * Uma barra da pirâmide: cresce do centro para fora (feminino à esquerda, masculino à direita), na cor
 * do gênero. O número fica do lado de fora da ponta; a escala é a da base inteira, para o desenho não
 * pular ao filtrar.
 */
function BarraDaPiramide({ genero, n, teto, apagada, aoClicar, nivel }: { genero: string; n: number; teto: number; apagada: boolean; aoClicar: () => void; nivel: string }) {
  const esquerda = genero === "Feminino";
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          type="button"
          onClick={aoClicar}
          aria-label={`${nivel}, ${genero}: ${fmtInt(n)} registros. Filtrar ${genero.toLowerCase()}`}
          className={cn("group flex h-6 min-w-0 items-center gap-1.5", esquerda ? "flex-row-reverse" : "flex-row", apagada && "opacity-35")}
        >
          <span
            className={cn("h-4 transition-[width] duration-300 group-hover:brightness-110 motion-reduce:transition-none", COR[genero]?.fundo, esquerda ? "rounded-l-[4px]" : "rounded-r-[4px]")}
            style={{ width: teto > 0 ? `${(n / teto) * 100}%` : 0 }}
          />
          <span className="shrink-0 text-xs text-muted-foreground tabular-nums">{fmtInt(n)}</span>
        </button>
      </TooltipTrigger>
      <TooltipContent side="top">
        {nivel} · {genero}: {fmtInt(n)} registros
      </TooltipContent>
    </Tooltip>
  );
}

/**
 * Gênero e nível (§7.3, Divisão por Gênero): a participação e o IMC médio de cada gênero no topo e,
 * embaixo, a pirâmide dos 7 níveis — feminino à esquerda, masculino à direita. Ela mostra o que a
 * tabela de antes escondia: na base, Obesidade III é quase toda feminina e Obesidade II quase toda
 * masculina (efeito da parte sintética da base, não um achado clínico). O IMC médio por gênero, que era
 * um gráfico de duas colunas quase iguais, virou número no cabeçalho.
 * ORIGEM de cross-filter de gênero: clicar numa barra filtra o gênero; a pirâmide não se filtra por
 * gênero nem por nível (os níveis fora do filtro só esmaecem).
 */
export function PainelGenero() {
  const { filtros } = useFiltros();
  const cf = useCrossFilter("piramide", "genero");
  // Origem de gênero: os dois gêneros ficam no cartão com o filtro de gênero ligado (o outro esmaece).
  const resumo = useGenero({ ...filtros, genero: [] });
  const q = useAgregado("nivel", "contagem", { ...filtros, genero: [], nivel: [] }, "genero");
  const global = useAgregado("nivel", "contagem", FILTRO_VAZIO, "genero");
  const teto = maximoDe(pivotar(global.data), "contagem");
  const linhas: LinhaPiramide[] = ORDEM_CLINICA.map((nivel) => {
    const linha: LinhaPiramide = { nivel, Feminino: 0, Masculino: 0 };
    for (const l of pivotar(q.data)) if (l.categoria === nivel && l.serie && (l.serie === "Feminino" || l.serie === "Masculino")) linha[l.serie] = l.valores.contagem ?? 0;
    return linha;
  });
  const dados = ORDEM.map((g) => resumo.data?.find((d) => d.genero === g)).filter((d): d is GeneroResumo => d !== undefined);
  const niveisSelecionados = filtros.nivel;

  return (
    <ChartFrame
      titulo="Gênero e Nível de Obesidade"
      descricao="Participação e IMC médio de cada gênero; embaixo, os níveis de cada um. Clique numa barra para filtrar o gênero."
      altura={300}
      alturaNatural
      tabela={
        <TabelaEquivalente
          legenda="Registros por nível de obesidade e gênero"
          colunas={[
            { chave: "nivel", rotulo: "Nível" },
            { chave: "Feminino", rotulo: "Feminino", alinhar: "right" },
            { chave: "Masculino", rotulo: "Masculino", alinhar: "right" },
          ]}
          linhas={linhas.map((l) => ({ nivel: l.nivel, Feminino: fmtInt(l.Feminino), Masculino: fmtInt(l.Masculino) }))}
        />
      }
    >
      <QueryState
        carregando={resumo.isPending || q.isPending}
        erro={resumo.error ?? q.error}
        atualizando={(resumo.isFetching && !resumo.isPending) || (q.isFetching && !q.isPending)}
        vazio={dados.length === 0}
        aoTentarNovamente={() => {
          void resumo.refetch();
          void q.refetch();
        }}
        esqueleto={
          <div className="flex flex-col gap-4">
            <Skeleton className="h-14 w-full" />
            <Skeleton className="h-2.5 w-full rounded-full" />
            <Skeleton className="h-48 w-full" />
          </div>
        }
      >
        <div className="flex h-full flex-col gap-4">
          <div className="flex items-end justify-between gap-4">
            {dados.map((d, i) => (
              <div key={d.genero} className={cn("min-w-0 transition-opacity", cf.opacidade(d.genero) < 1 && "opacity-40")}>
                <PercentBadge dado={d} alinhar={i === 0 ? "esquerda" : "direita"} />
              </div>
            ))}
          </div>
          <div className="flex h-2.5 w-full gap-0.5 overflow-hidden rounded-full" aria-hidden="true">
            {dados.map((d) => (
              <div key={d.genero} className={cn("h-full", COR[d.genero]?.fundo, cf.opacidade(d.genero) < 1 && "opacity-35")} style={{ width: `${d.percentual ?? 0}%` }} />
            ))}
          </div>
          <ul className="flex flex-col" aria-label="Registros por nível, feminino à esquerda e masculino à direita">
            {linhas.map((l) => {
              const apagado = niveisSelecionados.length > 0 && !niveisSelecionados.includes(l.nivel);
              return (
                <li key={l.nivel} className={cn("grid grid-cols-[minmax(0,1fr)_7.5rem_minmax(0,1fr)] items-center gap-2", apagado && "opacity-40")}>
                  <BarraDaPiramide genero="Feminino" n={l.Feminino} teto={teto} nivel={l.nivel} apagada={cf.opacidade("Feminino") < 1} aoClicar={() => cf.aoClicar("Feminino")} />
                  <span className="flex items-center justify-center gap-1.5 text-center text-xs leading-tight">
                    <span aria-hidden="true" className={cn("size-2 shrink-0 rounded-full", FUNDO_DO_NIVEL[l.nivel])} />
                    {l.nivel}
                  </span>
                  <BarraDaPiramide genero="Masculino" n={l.Masculino} teto={teto} nivel={l.nivel} apagada={cf.opacidade("Masculino") < 1} aoClicar={() => cf.aoClicar("Masculino")} />
                </li>
              );
            })}
          </ul>
        </div>
      </QueryState>
    </ChartFrame>
  );
}
