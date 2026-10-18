import type { ComponentProps } from "react";

import { cn } from "@/shared/lib/utils";

import { CLASSE_DO_CONTROLE } from "./controle";

export function Input({ className, type = "text", ...props }: ComponentProps<"input">) {
  return <input data-slot="input" type={type} className={cn(CLASSE_DO_CONTROLE, className)} {...props} />;
}
