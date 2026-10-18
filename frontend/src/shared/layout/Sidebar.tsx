import { PanelLeftClose, PanelLeftOpen } from "lucide-react";
import { useId } from "react";
import { NavLink } from "react-router-dom";

import { cn } from "@/shared/lib/utils";
import { Button } from "@/shared/ui/button";
import { Marca } from "@/shared/ui/Marca";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/shared/ui/tooltip";

import { NAVEGACAO, type ItemDeNavegacao } from "./navegacao";

type Props = {
  /** Trilho só de ícones (desktop). */
  recolhido?: boolean;
  /** Mostra o botão de recolher — só o menu do desktop o recebe; a gaveta do celular não recolhe. */
  aoAlternarRecolhido?: () => void;
  /** Fecha a gaveta do celular depois de navegar. */
  aoNavegar?: () => void;
  idDoMenu?: string;
};

/**
 * A navegação lateral. EXPANDIDA (15rem): marca, grupos com título e rótulo ao lado do ícone.
 * RECOLHIDA (3.5rem): trilho de ícones, cada link com o rótulo como nome acessível e numa dica
 * (Radix Tooltip, no mouse e no foco). O item ativo vem do `aria-current="page"` do NavLink: a
 * marca visual e a do leitor de tela saem do mesmo lugar.
 */
export function Sidebar({ recolhido = false, aoAlternarRecolhido, aoNavegar, idDoMenu }: Props) {
  const idBase = useId();
  return (
    <div className="flex h-full flex-col bg-sidebar text-sidebar-foreground">
      <div className={cn("flex h-14 shrink-0 items-center gap-2.5 border-b border-sidebar-border", recolhido ? "justify-center px-2" : "px-4")}>
        <Marca className="size-7" />
        {recolhido ? null : (
          <div className="min-w-0 leading-tight">
            <p className="truncate text-sm font-semibold tracking-tight text-foreground">Triagem Metabólica</p>
            <p className="truncate text-[11px] text-muted-foreground">dados fictícios · triagem</p>
          </div>
        )}
      </div>

      <nav id={idDoMenu} aria-label="Menu principal" className={cn("flex flex-1 flex-col overflow-y-auto overscroll-contain py-4", recolhido ? "gap-3 px-2" : "gap-5 px-3")}>
        {NAVEGACAO.map((grupo, indice) => {
          const idDoTitulo = `${idBase}-grupo-${indice}`;
          return (
            <div key={grupo.titulo} className="flex flex-col gap-1">
              <p id={idDoTitulo} className={recolhido ? "sr-only" : "px-2 pb-1 text-[11px] font-semibold tracking-wider text-muted-foreground uppercase"}>
                {grupo.titulo}
              </p>
              {recolhido && indice > 0 ? <div aria-hidden="true" className="mx-auto mb-2 h-px w-6 bg-sidebar-border" /> : null}
              <ul aria-labelledby={idDoTitulo} className={cn("flex flex-col gap-0.5", recolhido && "items-center")}>
                {grupo.itens.map((item) => (
                  <li key={item.para} className={recolhido ? undefined : "w-full"}>
                    {recolhido ? <ItemNoTrilho item={item} aoNavegar={aoNavegar} /> : <ItemExpandido item={item} aoNavegar={aoNavegar} />}
                  </li>
                ))}
              </ul>
            </div>
          );
        })}
      </nav>

      {aoAlternarRecolhido ? (
        <div className={cn("shrink-0 border-t border-sidebar-border py-2", recolhido ? "flex justify-center px-2" : "px-3")}>
          <BotaoDeRecolher recolhido={recolhido} aoAlternar={aoAlternarRecolhido} controla={idDoMenu} />
        </div>
      ) : null}
    </div>
  );
}

const CLASSE_DO_ITEM =
  "transition-colors duration-150 motion-reduce:transition-none hover:bg-sidebar-accent/70 hover:text-sidebar-accent-foreground " +
  "aria-[current=page]:bg-sidebar-accent aria-[current=page]:font-semibold aria-[current=page]:text-sidebar-accent-foreground";

function ItemExpandido({ item, aoNavegar }: { item: ItemDeNavegacao; aoNavegar?: () => void }) {
  const Icone = item.icone;
  return (
    <NavLink
      to={item.para}
      end={item.exato}
      onClick={aoNavegar}
      className={cn("group relative flex h-11 items-center gap-3 rounded-md px-2.5 text-sm font-medium", CLASSE_DO_ITEM)}
    >
      <span aria-hidden="true" className="absolute top-2 bottom-2 left-0 w-0.5 rounded-full bg-primary opacity-0 group-aria-[current=page]:opacity-100" />
      <Icone className="size-[18px] shrink-0" aria-hidden="true" />
      <span className="truncate">{item.rotulo}</span>
    </NavLink>
  );
}

function ItemNoTrilho({ item, aoNavegar }: { item: ItemDeNavegacao; aoNavegar?: () => void }) {
  const Icone = item.icone;
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <NavLink
          to={item.para}
          end={item.exato}
          onClick={aoNavegar}
          aria-label={item.rotulo}
          className={cn("flex size-11 items-center justify-center rounded-md", CLASSE_DO_ITEM)}
        >
          <Icone className="size-[18px]" aria-hidden="true" />
        </NavLink>
      </TooltipTrigger>
      <TooltipContent side="right">{item.rotulo}</TooltipContent>
    </Tooltip>
  );
}

/** O rótulo diz o que o clique FAZ; o `aria-expanded` diz o estado. O botão fica no mesmo ponto nos dois estados. */
function BotaoDeRecolher({ recolhido, aoAlternar, controla }: { recolhido: boolean; aoAlternar: () => void; controla?: string }) {
  if (recolhido) {
    return (
      <Tooltip>
        <TooltipTrigger asChild>
          <Button variant="ghost" size="icon" aria-label="Expandir menu" aria-expanded={false} aria-controls={controla} onClick={aoAlternar} className="text-muted-foreground">
            <PanelLeftOpen aria-hidden="true" />
          </Button>
        </TooltipTrigger>
        <TooltipContent side="right">Expandir menu</TooltipContent>
      </Tooltip>
    );
  }
  return (
    <Button variant="ghost" aria-expanded aria-controls={controla} onClick={aoAlternar} className="w-full justify-start gap-3 px-2.5 text-muted-foreground hover:text-foreground">
      <PanelLeftClose aria-hidden="true" />
      Recolher menu
    </Button>
  );
}
