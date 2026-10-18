import { cn } from "@/shared/lib/utils";

/**
 * O símbolo Visor (manual da marca 1.0, outubro de 2026; ADR 0011): uma balança vista de cima, com os
 * dois apoios para os pés, cujo visor é uma fita métrica em curva. O traço magenta não marca quilos
 * nem centímetros: marca a probabilidade calculada pelo modelo — é o único ponto de cor do símbolo.
 *
 * Os desenhos são os SVG do pacote, sem o manifesto C2PA, com as cores pelos tokens --marca-* de
 * tokens.css (as do manual, iguais nos dois temas). Regras do manual que valem aqui:
 *  - no fundo claro, a versão PRINCIPAL; no escuro, a NEGATIVA (corpo em papel, visor vazado, sem
 *    os apoios) — `variante="auto"` troca sozinha com o tema;
 *  - versão completa até 24 px; abaixo disso, a REDUZIDA (sem apoios, duas marcas na régua), até 16 px;
 *  - não distorcer, girar, trocar as cores nem aplicar sombra ou efeito; área de proteção de 3 m
 *    (3/19 do lado) em volta.
 *
 * Decorativo (`aria-hidden`): o nome do produto vem sempre em texto ao lado.
 */

const MARCAS_DA_REGUA =
  "M30.16 28.79L32.91 38.4M35.03 27.58L36.17 32.96M39.98 26.7L41.37 36.6M44.98 26.17L45.36 31.66" +
  "M55.02 26.17L54.64 31.66M60.02 26.7L58.63 36.6M64.97 27.58L63.83 32.96M69.84 28.79L67.09 38.4";

/** O corpo com o visor vazado (versões negativa e monocromática): o fundo aparece pela janela. */
const CORPO_VAZADO =
  "M32 12H68A20 20 0 0 1 88 32V68A20 20 0 0 1 68 88H32A20 20 0 0 1 12 68V32A20 20 0 0 1 32 12Z" +
  "M31 22H69A7 7 0 0 1 76 29V39A7 7 0 0 1 69 46H31A7 7 0 0 1 24 39V29A7 7 0 0 1 31 22Z";

const PONTEIRO = "M50 23.5V44.5";

type Variante = "auto" | "principal" | "negativa" | "reduzida";

type Props = {
  /** `auto` (padrão): principal no tema claro, negativa no escuro. */
  variante?: Variante;
  /** O tamanho vem daqui (`size-7`); o símbolo é quadrado. */
  className?: string;
};

export function Marca({ variante = "auto", className }: Props) {
  if (variante === "auto") {
    return (
      <span aria-hidden="true" className={cn("relative inline-block size-8 shrink-0", className)}>
        <SimboloPrincipal className="size-full dark:hidden" />
        <SimboloNegativo className="hidden size-full dark:block" />
      </span>
    );
  }
  const Desenho = { principal: SimboloPrincipal, negativa: SimboloNegativo, reduzida: SimboloReduzido }[variante];
  return <Desenho className={cn("size-8 shrink-0", className)} />;
}

function SimboloPrincipal({ className }: { className?: string }) {
  return (
    <svg viewBox="12 12 76 76" aria-hidden="true" focusable="false" className={className}>
      <rect x="12" y="12" width="76" height="76" rx="20" className="fill-marca-tinta" />
      <ellipse cx="37" cy="67" rx="7.5" ry="11" className="fill-marca-grafite" />
      <ellipse cx="63" cy="67" rx="7.5" ry="11" className="fill-marca-grafite" />
      <rect x="24" y="22" width="52" height="24" rx="7" className="fill-marca-visor" />
      <path d={MARCAS_DA_REGUA} fill="none" strokeWidth="2.2" strokeLinecap="round" className="stroke-marca-tinta" />
      <path d={PONTEIRO} fill="none" strokeWidth="3.2" className="stroke-marca-magenta" />
    </svg>
  );
}

function SimboloNegativo({ className }: { className?: string }) {
  return (
    <svg viewBox="12 12 76 76" aria-hidden="true" focusable="false" className={className}>
      <path d={CORPO_VAZADO} fillRule="evenodd" className="fill-marca-papel" />
      <path d={MARCAS_DA_REGUA} fill="none" strokeWidth="2.2" strokeLinecap="round" className="stroke-marca-papel" />
      <path d={PONTEIRO} fill="none" strokeWidth="3.2" className="stroke-marca-magenta" />
    </svg>
  );
}

/** A reduzida (abaixo de 24 px): sem apoios e com só duas marcas na régua, até 16 px. */
function SimboloReduzido({ className }: { className?: string }) {
  return (
    <svg viewBox="10 10 80 80" aria-hidden="true" focusable="false" className={className}>
      <rect x="10" y="10" width="80" height="80" rx="20" className="fill-marca-tinta" />
      <rect x="22" y="20" width="56" height="30" rx="8" className="fill-marca-visor" />
      <path d="M37 28L39 40M63 28L61 40" fill="none" strokeWidth="5" strokeLinecap="round" className="stroke-marca-tinta" />
      <path d="M50 22V48" fill="none" strokeWidth="7" className="stroke-marca-magenta" />
    </svg>
  );
}
