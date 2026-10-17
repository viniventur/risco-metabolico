import { useId } from "react";

import { useGenero } from "@/shared/api/endpoints/painel";
import type { GeneroResumo } from "@/shared/api/endpoints/tipos";
import { useFiltros } from "@/shared/filtros/useFiltros";
import { fmtInt, fmtNum, fmtPontosPct } from "@/shared/format/ptBR";
import { QueryState } from "@/shared/ui/QueryState";

type Tom = "rosa" | "azul-claro";

const TOM: Record<string, Tom> = { Feminino: "rosa", Masculino: "azul-claro" };

function PercentBadge({ valor, tom }: { valor: number | null; tom: Tom }) {
  const classe = tom === "rosa" ? "bg-rosa/15 text-rosa" : "bg-azul-claro/15 text-azul-claro";
  return <span className={`inline-block rounded-full px-3 py-1 text-xl font-bold tabular-nums ${classe}`}>{fmtPontosPct(valor)}</span>;
}

/** Substitui os dois visuais de HTML injetado do painel de referência: JSON tipado, formatado aqui. */
function AnaliseGenero({ dado }: { dado: GeneroResumo }) {
  const tom = TOM[dado.genero] ?? "azul-claro";
  const borda = tom === "rosa" ? "border-rosa" : "border-azul-claro";
  return (
    <article className={`flex flex-col gap-2 rounded-card border-t-4 bg-superficie-alta/40 p-3 ${borda}`} aria-label={dado.genero}>
      <header className="flex items-center justify-between gap-2">
        <h3 className="text-base font-semibold">{dado.genero}</h3>
        <PercentBadge valor={dado.percentual} tom={tom} />
      </header>
      <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-sm">
        <dt className="text-texto-fraco">Registros</dt>
        <dd className="tabular-nums">{fmtInt(dado.n)}</dd>
        <dt className="text-texto-fraco">IMC médio</dt>
        <dd className="tabular-nums">{fmtNum(dado.imc_medio, 1)}</dd>
        <dt className="text-texto-fraco">Nível predominante</dt>
        <dd>
          {dado.nivel_predominante ?? "—"}
          {dado.nivel_predominante ? <span className="text-texto-fraco"> (n = {fmtInt(dado.n_predominante)})</span> : null}
        </dd>
      </dl>
    </article>
  );
}

export function PainelGenero() {
  const { filtros } = useFiltros();
  const q = useGenero(filtros);
  const idTitulo = useId();
  return (
    <section className="cartao flex h-full flex-col gap-3 p-4" aria-labelledby={idTitulo}>
      <h2 id={idTitulo} className="text-base font-semibold text-texto">
        Divisão por Gênero
      </h2>
      <QueryState carregando={q.isPending} erro={q.error} atualizando={q.isFetching && !q.isPending} vazio={q.data?.length === 0}>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {(q.data ?? []).map((g) => (
            <AnaliseGenero key={g.genero} dado={g} />
          ))}
        </div>
      </QueryState>
    </section>
  );
}
