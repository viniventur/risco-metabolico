import { RefreshCw, TriangleAlert } from "lucide-react";

import type { ErroApi } from "@/shared/api/http";
import { Alert, AlertDescription, AlertTitle } from "@/shared/ui/alert";
import { Button } from "@/shared/ui/button";

type Props = {
  erro: ErroApi | Error;
  titulo?: string;
  aoTentarNovamente?: () => void;
};

/** A mensagem do envelope da API, traduzida quando o código diz mais do que o texto. */
function mensagemDoErro(erro: ErroApi | Error): string {
  if ("status" in erro) {
    if (erro.status === 429) return "Muitas consultas seguidas. Aguarde um instante e tente de novo.";
    if (erro.status === 0 || erro.status >= 500) return `${erro.mensagem} O serviço pode estar reiniciando.`;
    return erro.mensagem;
  }
  return erro.message;
}

/**
 * Erro dentro do cartão que falhou, com a saída ao lado. O QueryClient não repete sozinho
 * (`retry: 0`, para 429 nunca virar laço): sem este botão, uma consulta que falhou ficaria falhada
 * até a pessoa trocar de tela.
 */
export function ErroInline({ erro, titulo = "Não foi possível carregar", aoTentarNovamente }: Props) {
  return (
    <Alert variant="destructive" role="alert">
      <TriangleAlert aria-hidden="true" />
      <AlertTitle>{titulo}</AlertTitle>
      <AlertDescription className="flex flex-col items-start gap-3">
        <span>{mensagemDoErro(erro)}</span>
        {aoTentarNovamente ? (
          <Button variant="outline" size="sm" onClick={aoTentarNovamente}>
            <RefreshCw aria-hidden="true" />
            Tentar novamente
          </Button>
        ) : null}
      </AlertDescription>
    </Alert>
  );
}
