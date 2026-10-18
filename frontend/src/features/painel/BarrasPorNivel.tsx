import { Bar, BarChart, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

import { maximoDe, pivotar, tetoDoEixo } from "@/shared/filtros/agregadoUtil";
import { FILTRO_VAZIO } from "@/shared/filtros/filtroSchema";
import { useAgregado } from "@/shared/filtros/useAgregado";
import { useCrossFilter } from "@/shared/filtros/useCrossFilter";
import { useFiltros } from "@/shared/filtros/useFiltros";
import { fmtInt, fmtPontosPct } from "@/shared/format/ptBR";
import { ChartFrame } from "@/shared/graficos/ChartFrame";
import { FONTE_DO_EIXO, larguraDoRotulo, propsDoEixo } from "@/shared/graficos/eixos";
import { LegendaHtml } from "@/shared/graficos/LegendaHtml";
import { TabelaEquivalente } from "@/shared/graficos/TabelaEquivalente";
import { TooltipGrafico } from "@/shared/graficos/TooltipGrafico";
import { QueryState } from "@/shared/estados/QueryState";
import { useChartTheme, type TemaGrafico } from "@/shared/tema/useChartTheme";

import { EsqueletoBarras } from "./Esqueletos";
import { amostraDaFamilia, FAMILIAS } from "./niveis";

type LinhaNivel = {
  categoria: string;
  rotulo: string;
  contagem: number;
  pct: number | null;
  /** % da classe na base inteira */
  pctBase: number | null;
  /** onde a barra estaria se o recorte tivesse a composição da base (só com filtro fora do nível) */
  esperado: number | null;
};

type PropsDaBarra = {
  x?: number;
  y?: number;
  width?: number;
  height?: number;
  fill?: string;
  fillOpacity?: number | string;
  payload?: LinhaNivel;
  background?: { x?: number | null; width?: number | null };
};

const RAIO = 4;

/**
 * A barra com a ponta arredondada (4 px, quadrada na base), a marca da BASE quando há comparação — um
 * traço vertical onde a barra terminaria se o recorte tivesse a composição da base — e o rótulo
 * "351 · 16,6%" depois do que chegar mais longe, a barra ou a marca (o número em tinta, a fração em
 * cinza: texto nunca na cor da série). A escala sai do fundo da faixa (`background`, a largura toda
 * da área do gráfico): px por registro = largura / teto.
 */
function fabricarBarra(teto: number, tema: TemaGrafico) {
  return function BarraComMarca({ x = 0, y = 0, width = 0, height = 0, fill, fillOpacity, payload, background }: PropsDaBarra) {
    const r = Math.min(RAIO, width / 2, height / 2);
    const caminho =
      width > 0
        ? `M${x},${y} H${x + width - r} Q${x + width},${y} ${x + width},${y + r} V${y + height - r} Q${x + width},${y + height} ${x + width - r},${y + height} H${x} Z`
        : "";
    const esperado = payload?.esperado;
    const largura = background?.width;
    const marca =
      esperado !== null && esperado !== undefined && largura !== null && largura !== undefined && teto > 0
        ? (background?.x ?? x) + (esperado / teto) * largura
        : null;
    const fimDoRotulo = Math.max(x + width, marca ?? 0) + 7;
    return (
      <g>
        {caminho ? <path d={caminho} fill={fill} fillOpacity={fillOpacity} /> : null}
        {marca !== null ? (
          <line x1={marca} x2={marca} y1={y - 3} y2={y + height + 3} stroke={tema.texto} strokeWidth={2} strokeLinecap="round" strokeOpacity={0.75} />
        ) : null}
        {payload ? (
          <text x={fimDoRotulo} y={y + height / 2} dy="0.35em" fontSize={FONTE_DO_EIXO}>
            <tspan fill={tema.texto} fontWeight={600}>
              {fmtInt(payload.contagem)}
            </tspan>
            <tspan fill={tema.textoFraco}> · {fmtPontosPct(payload.pct)}</tspan>
          </text>
        ) : null}
      </g>
    );
  };
}

type Carga = { active?: boolean; payload?: Array<{ payload: LinhaNivel; color?: string; fill?: string }> };

function TooltipNivel({ active, payload }: Carga) {
  if (!active || !payload?.[0]) return null;
  const l = payload[0].payload;
  const linhas = [
    { rotulo: "Registros", valor: fmtInt(l.contagem), cor: payload[0].fill ?? payload[0].color },
    { rotulo: "Do recorte", valor: fmtPontosPct(l.pct) },
  ];
  if (l.esperado !== null) linhas.push({ rotulo: "Na base", valor: fmtPontosPct(l.pctBase), cor: undefined });
  return <TooltipGrafico titulo={l.rotulo} linhas={linhas} />;
}

/**
 * Barras horizontais por nível, em ordem clínica, cada uma na cor do seu nível: a matiz da família
 * (abaixo do peso, normal, sobrepeso, obesidade) e o degradê do grau dentro dela — o leitor vê as
 * famílias sem ler os rótulos, e o grau mais grave é o mais saliente. Com filtro fora do nível, a
 * marca da base em cada barra mostra o que o recorte tem de diferente.
 * ORIGEM de cross-filter: só destaca, não se filtra pelo próprio eixo.
 */
export function BarrasPorNivel() {
  const { filtros } = useFiltros();
  const cf = useCrossFilter("por-nivel", "nivel");
  const tema = useChartTheme();
  // O gráfico de origem não se filtra pelo próprio eixo: envia os filtros SEM `nivel` (7.3).
  const semNivel = { ...filtros, nivel: [] };
  const q = useAgregado("nivel", "contagem", semNivel);
  // Domínio do eixo de valor derivado do dataset sem cross-filter: o eixo não pula ao filtrar.
  const global = useAgregado("nivel", "contagem", FILTRO_VAZIO);
  const comparar = Object.values(semNivel).some((v) => v.length > 0);
  const pctGlobal = new Map(pivotar(global.data).map((l) => [l.categoria, l.valores.pct ?? null]));
  const total = q.data?.total_filtrado ?? 0;
  const dados: LinhaNivel[] = pivotar(q.data).map((l) => {
    const pctBase = pctGlobal.get(l.categoria) ?? null;
    return {
      categoria: l.categoria,
      rotulo: l.categoria,
      contagem: l.valores.contagem ?? 0,
      pct: l.valores.pct ?? null,
      pctBase,
      esperado: comparar && pctBase !== null ? (pctBase / 100) * total : null,
    };
  });
  const teto = tetoDoEixo(maximoDe(pivotar(global.data), "contagem"));
  const eixo = propsDoEixo(tema);

  return (
    <ChartFrame
      titulo="Divisão por Nível de Obesidade"
      descricao={
        comparar
          ? "Registros por classe no recorte; o traço marca onde a barra estaria com a composição da base. Clique numa barra para filtrar."
          : "Registros por classe, em ordem clínica: a cor é a família, o tom é o grau. Clique numa barra para filtrar o painel."
      }
      altura={300}
      tabela={
        <TabelaEquivalente
          legenda="Registros por nível de obesidade"
          colunas={[
            { chave: "rotulo", rotulo: "Nível" },
            { chave: "contagem", rotulo: "Registros", alinhar: "right" },
            { chave: "pct", rotulo: "% do recorte", alinhar: "right" },
            { chave: "pctBase", rotulo: "% na base", alinhar: "right" },
          ]}
          linhas={dados.map((d) => ({ rotulo: d.rotulo, contagem: fmtInt(d.contagem), pct: fmtPontosPct(d.pct), pctBase: fmtPontosPct(d.pctBase) }))}
        />
      }
      legenda={<LegendaHtml titulo="Famílias de nível" itens={FAMILIAS.map((f) => ({ rotulo: f.rotulo, cor: amostraDaFamilia(f.niveis, tema), forma: "quadrado" as const }))} />}
    >
      <QueryState
        carregando={q.isPending}
        erro={q.error}
        atualizando={q.isFetching && !q.isPending}
        aoTentarNovamente={() => void q.refetch()}
        esqueleto={<EsqueletoBarras horizontal barras={7} />}
      >
        <ResponsiveContainer width="100%" height="100%" initialDimension={{ width: 600, height: 300 }}>
          <BarChart data={dados} layout="vertical" margin={{ top: 4, right: 88, bottom: 0, left: 0 }} barCategoryGap="24%">
            <XAxis type="number" domain={[0, teto]} tickFormatter={(v: number) => fmtInt(v)} {...eixo} />
            <YAxis type="category" dataKey="rotulo" width={larguraDoRotulo(dados.map((d) => d.rotulo))} interval={0} {...eixo} axisLine={false} />
            <Tooltip content={<TooltipNivel />} cursor={{ fill: tema.grade, fillOpacity: 0.5 }} />
            <Bar
              dataKey="contagem"
              isAnimationActive={false}
              className="cursor-pointer"
              background={{ fill: "transparent" }}
              shape={fabricarBarra(teto, tema)}
              maxBarSize={24}
              onClick={(_: unknown, i: number) => {
                const d = dados[i];
                if (d) cf.aoClicar(d.categoria);
              }}
              onMouseEnter={(_: unknown, i: number) => {
                const d = dados[i];
                if (d) cf.aoEntrar(d.categoria);
              }}
              onMouseLeave={cf.aoSair}
            >
              {dados.map((d) => (
                <Cell key={d.categoria} fill={tema.corDoNivel[d.categoria]} fillOpacity={cf.opacidade(d.categoria)} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </QueryState>
    </ChartFrame>
  );
}
