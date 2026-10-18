import * as RadioGroupPrimitive from "@radix-ui/react-radio-group";
import { useCallback, type KeyboardEvent, type ReactNode } from "react";

import { cn } from "@/shared/lib/utils";

export type OpcaoSegmentada<V extends string> = { valor: V; rotulo: ReactNode; rotuloAcessivel?: string };

type Props<V extends string> = {
  opcoes: ReadonlyArray<OpcaoSegmentada<V>>;
  valor: V;
  aoMudar: (valor: V) => void;
  /** Nome do grupo para o leitor de tela ("Janela em dias"). */
  rotulo: string;
  className?: string;
};

/**
 * Escolha ÚNICA entre poucas opções sempre visíveis (a janela do monitoramento). É um `radiogroup`
 * do Radix, não botões com `aria-pressed`: sempre há uma opção marcada, e só uma. Tab entra pela
 * marcada; as setas andam e marcam; Home e End vão às pontas e também marcam.
 *
 * Filtro que pode ficar todo desligado (gênero, histórico) NÃO é isto: é `GrupoDeAlternancia`.
 */
export function SegmentedControl<V extends string>({ opcoes, valor, aoMudar, rotulo, className }: Props<V>) {
  const mudar = useCallback(
    (bruto: string) => {
      const opcao = opcoes.find((o) => o.valor === bruto);
      if (opcao && opcao.valor !== valor) aoMudar(opcao.valor);
    },
    [opcoes, valor, aoMudar],
  );
  const aoTeclar = useCallback(
    (evento: KeyboardEvent<HTMLButtonElement>) => {
      if (evento.key !== "Home" && evento.key !== "End") return;
      const alvo = evento.key === "Home" ? opcoes[0] : opcoes[opcoes.length - 1];
      if (alvo) mudar(alvo.valor);
    },
    [opcoes, mudar],
  );
  return (
    <RadioGroupPrimitive.Root
      value={valor}
      onValueChange={mudar}
      aria-label={rotulo}
      orientation="horizontal"
      className={cn("inline-flex h-11 items-center gap-1 rounded-lg border bg-muted p-1", className)}
    >
      {opcoes.map((o) => (
        <RadioGroupPrimitive.Item
          key={o.valor}
          value={o.valor}
          aria-label={o.rotuloAcessivel}
          onKeyDown={aoTeclar}
          className={cn(
            "inline-flex h-9 items-center justify-center rounded-md px-3.5 text-sm font-medium whitespace-nowrap transition-colors",
            "data-[state=checked]:bg-card data-[state=checked]:text-foreground data-[state=checked]:shadow-sm",
            "data-[state=unchecked]:text-muted-foreground data-[state=unchecked]:hover:text-foreground",
          )}
        >
          {o.rotulo}
        </RadioGroupPrimitive.Item>
      ))}
    </RadioGroupPrimitive.Root>
  );
}
