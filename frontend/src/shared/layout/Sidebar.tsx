import { PanelLeftClose, PanelLeftOpen } from "lucide-react";
import { useId } from "react";
import { NavLink, useLocation } from "react-router-dom";

import { CreditosDoAutor } from "@/shared/autor/CreditosDoAutor";
import { cn } from "@/shared/lib/utils";
import { projetoDaRota, type Projeto } from "@/shared/projetos";
import { Button } from "@/shared/ui/button";
import { Marca } from "@/shared/ui/Marca";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/shared/ui/tooltip";

import { NAVEGACAO, type GrupoDeNavegacao, type ItemDeNavegacao } from "./navegacao";

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
 * A navegação lateral. EXPANDIDA (15rem): marca, o Início, um bloco por projeto (o ícone, o nome, o
 * número e a natureza da base em cima das quatro telas dele; o bloco do projeto da tela aberta fica
 * em destaque) e os estudos. RECOLHIDA (3.5rem): trilho de ícones, com o ícone do projeto em cima das
 * telas dele e cada link com o rótulo e o projeto como nome acessível e numa dica (Radix Tooltip, no
 * mouse e no foco). O item ativo vem do `aria-current="page"` do NavLink: a marca visual e a do leitor
 * de tela saem do mesmo lugar.
 */
export function Sidebar({ recolhido = false, aoAlternarRecolhido, aoNavegar, idDoMenu }: Props) {
  const idBase = useId();
  const projetoAberto = projetoDaRota(useLocation().pathname);
  return (
    <div className="flex h-full flex-col bg-sidebar text-sidebar-foreground">
      <div className={cn("flex h-14 shrink-0 items-center gap-2.5 border-b border-sidebar-border", recolhido ? "justify-center px-2" : "px-4")}>
        <Marca className="size-7" />
        {recolhido ? null : (
          <div className="min-w-0 leading-tight">
            <p className="truncate text-sm font-semibold tracking-tight text-foreground">Triagem Metabólica</p>
            <p className="truncate text-[11px] text-muted-foreground">triagem, não diagnóstico</p>
          </div>
        )}
      </div>

      <nav id={idDoMenu} aria-label="Menu principal" className={cn("flex flex-1 flex-col overflow-y-auto overscroll-contain py-4", recolhido ? "gap-3 px-2" : "gap-3 px-3")}>
        {NAVEGACAO.map((grupo, indice) => {
          const idDoTitulo = `${idBase}-grupo-${indice}`;
          const separador = recolhido && indice > 0 ? <div aria-hidden="true" className="mx-auto mb-2 h-px w-6 bg-sidebar-border" /> : null;
          if (grupo.projeto) {
            return (
              <div key={grupo.titulo}>
                {separador}
                <GrupoDoProjeto
                  grupo={grupo}
                  projeto={grupo.projeto}
                  idDoTitulo={idDoTitulo}
                  aberto={projetoAberto?.id === grupo.projeto.id}
                  recolhido={recolhido}
                  aoNavegar={aoNavegar}
                />
              </div>
            );
          }
          // O Início e os estudos são um item só, com o nome do grupo: o título fica para o leitor de tela.
          const tituloOculto = recolhido || (grupo.itens.length === 1 && grupo.itens[0]?.rotulo === grupo.titulo);
          return (
            <div key={grupo.titulo} className="flex flex-col gap-1">
              <p id={idDoTitulo} className={tituloOculto ? "sr-only" : "px-2 pb-1 text-[11px] font-semibold tracking-wider text-muted-foreground uppercase"}>
                {grupo.titulo}
              </p>
              {separador}
              <ListaDeItens grupo={grupo} idDoTitulo={idDoTitulo} recolhido={recolhido} aoNavegar={aoNavegar} />
            </div>
          );
        })}
      </nav>

      {/* O pé, FORA do <nav> (não são itens do menu): os créditos de quem fez o projeto e, no desktop, o
          botão de recolher. Recolhido, os créditos viram só o símbolo, com o nome na dica. */}
      <div className={cn("flex shrink-0 flex-col gap-1 border-t border-sidebar-border py-2", recolhido ? "items-center px-2" : "px-3")}>
        <CreditosDoAutor variante={recolhido ? "compacta" : "completa"} tamanho="pequeno" className={recolhido ? undefined : "px-2.5 py-2"} />
        {aoAlternarRecolhido ? <BotaoDeRecolher recolhido={recolhido} aoAlternar={aoAlternarRecolhido} controla={idDoMenu} /> : null}
      </div>
    </div>
  );
}

type PropsDaLista = { grupo: GrupoDeNavegacao; idDoTitulo: string; recolhido: boolean; aoNavegar?: () => void; projeto?: Projeto };

function ListaDeItens({ grupo, idDoTitulo, recolhido, aoNavegar, projeto }: PropsDaLista) {
  return (
    <ul aria-labelledby={idDoTitulo} className={cn("flex flex-col gap-0.5", recolhido && "items-center")}>
      {grupo.itens.map((item) => (
        <li key={item.para} className={recolhido ? undefined : "w-full"}>
          {recolhido ? <ItemNoTrilho item={item} projeto={projeto} aoNavegar={aoNavegar} /> : <ItemExpandido item={item} aoNavegar={aoNavegar} />}
        </li>
      ))}
    </ul>
  );
}

/**
 * O bloco de um projeto. Expandido: um cartão com o ícone, o nome (o título da lista), o número e a
 * natureza da base em cima das quatro telas; o do projeto aberto ganha a borda e a sombra. Recolhido:
 * o ícone do projeto em cima dos ícones das telas, e o nome no título só para o leitor de tela.
 */
function GrupoDoProjeto({ grupo, projeto, idDoTitulo, aberto, recolhido, aoNavegar }: PropsDaLista & { projeto: Projeto; aberto: boolean }) {
  const Icone = projeto.icone;
  if (recolhido) {
    return (
      <div className="flex flex-col items-center gap-1">
        <p id={idDoTitulo} className="sr-only">
          {grupo.titulo}
        </p>
        <span
          aria-hidden="true"
          className={cn(
            "mb-1 flex size-7 items-center justify-center rounded-md",
            aberto ? "bg-primary text-primary-foreground" : "bg-sidebar-accent text-sidebar-accent-foreground",
          )}
        >
          <Icone className="size-3.5" />
        </span>
        <ListaDeItens grupo={grupo} idDoTitulo={idDoTitulo} recolhido aoNavegar={aoNavegar} projeto={projeto} />
      </div>
    );
  }
  return (
    <div
      className={cn(
        "flex flex-col gap-1 rounded-xl border p-1.5 transition-[border-color,box-shadow] duration-200 motion-reduce:transition-none",
        aberto ? "border-foreground/20 bg-card shadow-sm" : "border-sidebar-border bg-card/50",
      )}
    >
      <div className="flex items-center gap-2.5 px-1.5 pt-1 pb-1.5">
        <span aria-hidden="true" className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-primary text-primary-foreground shadow-sm">
          <Icone className="size-4" />
        </span>
        <div className="min-w-0 leading-tight">
          <p id={idDoTitulo} className="truncate text-sm font-semibold tracking-tight text-foreground">
            {grupo.titulo}
          </p>
          <p className="truncate text-[11px] text-muted-foreground">
            Projeto {projeto.numero} · {projeto.dadosCurto}
          </p>
        </div>
      </div>
      <ListaDeItens grupo={grupo} idDoTitulo={idDoTitulo} recolhido={false} aoNavegar={aoNavegar} />
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

/** No trilho, as telas dos dois projetos têm o mesmo ícone: o nome diz de qual ("Simulador da diabetes"). */
function ItemNoTrilho({ item, projeto, aoNavegar }: { item: ItemDeNavegacao; projeto?: Projeto; aoNavegar?: () => void }) {
  const Icone = item.icone;
  const rotulo = projeto ? `${item.rotulo} da ${projeto.nome.toLowerCase()}` : item.rotulo;
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <NavLink
          to={item.para}
          end={item.exato}
          onClick={aoNavegar}
          aria-label={rotulo}
          className={cn("flex size-11 items-center justify-center rounded-md", CLASSE_DO_ITEM)}
        >
          <Icone className="size-[18px]" aria-hidden="true" />
        </NavLink>
      </TooltipTrigger>
      <TooltipContent side="right">{rotulo}</TooltipContent>
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
