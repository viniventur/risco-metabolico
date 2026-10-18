import "./legal.css";

import { isValidElement, useMemo, type ReactNode } from "react";
import Markdown, { type Components } from "react-markdown";
import remarkGfm from "remark-gfm";

import { CreditosDoAutor } from "@/shared/autor/CreditosDoAutor";
import { PageHeader } from "@/shared/layout/PageHeader";

import politica from "./politica-privacidade.md?raw";
import { dataPorExtenso, preencher, VERSAO_DOCUMENTO } from "./responsavel";
import { rehypeRotulosDasTabelas } from "./rotulosDasTabelas";

function textoDe(no: ReactNode): string {
  if (no === null || no === undefined || typeof no === "boolean") return "";
  if (typeof no === "string" || typeof no === "number") return String(no);
  if (Array.isArray(no)) return no.map(textoDe).join("");
  if (isValidElement<{ children?: ReactNode }>(no)) return textoDe(no.props.children);
  return "";
}

/** "1. Quem é o responsável" → "1-quem-e-o-responsavel": a âncora do título e do sumário. */
function ancora(texto: string): string {
  return texto
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

const COMPONENTES: Components = {
  h2: ({ children }) => <h2 id={ancora(textoDe(children))}>{children}</h2>,
  // Links para fora em nova aba (a política continua aberta); e-mail e âncoras, na mesma.
  a: ({ href = "", children }) =>
    /^https?:\/\//.test(href) ? (
      <a href={href} target="_blank" rel="noopener noreferrer">
        {children}
      </a>
    ) : (
      <a href={href}>{children}</a>
    ),
};

/**
 * /privacidade — a Política de Privacidade, no padrão dos outros projetos do autor: o texto mora em
 * Markdown (./politica-privacidade.md) e os dados do responsável e os prazos em ./responsavel.ts;
 * quem muda a política mexe lá, não aqui. Os títulos de seção ganham âncora para o sumário.
 */
export function PrivacidadePage() {
  const documento = useMemo(() => preencher(politica), []);
  const sumario = useMemo(() => [...documento.matchAll(/^## (.+)$/gm)].map(([, titulo = ""]) => ({ id: ancora(titulo), titulo })), [documento]);

  return (
    <div className="mx-auto flex max-w-4xl flex-col gap-6">
      <PageHeader
        className="mb-0"
        titulo="Política de Privacidade"
        descricao={`Última atualização: ${dataPorExtenso(VERSAO_DOCUMENTO.data)} · Versão ${VERSAO_DOCUMENTO.numero}`}
      />

      <nav aria-labelledby="sumario-titulo" className="rounded-xl border bg-card p-5 shadow-sm">
        <p id="sumario-titulo" className="text-sm font-semibold">
          Nesta página
        </p>
        <ul className="mt-2 grid gap-x-6 gap-y-1 text-sm sm:grid-cols-2">
          {sumario.map((item) => (
            <li key={item.id}>
              <a href={`#${item.id}`} className="text-primary underline-offset-4 hover:underline">
                {item.titulo}
              </a>
            </li>
          ))}
        </ul>
      </nav>

      <article className="legal-texto">
        <Markdown remarkPlugins={[remarkGfm]} rehypePlugins={[rehypeRotulosDasTabelas]} components={COMPONENTES}>
          {documento}
        </Markdown>
      </article>

      <footer className="flex flex-col gap-3 border-t pt-6 text-sm text-muted-foreground">
        <p>Quem fez o projeto, e os outros projetos, estão no site.</p>
        <CreditosDoAutor className="text-foreground" />
      </footer>
    </div>
  );
}
