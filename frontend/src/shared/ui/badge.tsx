import type { ComponentProps } from "react";

import { cn } from "@/shared/lib/utils";

import { variantesDoSelo, type VariantesDoSelo } from "./variantes";

export function Badge({ className, variant, ...props }: ComponentProps<"span"> & VariantesDoSelo) {
  return <span data-slot="badge" className={cn(variantesDoSelo({ variant }), className)} {...props} />;
}
