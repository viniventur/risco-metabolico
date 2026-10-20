import { cn } from "@/shared/lib/utils";
import type { Projeto } from "@/shared/projetos";

/**
 * O selo de um projeto: o ícone, o número e o nome ("Projeto 1 · Obesidade"). Vai em cima do título de
 * cada tela do projeto (PageHeader) e nos cartões dos estudos. O ponto do meio é só desenho: o leitor
 * de tela ouve "Projeto 1 Obesidade".
 */
export function SeloDoProjeto({ projeto, className }: { projeto: Projeto; className?: string }) {
  const Icone = projeto.icone;
  return (
    <span className={cn("inline-flex w-fit items-center gap-1.5 rounded-full border bg-card px-2.5 py-1 text-xs font-medium text-muted-foreground", className)}>
      <Icone aria-hidden="true" className="size-3.5 text-foreground" />
      Projeto {projeto.numero}{" "}
      <span aria-hidden="true">·</span>{" "}
      <span className="font-semibold text-foreground">{projeto.nome}</span>
    </span>
  );
}
