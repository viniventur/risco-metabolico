import { cn } from "@/shared/lib/utils";

import { useContagem } from "./useContagem";

type Props = {
  /** O valor final; `null` enquanto a API não respondeu (mostra o traço de `formatar`). */
  valor: number | null | undefined;
  formatar: (valor: number | null | undefined) => string;
  /** Liga a contagem (em geral, `useApareceuNaTela`). */
  ativo: boolean;
  duracaoMs?: number;
  className?: string;
};

/**
 * O número contando até o valor. O leitor de tela recebe o valor FINAL, uma vez só; a contagem é
 * para os olhos (`aria-hidden`) — senão cada quadro viraria um número novo para ler. `data-numero`
 * marca o valor final para os testes.
 */
export function NumeroQueConta({ valor, formatar, ativo, duracaoMs, className }: Props) {
  const atual = useContagem(valor, ativo, duracaoMs);
  const conhecido = valor !== null && valor !== undefined;
  return (
    <span className={cn("tabular-nums", className)}>
      <span className="sr-only" data-numero="">
        {formatar(valor)}
      </span>
      <span aria-hidden="true">{conhecido ? formatar(atual) : formatar(valor)}</span>
    </span>
  );
}
