import { Inbox } from "lucide-react";
import type { ReactNode } from "react";

import { cn } from "@/shared/lib/utils";

type Props = {
  titulo: string;
  /** Diga o que fazer, não só que está vazio. */
  descricao?: ReactNode;
  icone?: ReactNode;
  acao?: ReactNode;
  className?: string;
};

/**
 * Estado vazio padrão. Uma área vazia sem explicação é indistinguível de uma área quebrada: a pessoa
 * não sabe se não há dado, se o filtro escondeu tudo ou se a requisição falhou.
 */
export function EstadoVazio({ titulo, descricao, icone, acao, className }: Props) {
  return (
    <div className={cn("flex h-full flex-col items-center justify-center gap-3 rounded-lg border border-dashed px-6 py-10 text-center", className)}>
      <div className="flex size-10 items-center justify-center rounded-full bg-muted text-muted-foreground" aria-hidden="true">
        {icone ?? <Inbox className="size-5" />}
      </div>
      <div className="flex max-w-sm flex-col gap-1">
        <p className="text-sm font-medium">{titulo}</p>
        {descricao ? <p className="text-[13px] leading-snug text-muted-foreground">{descricao}</p> : null}
      </div>
      {acao ? <div className="pt-1">{acao}</div> : null}
    </div>
  );
}
