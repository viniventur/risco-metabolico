import DOMPurify from "dompurify";
import { ChevronDown } from "lucide-react";
import { useId, useMemo, useState } from "react";

import { cn } from "@/shared/lib/utils";

import { HtmlOutput } from "./outputs/HtmlOutput";
import { PlotlyFigure } from "./outputs/PlotlyFigure";
import type { CelulaCodigo, Saida } from "./tipos";

function SaidaCelula({ saida }: { saida: Saida }) {
  switch (saida.kind) {
    case "plotly":
      return <PlotlyFigure data={saida.data} layout={saida.layout} />;
    case "png":
      return <img src={saida.src} alt={saida.alt} loading="lazy" className="max-w-full rounded-md border bg-papel" />;
    case "html":
      return <HtmlOutput html={saida.html} />;
    case "texto":
      return <pre className="overflow-x-auto font-mono text-xs leading-relaxed whitespace-pre-wrap text-foreground">{saida.texto}</pre>;
  }
}

/**
 * Prompt `In [n]`, código já realçado no build (Pygments, com tema claro e escuro em
 * public/study/pygments.css) e as saídas, que se recolhem por um botão de verdade.
 */
export function CellCode({ celula }: { celula: CelulaCodigo }) {
  const [aberto, setAberto] = useState(true);
  const idSaidas = useId();
  const codigo = useMemo(() => DOMPurify.sanitize(celula.codeHtml), [celula.codeHtml]);
  const prompt = celula.execution_count === null ? "In [ ]" : `In [${celula.execution_count}]`;
  return (
    <div className="flex flex-col gap-2" id={celula.execution_count === null ? undefined : `in-${celula.execution_count}`}>
      <div className="flex min-w-0 flex-col gap-1 sm:flex-row sm:items-start sm:gap-3">
        <span className="shrink-0 pt-3 font-mono text-[11px] text-muted-foreground sm:w-14 sm:text-right">{prompt}</span>
        <pre className="hl min-w-0 flex-1 overflow-x-auto rounded-md p-4 font-mono text-xs leading-relaxed ring-1 ring-border">
          <code dangerouslySetInnerHTML={{ __html: codigo }} />
        </pre>
      </div>
      {celula.outputs.length > 0 ? (
        <div className="flex min-w-0 flex-col gap-2 sm:pl-[4.25rem]">
          <button
            type="button"
            onClick={() => setAberto((v) => !v)}
            aria-expanded={aberto}
            aria-controls={idSaidas}
            className="alvo-toque inline-flex h-7 w-fit items-center gap-1 rounded-md px-2 text-xs font-medium text-muted-foreground hover:bg-accent hover:text-foreground"
          >
            <ChevronDown aria-hidden="true" className={cn("size-3.5 transition-transform", !aberto && "-rotate-90")} />
            {aberto ? "Ocultar saída" : "Mostrar saída"}
          </button>
          {aberto ? (
            <div id={idSaidas} className="flex min-w-0 flex-col gap-3">
              {celula.outputs.map((s, i) => (
                <SaidaCelula key={i} saida={s} />
              ))}
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
