import DOMPurify from "dompurify";
import { useMemo, useState } from "react";

import { HtmlOutput } from "./outputs/HtmlOutput";
import { PlotlyFigure } from "./outputs/PlotlyFigure";
import type { CelulaCodigo, Saida } from "./tipos";

function SaidaCelula({ saida }: { saida: Saida }) {
  switch (saida.kind) {
    case "plotly":
      return <PlotlyFigure data={saida.data} layout={saida.layout} />;
    case "png":
      return <img src={saida.src} alt={saida.alt} loading="lazy" className="max-w-full rounded-card border border-borda bg-superficie" />;
    case "html":
      return <HtmlOutput html={saida.html} />;
    case "texto":
      return <pre className="overflow-x-auto whitespace-pre-wrap text-xs text-texto">{saida.texto}</pre>;
  }
}

/** Prompt `In [n]`, código já realçado no build (Pygments) e bloco de saídas colapsável. */
export function CellCode({ celula }: { celula: CelulaCodigo }) {
  const [aberto, setAberto] = useState(true);
  const codigo = useMemo(() => DOMPurify.sanitize(celula.codeHtml), [celula.codeHtml]);
  const prompt = celula.execution_count === null ? "In [ ]" : `In [${celula.execution_count}]`;
  return (
    <div className="flex flex-col gap-1" id={celula.execution_count === null ? undefined : `in-${celula.execution_count}`}>
      <div className="flex items-start gap-2">
        <span className="w-16 shrink-0 pt-2 text-right font-mono text-xs text-texto-fraco">{prompt}:</span>
        <pre className="hl min-w-0 flex-1 overflow-x-auto rounded-card border border-borda bg-superficie-alta/40 p-3 text-xs leading-relaxed">
          <code dangerouslySetInnerHTML={{ __html: codigo }} />
        </pre>
      </div>
      {celula.outputs.length > 0 ? (
        <div className="flex items-start gap-2">
          <button
            type="button"
            onClick={() => setAberto((v) => !v)}
            aria-expanded={aberto}
            className="w-16 shrink-0 pt-1 text-right font-mono text-[11px] text-texto-fraco underline"
          >
            {aberto ? "Ocultar saída" : "Mostrar saída"}
          </button>
          {aberto ? (
            <div className="flex min-w-0 flex-1 flex-col gap-2 py-1">
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
