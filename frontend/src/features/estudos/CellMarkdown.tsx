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
  1: "text-2xl font-bold",
  2: "text-xl font-semibold",
  3: "text-lg font-semibold",
  4: "text-base font-semibold",
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
        {ancora ? <span className="mr-2 text-texto-fraco">{ancora.numero}</span> : null}
        {children}{" "}
        <a href={`#${id}`} className="text-texto-fraco opacity-0 group-hover:opacity-100 focus:opacity-100" aria-label={`Âncora: ${texto}`}>
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
      <a href={href} className="text-primaria underline" target={href?.startsWith("http") ? "_blank" : undefined} rel="noreferrer">
        {children}
      </a>
    ),
    table: ({ children }) => (
      <div className="overflow-x-auto">
        <table className="my-2 border-collapse text-sm">{children}</table>
      </div>
    ),
    th: ({ children }) => <th className="border-b border-borda px-2 py-1 text-left font-semibold">{children}</th>,
    td: ({ children }) => <td className="border-b border-borda/50 px-2 py-1">{children}</td>,
    code: ({ children, className }) =>
      className ? (
        <code className={className}>{children}</code>
      ) : (
        <code className="rounded bg-superficie-alta px-1 py-0.5 font-mono text-[0.9em]">{children}</code>
      ),
    pre: ({ children }) => <pre className="overflow-x-auto rounded-card border border-borda bg-superficie-alta/40 p-3 text-xs">{children}</pre>,
    ul: ({ children }) => <ul className="my-2 list-disc pl-6">{children}</ul>,
    ol: ({ children }) => <ol className="my-2 list-decimal pl-6">{children}</ol>,
    p: ({ children }) => <p className="my-2 leading-relaxed">{children}</p>,
    blockquote: ({ children }) => <blockquote className="my-2 border-l-4 border-borda pl-3 text-texto-fraco">{children}</blockquote>,
  };
  return (
    <div className="prosa text-sm text-texto">
      {/* singleDollarTextMath: false — sem isso, "R$ 1.200" em texto português vira fórmula quebrada. */}
      <Markdown remarkPlugins={[remarkGfm, [remarkMath, { singleDollarTextMath: false }]]} rehypePlugins={[rehypeKatex]} components={componentes}>
        {celula.source}
      </Markdown>
    </div>
  );
}
