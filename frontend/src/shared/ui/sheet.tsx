import * as DialogPrimitive from "@radix-ui/react-dialog";
import { X } from "lucide-react";
import type { ComponentProps } from "react";

import { cn } from "@/shared/lib/utils";

/**
 * Gaveta lateral (Radix Dialog): no celular a navegação cobre a página, então se comporta como
 * diálogo modal — foco preso dentro, Esc fecha, o foco volta ao botão que abriu, e há um botão de
 * fechar DENTRO dela (leitor de tela no celular não tem Esc).
 */
export const Sheet = DialogPrimitive.Root;
export const SheetTrigger = DialogPrimitive.Trigger;
export const SheetClose = DialogPrimitive.Close;
export const SheetTitle = DialogPrimitive.Title;
export const SheetDescription = DialogPrimitive.Description;

export function SheetContent({ className, children, ...props }: ComponentProps<typeof DialogPrimitive.Content>) {
  return (
    <DialogPrimitive.Portal>
      <DialogPrimitive.Overlay className="fixed inset-0 z-40 bg-overlay/60 motion-safe:animate-surgir" />
      <DialogPrimitive.Content
        data-slot="sheet-content"
        className={cn(
          "fixed inset-y-0 left-0 z-50 flex h-full w-72 max-w-[85vw] flex-col bg-sidebar shadow-xl outline-none motion-safe:animate-entrar-lateral",
          className,
        )}
        {...props}
      >
        {children}
        <DialogPrimitive.Close
          className="absolute top-2 right-2 inline-flex size-11 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
          aria-label="Fechar menu de navegação"
        >
          <X className="size-5" aria-hidden="true" />
        </DialogPrimitive.Close>
      </DialogPrimitive.Content>
    </DialogPrimitive.Portal>
  );
}
