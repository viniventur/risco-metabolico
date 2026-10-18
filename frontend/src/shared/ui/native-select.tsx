import { ChevronDown } from "lucide-react";
import type { ComponentProps } from "react";

import { cn } from "@/shared/lib/utils";

import { CLASSE_DO_CONTROLE } from "./controle";

/**
 * <select> nativo com o desenho dos controles. Nativo de propósito no formulário do simulador: o
 * react-hook-form registra o campo direto, o celular abre o seletor do sistema e o leitor de tela
 * já sabe o que é.
 */
export function NativeSelect({ className, children, ...props }: ComponentProps<"select">) {
  return (
    <div className="relative w-full">
      <select data-slot="native-select" className={cn(CLASSE_DO_CONTROLE, "appearance-none pr-9", className)} {...props}>
        {children}
      </select>
      <ChevronDown aria-hidden="true" className="pointer-events-none absolute top-1/2 right-3 size-4 -translate-y-1/2 text-muted-foreground" />
    </div>
  );
}
