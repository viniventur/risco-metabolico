import { ORDEM_CLINICA } from "@/shared/dominio";
import { cn } from "@/shared/lib/utils";

import { FUNDO_DO_NIVEL } from "./niveis";

type Props = {
  /** registros por nível no recorte */
  porNivel: Record<string, number>;
  total: number;
  /** as classes que o número ao lado conta: em cor cheia; as outras, em cinza */
  destacar: readonly string[];
  className?: string;
};

/**
 * A composição do recorte nas 7 classes numa barra fina, sob os KPIs de excesso de peso e obesidade:
 * o leitor vê de onde o percentual vem (os graus da família, no degradê). Só desenho — o número está
 * escrito ao lado, e a tabela de cada classe está no gráfico de níveis.
 */
export function BarraDeNiveis({ porNivel, total, destacar, className }: Props) {
  const presentes = ORDEM_CLINICA.filter((n) => (porNivel[n] ?? 0) > 0);
  return (
    <div aria-hidden="true" className={cn("flex h-2 w-full gap-0.5 overflow-hidden rounded-full", className)}>
      {total > 0
        ? presentes.map((n) => (
            <span
              key={n}
              className={cn("h-full transition-[width] duration-300 motion-reduce:transition-none", destacar.includes(n) ? FUNDO_DO_NIVEL[n] : "bg-muted")}
              style={{ width: `${((porNivel[n] ?? 0) / total) * 100}%` }}
            />
          ))
        : null}
    </div>
  );
}
