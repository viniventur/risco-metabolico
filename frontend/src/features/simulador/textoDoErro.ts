import type { ErroApi } from "@/shared/api/http";

/** O texto do erro da API, com os segundos do 429 quando vierem no envelope. */
export function textoDoErro(erro: ErroApi): string {
  const detalhes = erro.detalhes as { retry_after_s?: number } | Array<{ campo?: string; mensagem?: string }> | undefined;
  if (erro.status === 429 && detalhes && !Array.isArray(detalhes) && detalhes.retry_after_s) {
    return `Muitas predições seguidas. Tente de novo em ${detalhes.retry_after_s} s.`;
  }
  if (Array.isArray(detalhes) && detalhes.length > 0) {
    return detalhes.map((d) => `${d.campo ?? ""}: ${d.mensagem ?? ""}`.trim()).join("; ");
  }
  return erro.mensagem;
}
