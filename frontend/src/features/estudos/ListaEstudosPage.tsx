import { useQuery } from "@tanstack/react-query";
import { ArrowRight, BookOpen } from "lucide-react";
import { Link } from "react-router-dom";

import { buscarEstatico } from "@/shared/api/http";
import { chaves } from "@/shared/api/queryKeys";
import { QueryState } from "@/shared/estados/QueryState";
import { fmtDataHora, fmtInt } from "@/shared/format/ptBR";
import { PageHeader } from "@/shared/layout/PageHeader";
import { SeloDoProjeto } from "@/shared/layout/SeloDoProjeto";
import { PROJETOS, projetoDoNotebook } from "@/shared/projetos";
import { Badge } from "@/shared/ui/badge";
import { Skeleton } from "@/shared/ui/skeleton";

import type { EntradaManifesto } from "./tipos";

const ordemDoNotebook = (slug: string) => projetoDoNotebook(slug)?.numero ?? PROJETOS.length + 1;

/** Rota /estudos — lê public/study/manifest.json e lista os notebooks renderizados, cada um com o selo do projeto dele. */
export function ListaEstudosPage() {
  const q = useQuery({
    queryKey: chaves.estudos,
    queryFn: () => buscarEstatico<EntradaManifesto[]>("/study/manifest.json"),
    staleTime: Infinity,
  });
  return (
    <>
      <PageHeader
        titulo="Estudos"
        descricao="Os notebooks que sustentam as decisões de modelagem, renderizados com as saídas salvas — os gráficos Plotly continuam vivos."
      />
      <QueryState
        carregando={q.isPending}
        erro={q.error}
        vazio={q.data?.length === 0}
        tituloVazio="Nenhum notebook publicado"
        aoTentarNovamente={() => void q.refetch()}
        esqueleto={<Skeleton className="h-36 w-full max-w-xl" />}
      >
        <ul className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          {/* Na ordem dos projetos (a diabetes primeiro); um notebook sem projeto fica no fim. */}
          {[...(q.data ?? [])].sort((a, b) => ordemDoNotebook(a.slug) - ordemDoNotebook(b.slug)).map((e) => {
            const projeto = projetoDoNotebook(e.slug);
            return (
              <li key={e.slug}>
                <Link
                  to={`/estudos/${e.slug}`}
                  className="group flex h-full flex-col gap-4 rounded-lg border bg-card p-5 shadow-sm transition-colors hover:border-primary/40 hover:bg-accent/40"
                >
                  <span className="flex items-center justify-between gap-3">
                    <span className="flex size-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
                      <BookOpen aria-hidden="true" className="size-5" />
                    </span>
                    {projeto ? <SeloDoProjeto projeto={projeto} /> : null}
                  </span>
                  <span className="flex items-start justify-between gap-2 text-[15px] leading-snug font-semibold">
                    {e.titulo}
                    <ArrowRight aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
                  </span>
                  <span className="mt-auto flex flex-wrap gap-1.5">
                    <Badge variant="secondary">{fmtInt(e.n_celulas)} células</Badge>
                    <Badge variant="secondary">{fmtInt(e.n_figuras)} figuras</Badge>
                    <Badge variant="outline" className="font-normal text-muted-foreground">
                      executado em {fmtDataHora(e.atualizado_em)}
                    </Badge>
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      </QueryState>
    </>
  );
}
