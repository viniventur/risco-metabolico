import { OctagonAlert, TriangleAlert } from "lucide-react";

import type { ErroApi } from "@/shared/api/http";
import { Alert, AlertDescription, AlertTitle } from "@/shared/ui/alert";

import { textoDoErro } from "./textoDoErro";

type Props = { campos?: string[]; erro?: ErroApi | null };

const ROTULOS: Record<string, string> = { Idade: "idade", Altura: "altura", Peso: "peso" };

/**
 * Dois usos, um componente: os campos fora da faixa de treino (honestidade sobre extrapolação) e o
 * erro da API — inclusive o 429, que vira faixa com os segundos, nunca laço (6.8.3).
 */
export function AvisoExtrapolacao({ campos, erro }: Props) {
  if (erro) {
    return (
      <Alert variant="destructive" role="alert">
        <OctagonAlert aria-hidden="true" />
        <AlertTitle>{erro.status === 429 ? "Limite de predições" : "A predição não foi calculada"}</AlertTitle>
        <AlertDescription>{textoDoErro(erro)}</AlertDescription>
      </Alert>
    );
  }
  if (!campos || campos.length === 0) return null;
  const lista = campos.map((c) => ROTULOS[c] ?? c).join(", ");
  return (
    <Alert variant="warning" role="status">
      <TriangleAlert aria-hidden="true" />
      <AlertTitle>Fora da faixa do treino</AlertTitle>
      <AlertDescription>
        Valores de <strong className="font-semibold text-foreground">{lista}</strong> fora da faixa observada no treino: a estimativa extrapola o
        que o modelo viu.
      </AlertDescription>
    </Alert>
  );
}
