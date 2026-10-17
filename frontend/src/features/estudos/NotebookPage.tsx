import { useQuery } from "@tanstack/react-query";
import { useEffect } from "react";
import { Link, useParams } from "react-router-dom";

import { URL_REPO, buscarEstatico } from "@/shared/api/http";
import { chaves } from "@/shared/api/queryKeys";
import { fmtDataHora } from "@/shared/format/ptBR";
import { IconeBaixar } from "@/shared/ui/icones";
import { QueryState } from "@/shared/ui/QueryState";

import { NotebookRenderer } from "./NotebookRenderer";
import { Sidebar } from "./Sidebar";
import type { DocEstudo } from "./tipos";

const ID_CSS = "pygments-css";

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
    <div className="flex flex-col gap-4">
      <nav aria-label="Trilha" className="text-sm text-texto-fraco">
        <Link to="/estudos" className="underline">
          Estudos
        </Link>{" "}
        / {doc?.titulo ?? slug}
      </nav>
      <QueryState carregando={q.isPending} erro={q.error}>
        {doc ? (
          <>
            <header className="flex flex-wrap items-end justify-between gap-3">
              <div>
                <h1 className="text-2xl font-bold">{doc.titulo}</h1>
                <p className="text-xs text-texto-fraco">
                  {doc.cells.length} células · executado em {fmtDataHora(doc.gerado_em)} · saídas salvas do notebook, renderizadas sem kernel
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <a
                  href={doc.download}
                  download
                  className="flex min-h-11 items-center gap-2 rounded-card border border-borda bg-superficie px-3 text-sm text-texto hover:bg-superficie-alta"
                >
                  <IconeBaixar /> Baixar notebook
                </a>
                {URL_REPO ? (
                  <a
                    href={`${URL_REPO}/blob/main/${doc.arquivo_origem}`}
                    target="_blank"
                    rel="noreferrer"
                    className="flex min-h-11 items-center rounded-card border border-borda bg-superficie px-3 text-sm text-texto hover:bg-superficie-alta"
                  >
                    Ver no repositório
                  </a>
                ) : null}
              </div>
            </header>
            <div className="grid grid-cols-1 gap-6 lg:grid-cols-[220px_minmax(0,1fr)]">
              <aside className="lg:sticky lg:top-4 lg:self-start">
                <Sidebar toc={doc.toc} />
              </aside>
              <article className="min-w-0">
                <NotebookRenderer cells={doc.cells} />
              </article>
            </div>
          </>
        ) : null}
      </QueryState>
    </div>
  );
}
