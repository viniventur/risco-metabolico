import { cn } from "@/shared/lib/utils";
import { assentar, DURACAO_DA_CONTAGEM_MS, useContagem } from "@/shared/movimento/useContagem";

/**
 * O mostrador de 0 a 100: um arco de 240° (0 em −120°, 100 em +120°, graus a partir do topo, no
 * sentido horário), como o de um velocímetro. Coordenadas no viewBox 0 0 104 92, desenhado em
 * 104 px: uma unidade, um pixel.
 */
const ABERTURA = 120;
const CENTRO = { x: 52, y: 50 };
const RAIO = 44;

function pontoNoArco(valor: number, raio: number): { x: number; y: number } {
  const angulo = (((valor / 100) * 2 - 1) * ABERTURA * Math.PI) / 180;
  return { x: CENTRO.x + raio * Math.sin(angulo), y: CENTRO.y - raio * Math.cos(angulo) };
}

/** Os traços da régua do visor (Heroi.tsx), no arco do mostrador: curta a cada 2, média a cada 10, longa a cada 20. */
const MARCAS = Array.from({ length: 51 }, (_, i) => {
  const valor = i * 2;
  const longa = valor % 20 === 0;
  const media = !longa && valor % 10 === 0;
  const comprimento = longa ? 9 : media ? 6 : 3.5;
  const fora = pontoNoArco(valor, RAIO);
  const dentro = pontoNoArco(valor, RAIO - comprimento);
  return { valor, longa, x1: fora.x, y1: fora.y, x2: dentro.x, y2: dentro.y };
});

const ZERO = pontoNoArco(0, RAIO);
const CEM = pontoNoArco(100, RAIO);

type Props = {
  fracao: number | undefined;
  ativo: boolean;
  /**
   * Uma marca de referência, na mesma escala de `fracao`: um traço tracejado que passa da régua e dá
   * sentido ao ponteiro (o acaso, o alvo, o ideal). O texto dela fica escrito no cartão.
   */
  referencia?: number;
  /** Os números das pontas da régua; a escala é sempre a de `fracao` (0 a 1) vezes 100. */
  rotulos?: readonly [string, string];
  className?: string;
};

/**
 * O velocímetro das métricas do Início, no desenho do visor da balança: os traços da régua do herói
 * num arco de 0 a 100 e o ponteiro magenta do símbolo — o traço que, na marca, marca o que o modelo
 * calcula. Quando `ativo` liga, o ponteiro sai do zero junto com o número ao lado, passa um pouco do
 * ponto e assenta; as marcas por onde ele passou ficam em tinta cheia. Só desenho (`aria-hidden`): o
 * valor e a referência estão escritos ao lado. Com `prefers-reduced-motion`, nasce no valor.
 */
export function Velocimetro({ fracao, ativo, referencia, rotulos = ["0", "100"], className }: Props) {
  const bruto = useContagem(fracao === undefined ? undefined : fracao * 100, ativo, DURACAO_DA_CONTAGEM_MS, assentar);
  // O balanço passa do ponto: perto do fim da escala, o ponteiro bate no batente do 100 e volta.
  const atual = Math.min(Math.max(bruto, 0), 100);
  const giro = ((atual / 100) * 2 - 1) * ABERTURA;
  // A referência passa um pouco da régua por fora e entra até o fim dos traços longos.
  const marca = referencia === undefined ? null : { fora: pontoNoArco(referencia * 100, RAIO + 3.5), dentro: pontoNoArco(referencia * 100, RAIO - 12) };
  return (
    <svg data-velocimetro="" viewBox="0 0 104 92" className={cn("h-[92px] w-[104px] shrink-0 text-foreground", className)} fill="none" aria-hidden="true">
      <g strokeLinecap="round" stroke="currentColor">
        {MARCAS.map((m) => {
          const passou = ativo && m.valor <= atual;
          return (
            <line
              key={m.valor}
              x1={m.x1}
              y1={m.y1}
              x2={m.x2}
              y2={m.y2}
              strokeWidth={m.longa ? 1.8 : 1.2}
              strokeOpacity={passou ? (m.longa ? 0.9 : 0.6) : m.longa ? 0.32 : 0.18}
            />
          );
        })}
      </g>
      {marca ? (
        <line
          data-referencia=""
          x1={marca.fora.x}
          y1={marca.fora.y}
          x2={marca.dentro.x}
          y2={marca.dentro.y}
          strokeWidth={1.6}
          strokeDasharray="2.2 1.8"
          strokeLinecap="round"
          className="stroke-foreground"
        />
      ) : null}
      <text x={ZERO.x} y={ZERO.y + 15} textAnchor="middle" fontSize={11} className="fill-muted-foreground">
        {rotulos[0]}
      </text>
      <text x={CEM.x} y={CEM.y + 15} textAnchor="middle" fontSize={11} className="fill-muted-foreground">
        {rotulos[1]}
      </text>
      {/* O ponteiro em pé (do centro até passar da régua) e girado até o valor; o rabo curto do outro lado do eixo. */}
      <g transform={`rotate(${giro.toFixed(2)} ${CENTRO.x} ${CENTRO.y})`} opacity={ativo ? 1 : 0}>
        <line x1={CENTRO.x} y1={CENTRO.y + 7} x2={CENTRO.x} y2={CENTRO.y - RAIO - 1.5} strokeWidth={2} strokeLinecap="round" className="stroke-marca-magenta" />
      </g>
      <circle cx={CENTRO.x} cy={CENTRO.y} r={3.4} className="fill-foreground" />
    </svg>
  );
}
