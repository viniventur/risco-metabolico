import type { ReactNode } from "react";

import type { ErroApi } from "@/shared/api/http";
import { IconeAlerta } from "@/shared/ui/icones";

type Props = {
  carregando: boolean;
  erro?: ErroApi | Error | null;
  /** refetch em voo: o frame anterior fica em opacidade, nunca skeleton (7.3) */
  atualizando?: boolean;
  vazio?: boolean;
  mensagemVazio?: string;
  children: ReactNode;
};

export function QueryState({ carregando, erro, atualizando, vazio, mensagemVazio, children }: Props) {
  if (carregando) {
    return (
      <div className="flex h-full min-h-24 items-center justify-center text-sm text-texto-fraco" aria-busy="true">
        Carregando…
      </div>
    );
  }
  if (erro) {
    const mensagem = "mensagem" in erro ? erro.mensagem : erro.message;
    return (
      <div className="flex h-full min-h-24 items-center justify-center gap-2 text-sm text-perigo" role="alert">
        <IconeAlerta />
        <span>{mensagem}</span>
      </div>
    );
  }
  if (vazio) {
    return (
      <div className="flex h-full min-h-24 items-center justify-center text-sm text-texto-fraco">
        {mensagemVazio ?? "Nenhum registro no recorte."}
      </div>
    );
  }
  return <div className={atualizando ? "refetching h-full" : "h-full"}>{children}</div>;
}
