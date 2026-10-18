import { classificarImc } from "@/shared/dominio";
import { fmtImc } from "@/shared/format/ptBR";
import { cn } from "@/shared/lib/utils";

/** Classe literal do ponto de cada macro-faixa (a mesma rampa da dispersão e da tabela: a cor segue a entidade). */
const PONTO: Record<string, string> = {
  abaixo: "bg-faixa-abaixo",
  normal: "bg-faixa-normal",
  sobrepeso: "bg-faixa-sobrepeso",
  obesidade: "bg-faixa-obesidade",
};

/** IMC calculado no cliente (peso / altura², 2 casas) com a faixa e a cor da macro-faixa; a resposta confirma. */
export function CartaoImc({ imc }: { imc: number | null }) {
  if (imc === null) return null;
  const { faixa, macro } = classificarImc(imc);
  return (
    <div className="flex items-center justify-between gap-3 rounded-md border bg-muted/50 px-4 py-3" aria-live="polite">
      <span className="text-sm text-muted-foreground">
        IMC calculado: <strong className="text-base font-semibold text-foreground tabular-nums">{fmtImc(imc)}</strong>
      </span>
      <span className="inline-flex items-center gap-2 text-sm font-medium">
        <span aria-hidden="true" className={cn("size-2.5 rounded-full", PONTO[macro])} />
        {faixa}
      </span>
    </div>
  );
}
