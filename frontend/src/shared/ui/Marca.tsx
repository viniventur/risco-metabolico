import type { SVGProps } from "react";

import { cn } from "@/shared/lib/utils";

/**
 * A marca do produto (o `<Marca>` de §7.3): um traço de sinal vital dentro de um selo. Decorativa —
 * o nome do produto vem sempre em texto ao lado —, por isso `aria-hidden`. Antes ocupava a vaga de
 * um KPI no painel; agora encabeça a barra lateral em todas as telas (ADR 0010).
 */
export function Marca({ className, ...props }: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 32 32" aria-hidden="true" className={cn("size-8 shrink-0", className)} {...props}>
      <rect width="32" height="32" rx="9" className="fill-primary" />
      <path
        d="M7 17.5h3.6l2.4-5 3.4 9 2.9-11 2.3 7H25"
        fill="none"
        className="stroke-primary-foreground"
        strokeWidth="2.2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
