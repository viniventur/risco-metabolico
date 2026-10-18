import type { ComponentProps } from "react";

import { cn } from "@/shared/lib/utils";

/** Rótulo de campo. Sempre com `htmlFor` (ou envolvendo o campo): sem ele o leitor anuncia só "campo de texto". */
export function Label({ className, ...props }: ComponentProps<"label">) {
  return <label data-slot="label" className={cn("text-sm leading-none font-medium", className)} {...props} />;
}
