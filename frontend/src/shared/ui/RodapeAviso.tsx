import { FRASE_DADOS_FICTICIOS } from "@/shared/dominio";

/** A frase de dados fictícios de §3.2 — o portão test_aviso_de_dados_ficticios_presente procura este arquivo. */
export function RodapeAviso({ extra }: { extra?: string }) {
  return (
    <p className="text-sm text-texto-fraco" role="note">
      Os dados exibidos são fictícios e servem apenas para demonstração. Nenhum registro corresponde a uma pessoa real.
      Esta ferramenta é de triagem e não substitui avaliação clínica.
      {extra ? ` ${extra}` : null}
      <span className="sr-only">{FRASE_DADOS_FICTICIOS}</span>
    </p>
  );
}
