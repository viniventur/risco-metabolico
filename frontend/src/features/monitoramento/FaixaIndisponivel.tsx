import { DatabaseZap, Info } from "lucide-react";

import { fmtInt } from "@/shared/format/ptBR";
import { Alert, AlertDescription, AlertTitle } from "@/shared/ui/alert";

type Props = { disponivel: boolean; motivo?: string | null; nAmostra: number; nMinimo: number };

/** Sem `motivo` da API, a mesma frase que ela manda. Desde a ADR 0009 o banco não hiberna: não responder é reinício, deploy ou falha. */
const SEM_BANCO =
  "O histórico de predições está indisponível no momento — o banco não respondeu (reinício, deploy ou falha). O restante do painel não depende dele.";

/**
 * Faixa de aviso, NUNCA tela de erro (§7.6): banco fora, ou amostra abaixo do mínimo. `role="status"`
 * e não `alert`: amostra insuficiente é resultado, e o banco fora não impede o resto da página.
 * Uma frase só — antes a do front e, entre parênteses, a mesma vinda da API (redesenho, 1.18).
 */
export function FaixaIndisponivel({ disponivel, motivo, nAmostra, nMinimo }: Props) {
  if (!disponivel) {
    return (
      <Alert variant="warning" role="status">
        <DatabaseZap aria-hidden="true" />
        <AlertTitle>Histórico de predições indisponível</AlertTitle>
        <AlertDescription>{motivo || SEM_BANCO}</AlertDescription>
      </Alert>
    );
  }
  if (nAmostra < nMinimo) {
    return (
      <Alert variant="info" role="status">
        <Info aria-hidden="true" />
        <AlertTitle>
          Amostra insuficiente: {fmtInt(nAmostra)} {nAmostra === 1 ? "predição" : "predições"} na janela, abaixo do mínimo de {fmtInt(nMinimo)}
        </AlertTitle>
        <AlertDescription>
          Abaixo do mínimo o PSI não é calculado. É um resultado, não uma falha — a tabela mostra as contagens sem a coluna de PSI.
        </AlertDescription>
      </Alert>
    );
  }
  return null;
}
