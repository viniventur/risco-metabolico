import { useState } from "react";
import { Bar, BarChart, CartesianGrid, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

import { EsqueletoBarras } from "@/features/painel/Esqueletos";
import { QueryState } from "@/shared/estados/QueryState";
import { fmtInt, fmtPontosPct } from "@/shared/format/ptBR";
import { ChartFrame } from "@/shared/graficos/ChartFrame";
import { FONTE_DO_EIXO, propsDoEixo } from "@/shared/graficos/eixos";
import { TabelaEquivalente } from "@/shared/graficos/TabelaEquivalente";
import { TooltipGrafico } from "@/shared/graficos/TooltipGrafico";
import { useChartTheme, type TemaGrafico } from "@/shared/tema/useChartTheme";

import { usePorCategoriaDiabetes } from "../api/painel";
import { FILTRO_VAZIO_DIABETES, filtroVazioDiabetes, semFiltros } from "../filtros/filtroDiabetes";
import { useCrossFilterDiabetes } from "../filtros/useCrossFilterDiabetes";
import { useFiltrosDiabetes } from "../filtros/useFiltrosDiabetes";
import { linhasDePrevalencia, rotuloCurtoDaFaixaEtaria, tetoDaPrevalencia, ticksDaPrevalencia, type LinhaPrevalencia } from "./prevalencia";

type LinhaColuna = LinhaPrevalencia & {
  rotuloCurto: string;
  /** a altura desenhada: a prevalência, ou 0 quando o grupo é pequeno demais */
  altura: number;
  /** a marca da BASE (só com filtro fora da idade): onde a coluna estaria no grupo da base inteira */
  marca: number | null;
};

type PropsDaColuna = {
  x?: number;
  y?: number;
  width?: number;
  height?: number;
  fill?: string;
  fillOpacity?: number | string;
  payload?: LinhaColuna;
  background?: { y?: number | null; height?: number | null };
};

const RAIO = 4;
/** Abaixo desta largura por coluna (px) os números não cabem sobre as colunas: ficam no balão e na tabela. */
const LARGURA_POR_ROTULO = 38;

/**
 * A coluna com o topo arredondado (4 px, quadrada na base), o traço da BASE quando há comparação e o
 * % sobre o que chegar mais alto, a coluna ou o traço (o número em tinta: texto nunca na cor da série).
 * A escala sai do fundo da faixa (`background`, a altura toda da área do gráfico): px por ponto = altura / teto.
 */
function fabricarColuna(teto: number, tema: TemaGrafico, comRotulo: boolean) {
  return function ColunaComMarca({ x = 0, y = 0, width = 0, height = 0, fill, fillOpacity, payload, background }: PropsDaColuna) {
    const r = Math.min(RAIO, width / 2, height);
    const caminho =
      height > 0 ? `M${x},${y + height} V${y + r} Q${x},${y} ${x + r},${y} H${x + width - r} Q${x + width},${y} ${x + width},${y + r} V${y + height} Z` : "";
    const topo = background?.y;
    const altura = background?.height;
    const marca =
      payload?.marca !== null && payload?.marca !== undefined && topo !== null && topo !== undefined && altura !== null && altura !== undefined && teto > 0
        ? topo + altura * (1 - payload.marca / teto)
        : null;
    const yDoRotulo = Math.min(y, marca ?? y) - 7;
    return (
      <g>
        {caminho ? <path d={caminho} fill={fill} fillOpacity={fillOpacity} /> : null}
        {marca !== null ? (
          <line x1={x - 3} x2={x + width + 3} y1={marca} y2={marca} stroke={tema.texto} strokeWidth={2} strokeLinecap="round" strokeOpacity={0.75} />
        ) : null}
        {payload && comRotulo ? (
          <text x={x + width / 2} y={yDoRotulo} textAnchor="middle" fontSize={FONTE_DO_EIXO} fill={payload.suprimido ? tema.textoFraco : tema.texto}>
            {payload.suprimido ? "—" : fmtPontosPct(payload.prevalencia)}
          </text>
        ) : null}
      </g>
    );
  };
}

type Carga = { active?: boolean; payload?: Array<{ payload: LinhaColuna; color?: string; fill?: string }> };

function TooltipIdade({ active, payload }: Carga) {
  if (!active || !payload?.[0]) return null;
  const l = payload[0].payload;
  if (l.suprimido) {
    return <TooltipGrafico titulo={l.rotulo} linhas={[{ rotulo: "Respostas", valor: fmtInt(l.contagem) }]} nota="Amostra pequena demais: o % não é exibido." />;
  }
  const linhas = [
    { rotulo: "Com diabetes", valor: fmtPontosPct(l.prevalencia), cor: payload[0].fill ?? payload[0].color },
    { rotulo: "Casos", valor: `${fmtInt(l.nDiabetes)} de ${fmtInt(l.contagem)}` },
  ];
  if (l.marca !== null) linhas.push({ rotulo: "Na base", valor: fmtPontosPct(l.prevalenciaBase), cor: undefined });
  return <TooltipGrafico titulo={l.rotulo} linhas={linhas} />;
}

/**
 * % com diabetes em cada faixa etária, em colunas na ordem da idade. Com filtro fora da idade, o traço
 * de cada coluna marca a mesma faixa na base inteira: o que o recorte tem de diferente salta sem conta.
 * ORIGEM de cross-filter de faixa etária: só destaca, não se filtra pelo próprio eixo; o eixo de % não
 * encolhe ao filtrar (o teto é o maior valor entre a base e o recorte).
 */
export function PrevalenciaPorIdade() {
  const { filtros } = useFiltrosDiabetes();
  const cf = useCrossFilterDiabetes("diabetes-idade", "faixa_etaria");
  const tema = useChartTheme();
  const [largura, setLargura] = useState(0);
  const recorte = semFiltros(filtros, "faixa_etaria");
  const q = usePorCategoriaDiabetes("faixa_etaria", recorte);
  const base = usePorCategoriaDiabetes("faixa_etaria", FILTRO_VAZIO_DIABETES);
  const comparar = !filtroVazioDiabetes(recorte);
  const linhas = linhasDePrevalencia(q.data, base.data);
  const dados: LinhaColuna[] = linhas.map((l) => ({
    ...l,
    rotuloCurto: rotuloCurtoDaFaixaEtaria(l.rotulo),
    altura: l.prevalencia ?? 0,
    marca: comparar ? l.prevalenciaBase : null,
  }));
  const teto = tetoDaPrevalencia(linhasDePrevalencia(base.data), linhas);
  const comRotulo = dados.length > 0 && largura / dados.length >= LARGURA_POR_ROTULO;
  const eixo = propsDoEixo(tema);

  return (
    <ChartFrame
      titulo="Diabetes por faixa etária"
      descricao={
        comparar
          ? "% com diabetes em cada faixa de idade no recorte; o traço marca a mesma faixa na base. Clique numa coluna para filtrar."
          : "% com diabetes em cada faixa de idade. Clique numa coluna para filtrar o painel."
      }
      altura={300}
      tabela={
        <TabelaEquivalente
          legenda="Porcentagem com diabetes por faixa etária"
          colunas={[
            { chave: "rotulo", rotulo: "Faixa etária" },
            { chave: "contagem", rotulo: "Respostas", alinhar: "right" },
            { chave: "casos", rotulo: "Com diabetes", alinhar: "right" },
            { chave: "prevalencia", rotulo: "% com diabetes", alinhar: "right" },
            { chave: "base", rotulo: "% na base", alinhar: "right" },
          ]}
          linhas={dados.map((d) => ({
            rotulo: d.rotulo,
            contagem: fmtInt(d.contagem),
            casos: fmtInt(d.nDiabetes),
            prevalencia: d.suprimido ? "amostra pequena" : fmtPontosPct(d.prevalencia),
            base: fmtPontosPct(d.prevalenciaBase),
          }))}
        />
      }
    >
      <QueryState
        carregando={q.isPending}
        erro={q.error}
        atualizando={q.isFetching && !q.isPending}
        aoTentarNovamente={() => void q.refetch()}
        esqueleto={<EsqueletoBarras barras={13} />}
      >
        <ResponsiveContainer width="100%" height="100%" initialDimension={{ width: 640, height: 300 }} onResize={(w) => setLargura(w)}>
          <BarChart data={dados} margin={{ top: 22, right: 4, bottom: 0, left: 0 }} barCategoryGap="22%">
            <CartesianGrid vertical={false} stroke={tema.grade} strokeOpacity={0.7} />
            <XAxis dataKey="rotuloCurto" interval={comRotulo ? 0 : "preserveStartEnd"} minTickGap={4} {...eixo} />
            <YAxis
              type="number"
              domain={[0, teto]}
              ticks={ticksDaPrevalencia(teto)}
              tickFormatter={(v: number) => `${fmtInt(v)}%`}
              width={44}
              {...eixo}
              axisLine={false}
            />
            <Tooltip content={<TooltipIdade />} cursor={{ fill: tema.grade, fillOpacity: 0.5 }} />
            <Bar
              dataKey="altura"
              isAnimationActive={false}
              className="cursor-pointer"
              background={{ fill: "transparent" }}
              shape={fabricarColuna(teto, tema, comRotulo)}
              maxBarSize={24}
              onClick={(_: unknown, i: number) => {
                const d = dados[i];
                if (d) cf.aoClicar(d.valor);
              }}
              onMouseEnter={(_: unknown, i: number) => {
                const d = dados[i];
                if (d) cf.aoEntrar(d.valor);
              }}
              onMouseLeave={cf.aoSair}
            >
              {dados.map((d) => (
                <Cell key={d.valor} fill={tema.diabetes} fillOpacity={cf.opacidade(d.valor)} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </QueryState>
    </ChartFrame>
  );
}
