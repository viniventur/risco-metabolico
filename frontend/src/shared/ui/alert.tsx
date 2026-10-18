import type { ComponentProps } from "react";

import { cn } from "@/shared/lib/utils";

import { variantesDoAlerta, type VariantesDoAlerta } from "./variantes";

/**
 * Faixa de aviso. O `role` é de quem usa: `alert` só para erro que precisa ser anunciado na hora;
 * aviso que não é falha (deriva indisponível, extrapolação, registro anônimo) usa `status` ou nada.
 */
export function Alert({ className, variant, ...props }: ComponentProps<"div"> & VariantesDoAlerta) {
  return <div data-slot="alert" className={cn(variantesDoAlerta({ variant }), className)} {...props} />;
}

export function AlertTitle({ className, ...props }: ComponentProps<"p">) {
  return <p data-slot="alert-title" className={cn("col-start-2 leading-snug font-medium", className)} {...props} />;
}

export function AlertDescription({ className, ...props }: ComponentProps<"div">) {
  return <div data-slot="alert-description" className={cn("col-start-2 text-[13px] leading-relaxed text-muted-foreground", className)} {...props} />;
}
