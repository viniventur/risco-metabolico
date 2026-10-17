import { classificarImc } from "@/shared/dominio";
import { fmtImc } from "@/shared/format/ptBR";

const TOM: Record<string, string> = {
  info: "border-azul-claro text-azul-claro",
  sucesso: "border-sucesso text-sucesso",
  alerta: "border-alerta text-alerta",
  perigo: "border-perigo text-perigo",
};

/** IMC calculado no cliente (peso / altura², 2 casas) com a faixa e a cor semântica; a resposta confirma. */
export function CartaoImc({ imc }: { imc: number | null }) {
  if (imc === null) return null;
  const { faixa, tom } = classificarImc(imc);
  return (
    <div className={`flex items-center justify-between rounded-card border-2 bg-superficie px-4 py-2 ${TOM[tom]}`} aria-live="polite">
      <span className="text-sm text-texto">
        Seu IMC atual: <strong className="tabular-nums">{fmtImc(imc)}</strong>
      </span>
      <span className="text-sm font-semibold">{faixa}</span>
    </div>
  );
}
