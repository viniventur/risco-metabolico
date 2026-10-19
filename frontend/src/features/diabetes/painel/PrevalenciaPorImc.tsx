import { Bar, BarChart, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

import { EsqueletoBarras } from "@/features/painel/Esqueletos";
import { QueryState } from "@/shared/estados/QueryState";
import { fmtInt, fmtPontosPct } from "@/shared/format/ptBR";
import { ChartFrame } from "@/shared/graficos/ChartFrame";
import { FONTE_DO_EIXO, larguraDoRotulo, propsDoEixo } from "@/shared/graficos/eixos";
import { TabelaEquivalente } from "@/shared/graficos/TabelaEquivalente";
import { TooltipGrafico } from "@/shared/graficos/TooltipGrafico";
import { useChartTheme, type TemaGrafico } from "@/shared/tema/useChartTheme";

import { usePorCategoriaDiabetes } from "../api/painel";
import { FILTRO_VAZIO_DIABETES, filtroVazioDiabetes, semFiltros } from "../filtros/filtroDiabetes";
import { useCrossFilterDiabetes } from "../filtros/useCrossFilterDiabetes";
import { useFiltrosDiabetes } from "../filtros/useFiltrosDiabetes";
import { linhasDePrevalencia, tetoDaPrevalencia, ticksDaPrevalencia, type LinhaPrevalencia } from "./prevalencia";

type LinhaBarra = LinhaPrevalencia & { altura: number; marca: number | null };

type PropsDaBarra = {
  x?: number;
  y?: number;
  width?: number;
  height?: number;
  fill?: string;
  fillOpacity?: number | string;
  payload?: LinhaBarra;
  background?: { x?: number | null; width?: number | null };
};

const RAIO = 4;

/**
 * A barra com a ponta arredondada (4 px, quadrada na base), o traço da BASE quando há comparação e o
 * rótulo "19,2%" depois do que chegar mais longe (o desenho de BarrasPorNivel, da obesidade). A escala
 * sai do fundo da faixa: px por ponto = largura da área / teto.
 */
function fabricarBarra(teto: number, tema: TemaGrafico) {
  return function BarraComMarca({ x = 0, y = 0, width = 0, height = 0, fill, fillOpacity, payload, background }: PropsDaBarra) {
    const r = Math.min(RAIO, width / 2, height / 2);
    const caminho =
      width > 0
        ? `M${x},${y} H${x + width - r} Q${x + width},${y} ${x + width},${y + r} V${y + height - r} Q${x + width},${y + height} ${x + width - r},${y + height} H${x} Z`
        : "";
    const largura = background?.width;
    const marca =
      payload?.marca !== null && payload?.marca !== undefined && largura !== null && largura !== undefined && teto > 0
        ? (background?.x ?? x) + (payload.marca / teto) * largura
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
            {payload.suprimido ? (
              <tspan fill={tema.textoFraco}>amostra pequena</tspan>
            ) : (
              <>
                <tspan fill={tema.texto} fontWeight={600}>
                  {fmtPontosPct(payload.prevalencia)}
                </tspan>
                <tspan fill={tema.textoFraco}> · {fmtInt(payload.contagem)}</tspan>
              </>
            )}
          </text>
        ) : null}
      </g>
    );
  };
}

type Carga = { active?: boolean; payload?: Array<{ payload: LinhaBarra; color?: string; fill?: string }> };

function TooltipImc({ active, payload }: Carga) {
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
 * % com diabetes em cada faixa de IMC (os cortes da OMS, os mesmos do cartão de IMC do simulador), em
 * barras na ordem da escala, com o número de respostas de cada faixa ao lado. Com filtro fora do IMC,
 * o traço de cada barra marca a mesma faixa na base inteira.
 * ORIGEM de cross-filter de faixa de IMC: só destaca, não se filtra pelo próprio eixo.
 */
export function PrevalenciaPorImc() {
  const { filtros } = useFiltrosDiabetes();
  const cf = useCrossFilterDiabetes("diabetes-imc", "faixa_imc");
  const tema = useChartTheme();
  const recorte = semFiltros(filtros, "faixa_imc");
  const q = usePorCategoriaDiabetes("faixa_imc", recorte);
  const base = usePorCategoriaDiabetes("faixa_imc", FILTRO_VAZIO_DIABETES);
  const comparar = !filtroVazioDiabetes(recorte);
  const linhas = linhasDePrevalencia(q.data, base.data);
  const dados: LinhaBarra[] = linhas.map((l) => ({ ...l, altura: l.prevalencia ?? 0, marca: comparar ? l.prevalenciaBase : null }));
  const teto = tetoDaPrevalencia(linhasDePrevalencia(base.data), linhas);
  const eixo = propsDoEixo(tema);

  return (
    <ChartFrame
      titulo="Diabetes por faixa de IMC"
      descricao={
        comparar
          ? "% com diabetes e respostas em cada faixa de IMC no recorte; o traço marca a mesma faixa na base. Clique numa barra para filtrar."
          : "% com diabetes e respostas em cada faixa de IMC (OMS). Clique numa barra para filtrar o painel."
      }
      altura={260}
      tabela={
        <TabelaEquivalente
          legenda="Porcentagem com diabetes por faixa de IMC"
          colunas={[
            { chave: "rotulo", rotulo: "Faixa de IMC" },
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
        esqueleto={<EsqueletoBarras horizontal barras={6} />}
      >
        <ResponsiveContainer width="100%" height="100%" initialDimension={{ width: 640, height: 260 }}>
          <BarChart data={dados} layout="vertical" margin={{ top: 4, right: 116, bottom: 0, left: 0 }} barCategoryGap="24%">
            <XAxis type="number" domain={[0, teto]} ticks={ticksDaPrevalencia(teto)} tickFormatter={(v: number) => `${fmtInt(v)}%`} {...eixo} />
            <YAxis type="category" dataKey="rotulo" width={larguraDoRotulo(dados.map((d) => d.rotulo))} interval={0} {...eixo} axisLine={false} />
            <Tooltip content={<TooltipImc />} cursor={{ fill: tema.grade, fillOpacity: 0.5 }} />
            <Bar
              dataKey="altura"
              isAnimationActive={false}
              className="cursor-pointer"
              background={{ fill: "transparent" }}
              shape={fabricarBarra(teto, tema)}
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
