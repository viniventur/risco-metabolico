import { cn } from "@/shared/lib/utils";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/shared/ui/tooltip";

import { AUTOR } from "./autor";
import { NomeDoAutor, SimboloDoAutor } from "./MarcaDoAutor";

const ROTULO = "Desenvolvido por";
const NOVA_ABA = "abre em nova aba";

type Props = {
  /** `completa` (padrão): rótulo, nome e símbolo; `compacta`: só o símbolo, para o trilho recolhido. */
  variante?: "completa" | "compacta";
  /** Só na `completa`: `pequeno` é a do menu lateral (símbolo com 16 px, o mínimo do manual). */
  tamanho?: "normal" | "pequeno";
  /** A cor (`text-...`) e o alinhamento vêm daqui: a marca segue a cor do texto. */
  className?: string;
};

/**
 * Os créditos de quem fez o projeto, como nos outros projetos do autor: "Desenvolvido por", o nome
 * e, depois dele, o símbolo, num link para o site principal, em outra aba (o painel continua aberto).
 * Aparecem no pé do menu lateral, no fim do Início, na Política de Privacidade e no 404.
 *
 * Na `completa`, o rótulo e a assinatura QUEBRAM em duas linhas onde não cabem (o nome e o símbolo
 * nunca se separam). O rótulo fica a 70% da cor e sobe a 100% no hover: o único efeito, porque a
 * marca não leva efeito nenhum.
 */
export function CreditosDoAutor({ variante = "completa", tamanho = "normal", className }: Props) {
  if (variante === "compacta") {
    return (
      <Tooltip>
        <TooltipTrigger asChild>
          <a
            href={AUTOR.site}
            target="_blank"
            rel="noopener noreferrer"
            aria-label={`${ROTULO} ${AUTOR.nome} (${NOVA_ABA})`}
            className={cn("flex size-10 items-center justify-center rounded-md opacity-80 transition-opacity duration-150 hover:opacity-100 motion-reduce:transition-none", className)}
          >
            <SimboloDoAutor className="h-5 w-auto" />
          </a>
        </TooltipTrigger>
        <TooltipContent side="right">
          {ROTULO} {AUTOR.nome} · {AUTOR.dominio}
        </TooltipContent>
      </Tooltip>
    );
  }

  const pequeno = tamanho === "pequeno";
  return (
    // O nome acessível vai inteiro no aria-label: o nome do autor é desenho (SVG), e um texto escondido
    // ao lado perdia o espaço depois de "Desenvolvido por" no cálculo do nome. O rótulo visível abre o
    // aria-label, como pede o critério "rótulo no nome" (WCAG 2.5.3).
    <a
      href={AUTOR.site}
      target="_blank"
      rel="noopener noreferrer"
      aria-label={`${ROTULO} ${AUTOR.nome}, ${AUTOR.dominio} (${NOVA_ABA})`}
      className={cn("group inline-flex flex-wrap items-center gap-x-2 gap-y-1 rounded-md", className)}
    >
      <span
        className={cn(
          "shrink-0 leading-none whitespace-nowrap opacity-70 transition-opacity duration-150 group-hover:opacity-100 motion-reduce:transition-none",
          pequeno ? "text-[11px]" : "text-xs",
        )}
      >
        {ROTULO}
      </span>
      <span className="inline-flex shrink-0 items-center gap-1.5">
        <NomeDoAutor className={cn("w-auto", pequeno ? "h-3" : "h-3.5")} />
        <SimboloDoAutor className={cn("w-auto", pequeno ? "h-4" : "h-5")} />
      </span>
    </a>
  );
}
