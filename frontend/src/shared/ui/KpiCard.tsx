import type { ReactNode } from "react";

import { cn } from "@/shared/lib/utils";

import { Skeleton } from "./skeleton";

type Props = {
  rotulo: string;
  /** o número já formatado (ou o nome, na variante `texto`, que pode vir com a amostra da cor da classe) */
  valor: ReactNode;
  unidade?: string;
  /** texto secundário (ex.: "n = 351") */
  detalhe?: ReactNode;
  /** `destaque`: o número titular da faixa; `texto`: o valor é uma palavra (nível predominante) */
  variante?: "numero" | "texto" | "destaque";
  carregando?: boolean;
  icone?: ReactNode;
  /** Conteúdo extra embaixo (a barra da fração do recorte no titular). */
  children?: ReactNode;
  className?: string;
};

/** Cartão de KPI sem Recharts (§7.3): rótulo em caixa alta, número tabular e uma linha de contexto. */
export function KpiCard({ rotulo, valor, unidade, detalhe, variante = "numero", carregando, icone, children, className }: Props) {
  const destaque = variante === "destaque";
  return (
    <div
      className={cn(
        "flex min-w-0 flex-col justify-between gap-2 rounded-lg border bg-card p-4 text-card-foreground shadow-sm",
        destaque && "bg-gradient-to-br from-primary/12 via-card to-card p-5 ring-1 ring-primary/20",
        className,
      )}
      aria-busy={carregando || undefined}
    >
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs font-medium tracking-wide text-muted-foreground uppercase">{rotulo}</span>
        {icone ? <span className="text-muted-foreground [&_svg]:size-4" aria-hidden="true">{icone}</span> : null}
      </div>
      {carregando ? (
        <>
          <span className="sr-only">Carregando…</span>
          <Skeleton className={cn("w-24", destaque ? "h-10" : "h-7")} />
          <Skeleton className="h-3.5 w-32" />
        </>
      ) : (
        <>
          <p
            className={cn(
              "leading-none font-semibold tracking-tight tabular-nums",
              destaque && "text-4xl lg:text-[2.75rem]",
              variante === "numero" && "text-2xl",
              variante === "texto" && "text-lg leading-tight",
            )}
          >
            {valor}
            {unidade ? <span className="ml-1 text-sm font-normal text-muted-foreground">{unidade}</span> : null}
          </p>
          {detalhe ? <p className="text-xs text-muted-foreground">{detalhe}</p> : null}
          {children}
        </>
      )}
    </div>
  );
}
