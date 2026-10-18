import { cn } from "@/shared/lib/utils";

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
