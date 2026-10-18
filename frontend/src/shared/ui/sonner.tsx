import { Toaster as Sonner, type ToasterProps } from "sonner";

import { useTema } from "@/shared/tema/useTema";

/**
 * O Toaster do sonner ligado ao tema do app, montado UMA vez na casca. Os avisos saem de
 * `shared/ui/avisos.ts` (`avisar.sucesso(...)`), para que nenhuma tela importe o sonner direto.
 */
export function Toaster(props: ToasterProps) {
  const { tema } = useTema();
  return (
    <Sonner
      theme={tema}
      position="bottom-right"
      closeButton
      toastOptions={{
        classNames: {
          toast: "group border-border bg-popover text-popover-foreground shadow-lg",
          description: "text-muted-foreground",
          actionButton: "bg-primary text-primary-foreground",
          cancelButton: "bg-muted text-muted-foreground",
          success: "[&_[data-icon]]:text-success",
          error: "[&_[data-icon]]:text-destructive",
          warning: "[&_[data-icon]]:text-warning",
          info: "[&_[data-icon]]:text-primary",
        },
      }}
      {...props}
    />
  );
}
