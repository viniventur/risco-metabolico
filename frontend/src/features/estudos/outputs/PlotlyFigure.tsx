import type { PlotlyModulo } from "plotly.js-cartesian-dist-min";
import { useEffect, useRef, useState } from "react";

import { useChartTheme } from "@/shared/tema/useChartTheme";

type Props = { data: unknown[]; layout: Record<string, unknown> };

/**
 * Figura Plotly viva (hover, zoom, legenda clicável). O Plotly entra por `import()` dinâmico e só
 * inicializa quando a figura chega perto da viewport; `Plotly.purge()` no unmount — sem isso,
 * navegar entre notebooks vaza dezenas de MB. Fundo transparente para seguir o tema.
 */
export function PlotlyFigure({ data, layout }: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const [visivel, setVisivel] = useState(false);
  const tema = useChartTheme();

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(
      (entradas) => {
        if (entradas.some((e) => e.isIntersecting)) {
          setVisivel(true);
          io.disconnect();
        }
      },
      { rootMargin: "400px" },
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  useEffect(() => {
    if (!visivel) return;
    const el = ref.current;
    if (!el) return;
    let plotly: PlotlyModulo | null = null;
    let cancelado = false;
    void import("plotly.js-cartesian-dist-min").then((modulo) => {
      if (cancelado) return;
      plotly = (modulo.default ?? modulo) as PlotlyModulo;
      const fonte = (layout.font as Record<string, unknown> | undefined) ?? {};
      const layoutTema = {
        ...layout,
        autosize: true,
        paper_bgcolor: "transparent",
        plot_bgcolor: "transparent",
        font: { ...fonte, color: tema.texto },
      };
      // Sem plotlyServerURL e sem o botão de enviar dados para fora: a figura fica na página.
      void plotly.react(el, data, layoutTema, {
        responsive: true,
        displaylogo: false,
        modeBarButtonsToRemove: ["sendDataToCloud"],
      });
    });
    const ro = new ResizeObserver(() => {
      if (plotly) plotly.Plots.resize(el);
    });
    ro.observe(el);
    return () => {
      cancelado = true;
      ro.disconnect();
      if (plotly) plotly.purge(el);
    };
  }, [visivel, data, layout, tema.texto]);

  return (
    <div
      ref={ref}
      className="min-h-[420px] w-full rounded-card border border-borda bg-superficie"
      role="img"
      aria-label={String((layout.title as { text?: string } | undefined)?.text ?? layout.title ?? "Figura interativa")}
    >
      {!visivel ? <p className="p-4 text-xs text-texto-fraco">Figura interativa — carrega ao rolar até aqui.</p> : null}
    </div>
  );
}
