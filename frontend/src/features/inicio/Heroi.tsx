import { ArrowDown, ArrowRight, Calculator } from "lucide-react";
import { useEffect, useRef, type CSSProperties } from "react";
import { Link } from "react-router-dom";

import { useModelInfo } from "@/shared/api/endpoints/modelo";
import { fmtInt } from "@/shared/format/ptBR";
import { pedeMovimentoReduzido } from "@/shared/movimento/movimento";
import { NumeroQueConta } from "@/shared/movimento/NumeroQueConta";
import { useApareceuNaTela } from "@/shared/movimento/useApareceuNaTela";
import { Button } from "@/shared/ui/button";
import { Marca } from "@/shared/ui/Marca";
import { Skeleton } from "@/shared/ui/skeleton";

const RESUMO =
  "Dezesseis respostas sobre medidas corporais e hábitos viram, em milissegundos, a distribuição de probabilidade entre sete faixas de " +
  "composição corporal e um risco metabólico acumulado. A saída ordena prioridade de atenção; ela não fecha diagnóstico.";

/**
 * O visor da balança no pé do herói (o conceito do símbolo Visor): uma fita métrica em arco, desenhada
 * como trechos de um círculo enorme cujo centro fica bem abaixo do herói. Marcas a cada 0,8°, médias a
 * cada 4° e longas a cada 8°, de −100° a +100°: a parte visível tem uns 25° para cada lado, e a régua
 * gira até GIRO_MAXIMO com a rolagem sem nunca mostrar a ponta. Coordenadas no viewBox 0 0 1200 120.
 */
const CENTRO = { x: 600, y: 1460 };
const RAIO = 1400;
const MARCAS_DO_VISOR = Array.from({ length: 251 }, (_, i) => {
  const passo = i - 125;
  const angulo = (passo * 0.8 * Math.PI) / 180;
  const longa = passo % 10 === 0;
  const media = !longa && passo % 5 === 0;
  const comprimento = longa ? 28 : media ? 19 : 11;
  const [sen, cos] = [Math.sin(angulo), Math.cos(angulo)];
  return {
    chave: passo,
    longa,
    x1: CENTRO.x + RAIO * sen,
    y1: CENTRO.y - RAIO * cos,
    x2: CENTRO.x + (RAIO - comprimento) * sen,
    y2: CENTRO.y - (RAIO - comprimento) * cos,
  };
});

/**
 * O topo do Início: o símbolo Visor, o nome com brilho, o resumo entrando palavra por palavra, os três
 * botões e, ao lado, "como funciona" — os três números vêm de GET /model/info e contam até o valor.
 * No pé, o visor da balança (FundoDoHeroi).
 */
export function Heroi() {
  return (
    // O padding de baixo é a faixa do visor da balança (h-16): o desenho passa por baixo dos botões, não atrás deles.
    <section aria-labelledby="inicio-titulo" className="relative isolate overflow-hidden rounded-2xl border bg-card px-5 pt-9 pb-16 shadow-sm sm:px-10 sm:pt-12 sm:pb-16">
      <FundoDoHeroi />
      <div className="grid grid-cols-1 gap-10 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)] lg:items-center">
        <div className="flex flex-col items-start gap-5">
          {/* O símbolo, com a área de proteção do manual (3 m = 3/19 do lado) até o selo ao lado. */}
          <div className="flex items-center gap-3">
            <Marca className="size-12" />
            {/* As duas bases têm naturezas opostas e o selo diz as duas: a de obesidade é fictícia; a de
                diabetes, respostas reais e anonimizadas. Longo para uma linha no celular: o raio aceita a quebra. */}
            <p className="inline-flex items-center gap-2 rounded-2xl border border-warning/30 bg-warning/8 px-3 py-1 text-xs font-medium text-foreground backdrop-blur-sm">
            <span aria-hidden="true" className="relative flex size-2 shrink-0">
              <span className="absolute inline-flex size-full animate-ping rounded-full bg-warning/60 motion-reduce:animate-none" />
              <span className="relative inline-flex size-2 rounded-full bg-warning" />
            </span>
              Obesidade: dados fictícios · Diabetes: dados reais e anonimizados · triagem, não diagnóstico
            </p>
          </div>
          {/* O gradiente (background-clip: text) só pinta dentro da caixa do h1: com a entrelinha apertada, a
              perna do "g" de "Triagem" ficava de fora e saía cortada. A folga embaixo é em em, para valer em
              todo tamanho de fonte. */}
          <h1 id="inicio-titulo" className="texto-brilhante pb-[0.14em] text-4xl leading-[1.1] font-semibold tracking-tight text-balance sm:text-5xl lg:text-[3.4rem]">
            Triagem Metabólica
          </h1>
          <p className="max-w-2xl text-base leading-relaxed text-muted-foreground sm:text-[17px]">
            <PalavrasQueFocam texto={RESUMO} />
          </p>
          <div className="flex flex-wrap gap-2.5 pt-1">
            <Button asChild className="botao-brilho shadow-lg shadow-primary/30 transition-shadow hover:shadow-xl hover:shadow-primary/40">
              <Link to="/simulador">
                <Calculator aria-hidden="true" />
                Abrir o simulador
              </Link>
            </Button>
            <Button asChild variant="outline" className="group/botao">
              <Link to="/painel">
                Explorar o painel
                <ArrowRight aria-hidden="true" className="transition-transform duration-200 group-hover/botao:translate-x-1 motion-reduce:transition-none" />
              </Link>
            </Button>
            <Button asChild variant="ghost" className="group/botao text-muted-foreground">
              <a href="#sobre-o-projeto">
                Sobre o projeto
                <ArrowDown aria-hidden="true" className="transition-transform duration-200 group-hover/botao:translate-y-0.5 motion-reduce:transition-none" />
              </a>
            </Button>
          </div>
        </div>
        <ComoFunciona />
      </div>
    </section>
  );
}

/** O resumo entra palavra por palavra, desfocado (o BlurText do React Bits). O texto continua um só para o leitor de tela. */
function PalavrasQueFocam({ texto }: { texto: string }) {
  return texto.split(" ").map((palavra, i) => (
    <span key={i}>
      {i > 0 ? " " : null}
      <span className="palavra-desfocada" style={{ "--ordem": i } as CSSProperties}>
        {palavra}
      </span>
    </span>
  ));
}

function ComoFunciona() {
  const info = useModelInfo();
  const [ref, apareceu] = useApareceuNaTela<HTMLOListElement>("0px");
  const d = info.data;
  const passos = [
    { chave: "entrada", valor: d?.n_features_entrada, texto: "respostas sobre medidas corporais e hábitos" },
    { chave: "modelo", valor: d?.n_features_modelo, texto: "colunas que o pipeline monta: o IMC e o one-hot de domínio fechado" },
    { chave: "saida", valor: d?.ordem_clinica.length, texto: "probabilidades em ordem clínica e um risco acumulado" },
  ];

  return (
    <div className="borda-com-feixe rounded-2xl">
      <div className="rounded-2xl border bg-card/75 p-5 shadow-xl shadow-primary/5 backdrop-blur-md sm:p-6">
        <p className="text-xs font-semibold tracking-wider text-muted-foreground uppercase">Como funciona</p>
        <ol ref={ref} aria-label="Como funciona" className="mt-4 flex flex-col">
          {passos.map((passo, i) => (
            <li key={passo.chave} className="relative flex items-center gap-4 pb-5 last:pb-0">
              {i < passos.length - 1 ? (
                <span
                  aria-hidden="true"
                  className="linha-com-feixe linha-com-feixe--vertical absolute top-12 bottom-0 left-6 w-px"
                  style={{ "--atraso-feixe": `${i * 0.8}s` } as CSSProperties}
                />
              ) : null}
              <span className="relative flex size-12 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-xl font-semibold text-primary ring-1 ring-primary/20 ring-inset">
                {info.isPending ? <Skeleton className="h-6 w-7" /> : <NumeroQueConta valor={passo.valor} formatar={fmtInt} ativo={apareceu} duracaoMs={1200 + i * 300} />}
              </span>
              <span className="text-sm leading-snug">{passo.texto}</span>
              {i < passos.length - 1 ? <span className="sr-only">, depois</span> : null}
            </li>
          ))}
        </ol>
      </div>
    </div>
  );
}

/** Graus de giro por pixel rolado: o herói sai da tela por volta de 500 px, com a régua ~20° adiante. */
const GRAUS_POR_PIXEL = 0.04;
const GIRO_MAXIMO = 70;
/** A fração do caminho que a régua anda a cada quadro: a inércia do ponteiro de uma balança. */
const INERCIA = 0.12;

/**
 * Gira a régua com a rolagem da página: ao descer, no sentido anti-horário — as marcas andam para a
 * esquerda sob o ponteiro, como o peso aumentando; ao subir, voltam. A régua persegue o alvo com
 * inércia, num laço de quadros que só roda enquanto há caminho a andar. O giro vai no atributo
 * `transform` de um <g> por fora da `.visor-regua`, que tem a animação de entrada: no mesmo elemento,
 * a animação venceria. Com `prefers-reduced-motion`, a régua fica parada.
 */
function useGiroDaRolagem() {
  const ref = useRef<SVGGElement>(null);
  useEffect(() => {
    const grupo = ref.current;
    if (!grupo || pedeMovimentoReduzido()) return;
    let atual = 0;
    let alvo = 0;
    let quadro = 0;
    const passo = () => {
      atual += (alvo - atual) * INERCIA;
      if (Math.abs(alvo - atual) < 0.01) atual = alvo;
      grupo.setAttribute("transform", `rotate(${atual.toFixed(3)} ${CENTRO.x} ${CENTRO.y})`);
      quadro = atual === alvo ? 0 : requestAnimationFrame(passo);
    };
    const aoRolar = () => {
      alvo = -Math.min(window.scrollY * GRAUS_POR_PIXEL, GIRO_MAXIMO);
      if (!quadro) quadro = requestAnimationFrame(passo);
    };
    aoRolar();
    window.addEventListener("scroll", aoRolar, { passive: true });
    return () => {
      window.removeEventListener("scroll", aoRolar);
      cancelAnimationFrame(quadro);
    };
  }, []);
  return ref;
}

/**
 * O fundo, só desenho: o papel com um degradê leve, a grade de pontos e o visor da balança — a régua
 * gira e assenta no lugar quando a página abre, como uma balança ao subir nela, e continua girando com
 * a rolagem, sob o ponteiro magenta fixo (o único magenta fora do resultado da previsão, porque é o
 * ponteiro do próprio símbolo).
 */
function FundoDoHeroi() {
  const giro = useGiroDaRolagem();
  return (
    <div aria-hidden="true" className="pointer-events-none absolute inset-0 -z-10">
      <div className="absolute inset-0 bg-gradient-to-br from-muted/70 via-card to-card" />
      <div className="grade-de-pontos absolute inset-0" />
      <svg className="absolute inset-x-0 bottom-0 h-16 w-full text-foreground" viewBox="0 0 1200 120" preserveAspectRatio="xMidYMax slice" fill="none">
        <g ref={giro}>
          <g className="visor-regua" stroke="currentColor" strokeLinecap="round">
            {MARCAS_DO_VISOR.map((m) => (
              <line key={m.chave} x1={m.x1} y1={m.y1} x2={m.x2} y2={m.y2} strokeWidth={m.longa ? 2.4 : 1.6} strokeOpacity={m.longa ? 0.45 : 0.25} />
            ))}
          </g>
        </g>
        <path d="M600 46V118" className="stroke-marca-magenta" strokeWidth={3.2} />
      </svg>
    </div>
  );
}
