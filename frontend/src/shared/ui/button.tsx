import { Slot } from "@radix-ui/react-slot";
import type { ComponentProps } from "react";

import { cn } from "@/shared/lib/utils";

import { variantesDoBotao, type VariantesDoBotao } from "./variantes";

type Props = ComponentProps<"button"> & VariantesDoBotao & { asChild?: boolean };

/** Botão do sistema (shadcn/ui). `asChild` empresta o desenho a um <a> ou <Link>. */
export function Button({ className, variant, size, asChild = false, type, ...props }: Props) {
  const Comp = asChild ? Slot : "button";
  return (
    <Comp
      data-slot="button"
      // type="button" por padrão: dentro de <form>, um botão sem tipo envia o formulário.
      type={asChild ? undefined : (type ?? "button")}
      className={cn(variantesDoBotao({ variant, size }), className)}
      {...props}
    />
  );
}
