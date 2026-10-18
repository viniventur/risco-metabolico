import "katex/dist/katex.min.css";

import { isValidElement, type ReactNode } from "react";
import Markdown, { type Components } from "react-markdown";
import rehypeKatex from "rehype-katex";
import remarkGfm from "remark-gfm";
import remarkMath from "remark-math";

import type { Ancora, CelulaMarkdown } from "./tipos";

function textoDe(no: ReactNode): string {
  if (no === null || no === undefined || typeof no === "boolean") return "";
  if (typeof no === "string" || typeof no === "number") return String(no);
  if (Array.isArray(no)) return no.map(textoDe).join("");
  if (isValidElement<{ children?: ReactNode }>(no)) return textoDe(no.props.children);
  return "";
}

function slugDe(s: string): string {
  return (
    s
      .normalize("NFKD")
      .replace(/[^\x20-\x7e]/g, "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "") || "secao"
  );
}

// Os títulos do notebook entram um nível ABAIXO do h1 da página: um único h1 por documento.
const CLASSE_TITULO: Record<number, string> = {
  1: "text-xl font-semibold tracking-tight",
  2: "text-lg font-semibold tracking-tight",
  3: "text-base font-semibold",
  4: "text-sm font-semibold",
};
const TAG_DO_NIVEL = { 1: "h2", 2: "h3", 3: "h4", 4: "h5" } as const;

function fabricarTitulo(nivel: 1 | 2 | 3 | 4, ancoras: Record<string, Ancora>) {
  const Tag = TAG_DO_NIVEL[nivel];
  return function Titulo({ children }: { children?: ReactNode }) {
    const texto = textoDe(children).trim();
    const ancora = ancoras[texto];
    const id = ancora?.id ?? slugDe(texto);
    return (
      <Tag id={id} className={`group mt-6 scroll-mt-20 ${CLASSE_TITULO[nivel]}`}>
        {ancora ? <span className="mr-2 text-muted-foreground tabular-nums">{ancora.numero}</span> : null}
        {children}{" "}
        <a href={`#${id}`} className="text-muted-foreground opacity-0 group-hover:opacity-100 focus:opacity-100" aria-label={`Âncora: ${texto}`}>
          #
        </a>
      </Tag>
    );
  };
}

export function CellMarkdown({ celula }: { celula: CelulaMarkdown }) {
  const componentes: Components = {
    h1: fabricarTitulo(1, celula.anchors),
    h2: fabricarTitulo(2, celula.anchors),
    h3: fabricarTitulo(3, celula.anchors),
    h4: fabricarTitulo(4, celula.anchors),
    a: ({ href, children }) => (
      <a href={href} className="font-medium text-primary underline underline-offset-4" target={href?.startsWith("http") ? "_blank" : undefined} rel="noreferrer">
        {children}
      </a>
    ),
    table: ({ children }) => (
      <div className="overflow-x-auto">
        <table className="my-3 border-collapse overflow-hidden rounded-md border text-sm">{children}</table>
      </div>
    ),
    th: ({ children }) => <th className="border-b bg-muted px-3 py-2 text-left text-xs font-semibold text-muted-foreground">{children}</th>,
    td: ({ children }) => <td className="border-b px-3 py-2">{children}</td>,
    code: ({ children, className }) =>
      className ? (
        <code className={className}>{children}</code>
      ) : (
        <code className="rounded bg-muted px-1.5 py-0.5 font-mono text-[0.85em]">{children}</code>
      ),
    pre: ({ children }) => <pre className="overflow-x-auto rounded-md bg-muted p-4 font-mono text-xs">{children}</pre>,
    ul: ({ children }) => <ul className="my-2 list-disc pl-6">{children}</ul>,
    ol: ({ children }) => <ol className="my-2 list-decimal pl-6">{children}</ol>,
    p: ({ children }) => <p className="my-2 leading-relaxed">{children}</p>,
    blockquote: ({ children }) => <blockquote className="my-3 rounded-r-md border-l-4 border-primary/40 bg-muted/50 py-2 pr-3 pl-4 text-muted-foreground">{children}</blockquote>,
  };
  return (
    <div className="prosa text-sm leading-relaxed text-foreground">
      {/* singleDollarTextMath: false — sem isso, "R$ 1.200" em texto português vira fórmula quebrada. */}
      <Markdown remarkPlugins={[remarkGfm, [remarkMath, { singleDollarTextMath: false }]]} rehypePlugins={[rehypeKatex]} components={componentes}>
        {celula.source}
      </Markdown>
    </div>
  );
}
