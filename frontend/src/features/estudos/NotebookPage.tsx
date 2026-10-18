import { useQuery } from "@tanstack/react-query";
import { ChevronRight, Download, ExternalLink } from "lucide-react";
import { useEffect } from "react";
import { Link, useParams } from "react-router-dom";

import { URL_REPO, buscarEstatico } from "@/shared/api/http";
import { chaves } from "@/shared/api/queryKeys";
import { QueryState } from "@/shared/estados/QueryState";
import { fmtDataHora, fmtInt } from "@/shared/format/ptBR";
import { PageHeader } from "@/shared/layout/PageHeader";
import { Button } from "@/shared/ui/button";
import { Skeleton } from "@/shared/ui/skeleton";

import { NotebookRenderer } from "./NotebookRenderer";
import { Sidebar } from "./Sidebar";
import type { DocEstudo } from "./tipos";

const ID_CSS = "pygments-css";

function EsqueletoNotebook() {
  return (
    <div className="grid grid-cols-1 gap-8 lg:grid-cols-[240px_minmax(0,1fr)]">
      <Skeleton className="hidden h-80 lg:block" />
      <div className="flex flex-col gap-4">
        <Skeleton className="h-8 w-2/3" />
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-48 w-full" />
      </div>
    </div>
  );
}

/** Rota /estudos/:slug — o JSON é recurso estático cacheável de public/study, não entra no bundle. */
export function NotebookPage() {
  const { slug = "" } = useParams();
  const q = useQuery({
    queryKey: chaves.estudo(slug),
    queryFn: () => buscarEstatico<DocEstudo>(`/study/${slug}.json`),
    staleTime: Infinity,
    enabled: slug.length > 0,
  });

  // O CSS do Pygments é gerado no build (public/study/pygments.css); entra uma vez, só aqui.
  useEffect(() => {
    if (document.getElementById(ID_CSS)) return;
    const link = document.createElement("link");
    link.id = ID_CSS;
    link.rel = "stylesheet";
    link.href = "/study/pygments.css";
    document.head.appendChild(link);
  }, []);

  const doc = q.data;
  return (
    <>
      <nav aria-label="Trilha" className="mb-3 flex items-center gap-1.5 text-sm text-muted-foreground">
        <Link to="/estudos" className="rounded underline-offset-4 hover:text-foreground hover:underline">
          Estudos
        </Link>
        <ChevronRight aria-hidden="true" className="size-3.5" />
        <span className="truncate text-foreground">{doc?.titulo ?? slug}</span>
      </nav>
      <QueryState carregando={q.isPending} erro={q.error} aoTentarNovamente={() => void q.refetch()} esqueleto={<EsqueletoNotebook />}>
        {doc ? (
          <>
            <PageHeader
              titulo={doc.titulo}
              descricao={`${fmtInt(doc.cells.length)} células · executado em ${fmtDataHora(doc.gerado_em)} · saídas salvas do notebook, renderizadas sem kernel`}
              acoes={
                <>
                  <Button asChild variant="outline">
                    <a href={doc.download} download>
                      <Download aria-hidden="true" />
                      Baixar notebook
                    </a>
                  </Button>
                  {URL_REPO ? (
                    <Button asChild variant="ghost">
                      <a href={`${URL_REPO}/blob/main/${doc.arquivo_origem}`} target="_blank" rel="noreferrer">
                        Ver no repositório
                        <ExternalLink aria-hidden="true" />
                      </a>
                    </Button>
                  ) : null}
                </>
              }
            />
            <div className="grid grid-cols-1 gap-8 lg:grid-cols-[240px_minmax(0,1fr)]">
              <aside className="lg:sticky lg:top-20 lg:max-h-[calc(100vh-6rem)] lg:self-start lg:overflow-y-auto lg:pr-1">
                <Sidebar toc={doc.toc} />
              </aside>
              <article className="min-w-0">
                <NotebookRenderer cells={doc.cells} />
              </article>
            </div>
          </>
        ) : null}
      </QueryState>
    </>
  );
}
