import { useId } from "react";

import { useGenero } from "@/shared/api/endpoints/painel";
import type { GeneroResumo } from "@/shared/api/endpoints/tipos";
import { QueryState } from "@/shared/estados/QueryState";
import { useFiltros } from "@/shared/filtros/useFiltros";
import { fmtInt, fmtNum, fmtPontosPct } from "@/shared/format/ptBR";
import { cn } from "@/shared/lib/utils";
import { Card } from "@/shared/ui/card";
import { Skeleton } from "@/shared/ui/skeleton";

const ORDEM = ["Feminino", "Masculino"];
/** Regra de cor legítima herdada (§7.3): feminino e masculino, pela entidade. */
const COR: Record<string, { fundo: string; texto: string }> = {
  Feminino: { fundo: "bg-feminino", texto: "text-feminino" },
  Masculino: { fundo: "bg-masculino", texto: "text-masculino" },
};

function PercentBadge({ dado }: { dado: GeneroResumo }) {
  const cor = COR[dado.genero] ?? COR.Masculino!;
  return (
    <div className="flex min-w-0 flex-col">
      <span className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
        <span aria-hidden="true" className={cn("size-2 rounded-full", cor.fundo)} />
        {dado.genero}
      </span>
      <span className={cn("text-2xl leading-tight font-semibold tabular-nums", cor.texto)}>{fmtPontosPct(dado.percentual)}</span>
    </div>
  );
}

/**
 * Divisão por Gênero, sem Recharts (§7.3). Substitui os dois visuais de HTML injetado do painel de
 * referência por JSON tipado formatado aqui. Antes eram duas colunas de 135 px que se sobrepunham
 * (redesenho, 1.1): agora uma barra 100% com os percentuais em cima e uma TABELA embaixo, que
 * distribui a largura pelo conteúdo e deixa o nível quebrar dentro da própria célula.
 */
export function PainelGenero() {
  const { filtros } = useFiltros();
  const q = useGenero(filtros);
  const idTitulo = useId();
  const dados = ORDEM.map((g) => q.data?.find((d) => d.genero === g)).filter((d): d is GeneroResumo => d !== undefined);
  return (
    <Card className="flex h-full flex-col">
      <section className="flex h-full flex-col" aria-labelledby={idTitulo}>
        <header className="p-5 pb-3">
          <h2 id={idTitulo} className="text-[15px] leading-tight font-semibold tracking-tight">
            Divisão por Gênero
          </h2>
          <p className="mt-1 line-clamp-2 min-h-[2lh] text-[13px] leading-snug text-muted-foreground">Participação de cada gênero no recorte, com o IMC médio e o nível mais frequente.</p>
        </header>
        <div className="flex flex-1 flex-col px-5 pb-5">
          <QueryState
            carregando={q.isPending}
            erro={q.error}
            atualizando={q.isFetching && !q.isPending}
            vazio={dados.length === 0}
            aoTentarNovamente={() => void q.refetch()}
            esqueleto={
              <div className="flex flex-col gap-4">
                <Skeleton className="h-10 w-full" />
                <Skeleton className="h-3 w-full rounded-full" />
                <Skeleton className="h-28 w-full" />
              </div>
            }
          >
            <div className="flex h-full flex-col gap-4">
              <div className="flex items-end justify-between gap-4">
                {dados.map((d) => (
                  <PercentBadge key={d.genero} dado={d} />
                ))}
              </div>
              <div className="flex h-2.5 w-full gap-0.5 overflow-hidden rounded-full" aria-hidden="true">
                {dados.map((d) => (
                  <div key={d.genero} className={cn("h-full first:rounded-l-full last:rounded-r-full", COR[d.genero]?.fundo)} style={{ width: `${d.percentual ?? 0}%` }} />
                ))}
              </div>
              <table className="w-full text-[13px]">
                <caption className="sr-only">Indicadores por gênero no recorte</caption>
                <thead>
                  <tr className="border-b">
                    <th scope="col" className="py-2 pr-2 text-left text-xs font-medium text-muted-foreground">
                      <span className="sr-only">Indicador</span>
                    </th>
                    {dados.map((d) => (
                      <th key={d.genero} scope="col" className="py-2 pl-2 text-right text-xs font-medium text-muted-foreground">
                        {d.genero}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  <tr className="border-b">
                    <th scope="row" className="py-2 pr-2 text-left font-normal text-muted-foreground">
                      Registros
                    </th>
                    {dados.map((d) => (
                      <td key={d.genero} className="py-2 pl-2 text-right font-medium tabular-nums">
                        {fmtInt(d.n)}
                      </td>
                    ))}
                  </tr>
                  <tr className="border-b">
                    <th scope="row" className="py-2 pr-2 text-left font-normal text-muted-foreground">
                      IMC médio
                    </th>
                    {dados.map((d) => (
                      <td key={d.genero} className="py-2 pl-2 text-right font-medium tabular-nums">
                        {fmtNum(d.imc_medio, 1)}
                      </td>
                    ))}
                  </tr>
                  <tr>
                    <th scope="row" className="py-2 pr-2 text-left align-top font-normal text-muted-foreground">
                      Nível predominante
                    </th>
                    {dados.map((d) => (
                      <td key={d.genero} className="py-2 pl-2 text-right align-top font-medium">
                        {d.nivel_predominante ?? "—"}
                        {d.nivel_predominante ? <span className="block text-xs font-normal text-muted-foreground tabular-nums">n = {fmtInt(d.n_predominante)}</span> : null}
                      </td>
                    ))}
                  </tr>
                </tbody>
              </table>
            </div>
          </QueryState>
        </div>
      </section>
    </Card>
  );
}
