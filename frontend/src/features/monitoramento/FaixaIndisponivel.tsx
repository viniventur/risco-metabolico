import { fmtInt } from "@/shared/format/ptBR";
import { IconeAlerta } from "@/shared/ui/icones";

type Props = { disponivel: boolean; motivo?: string | null; nAmostra: number; nMinimo: number };

/** Faixa de aviso, NUNCA tela de erro (§7.6): banco pausado/frio, ou amostra abaixo do mínimo. */
export function FaixaIndisponivel({ disponivel, motivo, nAmostra, nMinimo }: Props) {
  if (!disponivel) {
    return (
      <div role="status" className="flex items-start gap-2 rounded-card border border-alerta bg-superficie px-4 py-3 text-sm text-texto">
        <IconeAlerta className="shrink-0 text-alerta" />
        <span>
          O histórico de predições está indisponível no momento — o banco do plano gratuito hiberna por inatividade. O restante do
          painel não depende dele.
          {motivo ? <span className="text-texto-fraco"> ({motivo})</span> : null}
        </span>
      </div>
    );
  }
  if (nAmostra < nMinimo) {
    return (
      <div role="status" className="flex items-start gap-2 rounded-card border border-borda bg-superficie px-4 py-3 text-sm text-texto">
        <IconeAlerta className="shrink-0 text-texto-fraco" />
        <span>
          Amostra insuficiente: {fmtInt(nAmostra)} {nAmostra === 1 ? "predição" : "predições"} na janela, abaixo do mínimo de{" "}
          {fmtInt(nMinimo)} para calcular o PSI. É um resultado, não uma falha — a tabela mostra as contagens sem a coluna de PSI.
        </span>
      </div>
    );
  }
  return null;
}
