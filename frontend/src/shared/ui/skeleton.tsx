import type { ComponentProps } from "react";

import { cn } from "@/shared/lib/utils";

/** Bloco de espera com a forma do conteúdo. Só na PRIMEIRA carga: refetch é o quadro anterior em opacidade (§7.3). */
export function Skeleton({ className, ...props }: ComponentProps<"div">) {
  return <div aria-hidden="true" data-slot="skeleton" className={cn("animate-pulse rounded-md bg-muted", className)} {...props} />;
}
