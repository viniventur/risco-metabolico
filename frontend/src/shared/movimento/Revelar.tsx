import type { CSSProperties, ReactNode } from "react";

import { cn } from "@/shared/lib/utils";

import { useApareceuNaTela } from "./useApareceuNaTela";

const ATRASO_POR_ITEM_MS = 80;

type Props = {
  as?: "div" | "li" | "section";
  /** A posição na fileira: cada item espera `ATRASO_POR_ITEM_MS` a mais que o anterior. */
  ordem?: number;
  className?: string;
  style?: CSSProperties;
  children: ReactNode;
};

/**
 * Um bloco que entra subindo e aparecendo quando chega à tela, uma vez só. A revelação mora AQUI e o
 * hover no elemento de dentro: o atraso da entrada é um `transition-delay`, e no mesmo elemento ele
 * atrasaria o hover também. Com `prefers-reduced-motion`, o bloco já nasce no lugar.
 */
export function Revelar({ as: Tag = "div", ordem = 0, className, style, children }: Props) {
  const [ref, apareceu] = useApareceuNaTela<HTMLElement>();
  return (
    <Tag
      ref={ref}
      style={apareceu ? { ...style, transitionDelay: `${ordem * ATRASO_POR_ITEM_MS}ms` } : style}
      className={cn(
        // O Tailwind v4 move com a propriedade `translate`, não `transform`: é ela que entra na transição.
        "transition-[opacity,translate] duration-700 ease-[cubic-bezier(0.16,1,0.3,1)] motion-reduce:transition-none",
        apareceu ? "opacity-100" : "translate-y-6 opacity-0 motion-reduce:translate-y-0 motion-reduce:opacity-100",
        className,
      )}
    >
      {children}
    </Tag>
  );
}
