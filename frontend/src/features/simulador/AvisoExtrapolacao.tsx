import type { ErroApi } from "@/shared/api/http";
import { IconeAlerta } from "@/shared/ui/icones";

type Props = { campos?: string[]; erro?: ErroApi | null };

const ROTULOS: Record<string, string> = { Idade: "idade", Altura: "altura", Peso: "peso" };

/**
 * Dois usos, um componente: os campos fora da faixa de treino (honestidade sobre extrapolação) e o
 * erro da API — inclusive o 429, que vira faixa com os segundos, nunca laço (6.8.3).
 */
export function AvisoExtrapolacao({ campos, erro }: Props) {
  if (erro) {
    const detalhes = erro.detalhes as { retry_after_s?: number } | Array<{ campo?: string; mensagem?: string }> | undefined;
    let texto = erro.mensagem;
    if (erro.status === 429 && detalhes && !Array.isArray(detalhes) && detalhes.retry_after_s) {
      texto = `Muitas predições seguidas. Tente de novo em ${detalhes.retry_after_s} s.`;
    } else if (Array.isArray(detalhes) && detalhes.length > 0) {
      texto = detalhes.map((d) => `${d.campo ?? ""}: ${d.mensagem ?? ""}`.trim()).join("; ");
    }
    return (
      <div className="flex items-start gap-2 rounded-card border border-perigo bg-superficie px-4 py-2 text-sm text-texto" role="alert">
        <IconeAlerta className="shrink-0 text-perigo" />
        <span>{texto}</span>
      </div>
    );
  }
  if (!campos || campos.length === 0) return null;
  const lista = campos.map((c) => ROTULOS[c] ?? c).join(", ");
  return (
    <div className="flex items-start gap-2 rounded-card border border-alerta bg-superficie px-4 py-2 text-sm text-texto" role="status">
      <IconeAlerta className="shrink-0 text-alerta" />
      <span>
        Valores de <strong>{lista}</strong> fora da faixa observada no treino: a estimativa extrapola o que o modelo viu.
      </span>
    </div>
  );
}
