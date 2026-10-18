import type { SVGProps } from "react";

import { CAMINHO_DO_NOME } from "./caminhoDoNome";

/**
 * A marca de quem fez o projeto (pacote da marca de Vinícius Ventura, versão 1.0, outubro de 2026).
 * Entra SÓ nos créditos (./CreditosDoAutor.tsx): a marca do produto é o `<Marca>` de shared/ui.
 *
 * O símbolo é um V com o "chapéu" da econometria (ŷ, β̂: o valor estimado), que também é outro V de
 * cabeça para baixo. Regras do manual que valem aqui:
 *  - o chapéu é SEMPRE o ciano da marca, em qualquer tema: o token `--autor-ciano` de tokens.css,
 *    o único que não muda no escuro, de propósito;
 *  - o V e o nome acompanham a cor do texto (`currentColor`): quem usa escolhe pelo `className`;
 *  - mínimo de 16 px de altura para o símbolo; não distorcer, girar nem aplicar efeitos.
 *
 * O nome vem em contornos (./caminhoDoNome.ts): sai igual em qualquer máquina, sem depender de fonte.
 */

const CHAPEU = "11.09,18.24 29.33,0 47.57,18.24 39.09,18.24 29.33,8.48 19.57,18.24";
const V = "0,32.24 10.66,32.24 29.33,61.8 48,32.24 58.66,32.24 29.33,78.68";

/**
 * A caixa do nome dentro da assinatura (medida sobre o caminho): do acento do "í" (y 30,86) à linha
 * de base (y 65,40), 356,05 × 34,54 — 10,3 vezes mais largo do que alto.
 */
const CAIXA_DO_NOME = "105.13 30.86 356.05 34.54";

type Props = Omit<SVGProps<SVGSVGElement>, "viewBox" | "children">;

/** O símbolo sozinho. Decorativo: quem o usa dá o nome ao link em volta. */
export function SimboloDoAutor(props: Props) {
  return (
    <svg viewBox="0 0 58.66 78.68" aria-hidden="true" focusable="false" {...props}>
      <polygon points={CHAPEU} className="fill-autor" />
      <polygon points={V} fill="currentColor" />
    </svg>
  );
}

/** Só o nome, na cor do texto. A altura vem do `className` (`h-3 w-auto`); a largura é 10,3 vezes ela. */
export function NomeDoAutor(props: Props) {
  return (
    <svg viewBox={CAIXA_DO_NOME} aria-hidden="true" focusable="false" {...props}>
      <path d={CAMINHO_DO_NOME} fill="currentColor" />
    </svg>
  );
}
