import type { ReactNode } from "react";

import type { ErroApi } from "@/shared/api/http";
import { cn } from "@/shared/lib/utils";
import { Skeleton } from "@/shared/ui/skeleton";

import { EstadoVazio } from "./EstadoVazio";
import { ErroInline } from "./ErroInline";

type Props = {
  carregando: boolean;
  erro?: ErroApi | Error | null;
  /** refetch em voo: o quadro anterior fica em opacidade, nunca skeleton (§7.3) */
  atualizando?: boolean;
  vazio?: boolean;
  /** O desenho da espera, na forma do conteúdo. Padrão: um bloco do tamanho da área. */
  esqueleto?: ReactNode;
  tituloVazio?: string;
  mensagemVazio?: ReactNode;
  acaoVazio?: ReactNode;
  aoTentarNovamente?: () => void;
  className?: string;
  children: ReactNode;
};

/** Os quatro estados de uma área alimentada por consulta: primeira carga, erro, vazio e dado (com refetch). */
export function QueryState({
  carregando,
  erro,
  atualizando,
  vazio,
  esqueleto,
  tituloVazio = "Nenhum registro no recorte",
  mensagemVazio,
  acaoVazio,
  aoTentarNovamente,
  className,
  children,
}: Props) {
  if (carregando) {
    return (
      <div className={cn("h-full", className)} aria-busy="true">
        <span className="sr-only">Carregando…</span>
        {esqueleto ?? <Skeleton className="h-full min-h-24 w-full" />}
      </div>
    );
  }
  if (erro) {
    return (
      <div className={cn("flex h-full items-center", className)}>
        <ErroInline erro={erro} aoTentarNovamente={aoTentarNovamente} />
      </div>
    );
  }
  if (vazio) {
    return <EstadoVazio className={className} titulo={tituloVazio} descricao={mensagemVazio} acao={acaoVazio} />;
  }
  return (
    <div className={cn("h-full", atualizando && "refetching", className)} aria-busy={atualizando || undefined}>
      {children}
    </div>
  );
}
