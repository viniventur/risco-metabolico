import type { ComponentProps, Ref } from "react";

import { cn } from "@/shared/lib/utils";

type PropsDaTabela = ComponentProps<"table"> & {
  /**
   * Classe do DIV que de fato ROLA. `position: sticky` se ancora no ancestral rolável mais próximo:
   * quem quer cabeçalho grudado passa a altura POR AQUI, e não num div em volta da tabela.
   */
  wrapperClassName?: string;
  wrapperRef?: Ref<HTMLDivElement>;
};

export function Table({ className, wrapperClassName, wrapperRef, ...props }: PropsDaTabela) {
  return (
    <div ref={wrapperRef} data-slot="table-container" className={cn("relative w-full overflow-auto", wrapperClassName)}>
      <table data-slot="table" className={cn("w-full caption-bottom text-sm", className)} {...props} />
    </div>
  );
}

export function TableHeader({ className, ...props }: ComponentProps<"thead">) {
  return <thead data-slot="table-header" className={cn("[&_tr]:border-b", className)} {...props} />;
}

export function TableBody({ className, ...props }: ComponentProps<"tbody">) {
  return <tbody data-slot="table-body" className={cn("[&_tr:last-child]:border-0", className)} {...props} />;
}

export function TableRow({ className, ...props }: ComponentProps<"tr">) {
  return <tr data-slot="table-row" className={cn("border-b transition-colors hover:bg-muted/60 data-[state=selected]:bg-accent", className)} {...props} />;
}

export function TableHead({ className, scope, ...props }: ComponentProps<"th">) {
  return (
    <th
      data-slot="table-head"
      // scope="col" por padrão: sem ele o leitor de tela não anuncia o cabeçalho ao entrar na célula.
      scope={scope ?? "col"}
      className={cn("h-11 px-3 text-left align-middle text-xs font-semibold tracking-wide whitespace-nowrap text-muted-foreground uppercase", className)}
      {...props}
    />
  );
}

export function TableCell({ className, ...props }: ComponentProps<"td">) {
  return <td data-slot="table-cell" className={cn("px-3 py-2.5 align-middle", className)} {...props} />;
}

export function TableCaption({ className, ...props }: ComponentProps<"caption">) {
  return <caption data-slot="table-caption" className={cn("mt-3 text-xs text-muted-foreground", className)} {...props} />;
}
