import { cn } from "@/shared/lib/utils";

import { avisosDaRota } from "./avisosDaRota";

/**
 * A frase de dados fictícios de §3.2, literal e contígua — o portão test_aviso_de_dados_ficticios_presente
 * procura este arquivo. UMA vez por tela (no rodapé da casca): sem cópia `sr-only` e sem repetir no
 * cabeçalho, o leitor de tela a ouve uma vez só (docs/redesenho-front.md, 1.10).
 */
export function RodapeAviso({ className }: { className?: string }) {
  return (
    <p className={cn("text-xs leading-relaxed text-muted-foreground", className)} role="note">
      Os dados exibidos são fictícios e servem apenas para demonstração. Nenhum registro corresponde a uma pessoa real. Esta ferramenta é de triagem e não substitui avaliação clínica.
    </p>
  );
}

/**
 * A frase de dados da vertente diabetes (decisão D3), literal e contígua — o portão
 * test_aviso_de_dados_reais_no_front procura este arquivo. Também uma vez por tela, no rodapé.
 */
export function RodapeAvisoDadosReais({ className }: { className?: string }) {
  return (
    <p className={cn("text-xs leading-relaxed text-muted-foreground", className)} role="note">
      Os dados exibidos são respostas reais e anonimizadas de uma pesquisa pública de saúde dos Estados Unidos (BRFSS 2015, CDC) e servem apenas para demonstração. Nenhum registro identifica uma pessoa. Esta ferramenta é de triagem e não substitui avaliação clínica.
    </p>
  );
}

/**
 * O rodapé da tela: a frase de cada vertente que a rota mostra (avisosDaRota), uma vez cada. Nas telas
 * comuns, na ordem dos projetos (shared/projetos): a da diabetes primeiro.
 */
export function RodapeDaRota({ caminho }: { caminho: string }) {
  const avisos = avisosDaRota(caminho);
  return (
    <>
      {avisos.includes("reais") ? <RodapeAvisoDadosReais /> : null}
      {avisos.includes("ficticios") ? <RodapeAviso /> : null}
    </>
  );
}
