import type { CSSProperties } from "react";

import { fmtInt } from "@/shared/format/ptBR";
import { NumeroQueConta } from "@/shared/movimento/NumeroQueConta";
import { useApareceuNaTela } from "@/shared/movimento/useApareceuNaTela";
import { Skeleton } from "@/shared/ui/skeleton";

/** Um passo: um número da API, que conta até o valor, ou um símbolo, quando o passo não é uma contagem. */
export type PassoDoModelo = { chave: string; valor?: number; simbolo?: string; texto: string };

/**
 * "Como funciona", o caminho da resposta à saída em três passos ligados por um feixe, no cabeçalho de
 * cada projeto do Início. Os números vêm do /model/info do projeto e contam até o valor quando o
 * cartão aparece; `rotulo` é o nome acessível da lista.
 */
export function ComoFunciona({ rotulo, passos, carregando }: { rotulo: string; passos: PassoDoModelo[]; carregando: boolean }) {
  const [ref, apareceu] = useApareceuNaTela<HTMLOListElement>("0px");
  return (
    <div className="borda-com-feixe rounded-2xl">
      <div className="rounded-2xl border bg-card/75 p-5 shadow-xl shadow-primary/5 backdrop-blur-md sm:p-6">
        <p className="text-xs font-semibold tracking-wider text-muted-foreground uppercase">Como funciona</p>
        <ol ref={ref} aria-label={rotulo} className="mt-4 flex flex-col">
          {passos.map((passo, i) => (
            <li key={passo.chave} className="relative flex items-center gap-4 pb-5 last:pb-0">
              {i < passos.length - 1 ? (
                <span
                  aria-hidden="true"
                  className="linha-com-feixe linha-com-feixe--vertical absolute top-12 bottom-0 left-6 w-px"
                  style={{ "--atraso-feixe": `${i * 0.8}s` } as CSSProperties}
                />
              ) : null}
              <span className="relative flex size-12 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-xl font-semibold text-primary ring-1 ring-primary/20 ring-inset">
                {passo.simbolo !== undefined ? (
                  <span aria-hidden="true">{passo.simbolo}</span>
                ) : carregando ? (
                  <Skeleton className="h-6 w-7" />
                ) : (
                  <NumeroQueConta valor={passo.valor} formatar={fmtInt} ativo={apareceu} duracaoMs={1200 + i * 300} />
                )}
              </span>
              <span className="text-sm leading-snug">{passo.texto}</span>
              {i < passos.length - 1 ? <span className="sr-only">, depois</span> : null}
            </li>
          ))}
        </ol>
      </div>
    </div>
  );
}
