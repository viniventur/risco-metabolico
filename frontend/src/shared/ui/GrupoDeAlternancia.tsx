import { useId } from "react";

import { fmtInt } from "@/shared/format/ptBR";
import { cn } from "@/shared/lib/utils";

type Opcao = { valor: string; rotulo: string; n?: number };

type Props = {
  rotulo: string;
  opcoes: Opcao[];
  selecionados: string[];
  aoAlternar: (valor: string) => void;
};

/**
 * Filtro de 2 valores (gênero, histórico familiar): dropdown é excessivo (§7.4). São botões com
 * `aria-pressed`, e não um rádio: podem ficar todos desligados ("todos os registros") ou todos
 * ligados. Desenhados como um trilho segmentado de 44 px.
 */
export function GrupoDeAlternancia({ rotulo, opcoes, selecionados, aoAlternar }: Props) {
  const idRotulo = useId();
  return (
    <div className="flex min-w-0 flex-col gap-1.5">
      <span id={idRotulo} className="text-xs font-medium text-muted-foreground">
        {rotulo}
      </span>
      <div role="group" aria-labelledby={idRotulo} className="flex h-11 gap-1 rounded-md border border-input bg-muted p-1">
        {opcoes.map((o) => {
          const ativo = selecionados.includes(o.valor);
          return (
            <button
              key={o.valor}
              type="button"
              aria-pressed={ativo}
              onClick={() => aoAlternar(o.valor)}
              className={cn(
                "alvo-toque flex min-w-0 flex-1 items-center justify-center gap-1.5 rounded-[5px] px-2 text-sm font-medium transition-colors",
                ativo ? "bg-primary text-primary-foreground shadow-sm" : "text-muted-foreground hover:bg-card hover:text-foreground",
              )}
            >
              <span className="truncate">{o.rotulo}</span>
              {o.n !== undefined ? <span className={cn("text-xs tabular-nums", ativo ? "opacity-85" : "text-muted-foreground")}>{fmtInt(o.n)}</span> : null}
            </button>
          );
        })}
      </div>
    </div>
  );
}
