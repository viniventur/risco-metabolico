import type { ReactNode } from "react";
import { useInRouterContext, useLocation } from "react-router-dom";

import { cn } from "@/shared/lib/utils";
import { projetoDaRota } from "@/shared/projetos";

import { SeloDoProjeto } from "./SeloDoProjeto";

type Props = {
  titulo: ReactNode;
  descricao?: ReactNode;
  /** Ações da tela, à direita no desktop e abaixo do título no celular. */
  acoes?: ReactNode;
  /** Linha extra embaixo (os filtros ativos do painel e da consulta). */
  children?: ReactNode;
  className?: string;
};

/** O selo do projeto da rota (shared/projetos), em cima do título; nas telas comuns, nada. */
function ProjetoDaRota() {
  const projeto = projetoDaRota(useLocation().pathname);
  return projeto ? (
    <p className="mb-2.5">
      <SeloDoProjeto projeto={projeto} />
    </p>
  ) : null;
}

/**
 * O cabeçalho de toda tela: o selo do projeto, o único <h1> da página, a frase que diz o que ela
 * responde e as ações. Fora de um roteador (o teste de uma tela isolada), o cabeçalho sai sem o selo.
 */
export function PageHeader({ titulo, descricao, acoes, children, className }: Props) {
  const comRota = useInRouterContext();
  return (
    <header className={cn("mb-6 flex flex-col gap-4", className)}>
      <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div className="min-w-0">
          {comRota ? <ProjetoDaRota /> : null}
          <h1 className="text-2xl leading-tight font-semibold tracking-tight text-balance sm:text-[1.75rem]">{titulo}</h1>
          {descricao ? <p className="mt-1.5 max-w-3xl text-sm leading-relaxed text-muted-foreground">{descricao}</p> : null}
        </div>
        {acoes ? <div className="nao-imprimir flex shrink-0 flex-wrap items-center gap-2">{acoes}</div> : null}
      </div>
      {children}
    </header>
  );
}
