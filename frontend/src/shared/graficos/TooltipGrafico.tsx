import type { ReactNode } from "react";

export type LinhaDoTooltip = { rotulo: string; valor: ReactNode; cor?: string; apagada?: boolean };

/**
 * O balão de todo gráfico, em HTML: título, uma linha por série com a amostra da cor e o valor
 * alinhado à direita. `bg-popover` com borda e sombra, legível nos dois temas. Os conteúdos de
 * <Tooltip content> que o usam continuam declarados FORA do render dos gráficos (§7.3).
 */
export function TooltipGrafico({ titulo, linhas, nota }: { titulo: ReactNode; linhas: LinhaDoTooltip[]; nota?: ReactNode }) {
  return (
    <div className="min-w-40 rounded-md border bg-popover px-3 py-2 text-xs text-popover-foreground shadow-lg">
      <p className="mb-1.5 font-semibold">{titulo}</p>
      <dl className="flex flex-col gap-1">
        {linhas.map((l) => (
          <div key={l.rotulo} className="flex items-center justify-between gap-4">
            <dt className="flex items-center gap-1.5 text-muted-foreground">
              {l.cor ? <span aria-hidden="true" className="inline-block size-2 rounded-[2px]" style={{ background: l.cor }} /> : null}
              {l.rotulo}
            </dt>
            <dd className="font-medium tabular-nums">{l.valor}</dd>
          </div>
        ))}
      </dl>
      {nota ? <p className="mt-1.5 text-[11px] text-muted-foreground">{nota}</p> : null}
    </div>
  );
}
