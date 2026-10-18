import { Bar, BarChart, Cell, LabelList, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

import { FILTRO_VAZIO } from "@/shared/filtros/filtroSchema";
import { useAgregado } from "@/shared/filtros/useAgregado";
import { useCrossFilter } from "@/shared/filtros/useCrossFilter";
import { useFiltros } from "@/shared/filtros/useFiltros";
import { fmtInt, fmtNum } from "@/shared/format/ptBR";
import { ChartFrame } from "@/shared/graficos/ChartFrame";
import { FONTE_DO_EIXO, larguraDoRotulo, propsDoEixo } from "@/shared/graficos/eixos";
import { TabelaEquivalente } from "@/shared/graficos/TabelaEquivalente";
import { QueryState } from "@/shared/estados/QueryState";
import { useChartTheme, type TemaGrafico } from "@/shared/tema/useChartTheme";

import { EsqueletoBarras } from "./Esqueletos";
import { maximoDe, pivotar, tetoDoEixo } from "./agregadoUtil";
import { TooltipMedia, type LinhaMedia } from "./Tooltips";

type PropsDoTick = { x?: number | string; y?: number | string; payload?: { value?: string } };

/**
 * Tick do eixo de categorias. Categoria suprimida (n < 15) não tem barra, e barra de largura 0 não
 * desenha rótulo: a nota "amostra < 15" sai do PRÓPRIO tick, no lugar onde a barra estaria, para a
 * categoria nunca sumir calada (redesenho, 1.5).
 */
function fabricarTick(dados: LinhaMedia[], tema: TemaGrafico) {
  return function TickDaCategoria({ x = 0, y = 0, payload }: PropsDoTick) {
    const d = dados.find((l) => l.rotulo === payload?.value);
    return (
      <g transform={`translate(${Number(x)},${Number(y)})`}>
        <text x={-6} y={0} dy="0.32em" textAnchor="end" fontSize={FONTE_DO_EIXO} fill={tema.eixo}>
          {payload?.value}
        </text>
        {d?.suprimido ? (
          <text x={8} y={0} dy="0.32em" textAnchor="start" fontSize={FONTE_DO_EIXO} fill={tema.textoFraco} fontStyle="italic">
            amostra &lt; 15 (n = {fmtInt(d.n)})
          </text>
        ) : null}
      </g>
    );
  };
}

/** Barras horizontais de IMC médio por consumo de álcool, ordenadas desc; n < 15 é suprimido e marcado. */
export function ImcPorAlcool() {
  const { filtros } = useFiltros();
  const cf = useCrossFilter("imc-alcool", "alcool");
  const tema = useChartTheme();
  const q = useAgregado("alcool", "imc_medio", { ...filtros, alcool: [] });
  const global = useAgregado("alcool", "imc_medio", FILTRO_VAZIO);
  const dados: LinhaMedia[] = pivotar(q.data)
    .map((l) => ({
      categoria: l.categoria,
      rotulo: l.categoria,
      valor: l.valores.imc_medio ?? 0,
      n: l.n,
      suprimido: l.suprimido,
      rotuloValor: l.suprimido ? "n < 15" : fmtNum(l.valores.imc_medio, 1),
    }))
    .sort((a, b) => b.valor - a.valor);
  const teto = tetoDoEixo(maximoDe(pivotar(global.data), "imc_medio"));
  const eixo = propsDoEixo(tema);

  return (
    <ChartFrame
      titulo="IMC Médio por Consumo de Álcool"
      descricao="Média do IMC por frequência de consumo, da maior para a menor. Clique numa barra para filtrar."
      altura={240}
      tabela={
        <TabelaEquivalente
          legenda="IMC médio por consumo de álcool"
          colunas={[
            { chave: "rotulo", rotulo: "Consumo de álcool" },
            { chave: "rotuloValor", rotulo: "IMC médio", alinhar: "right" },
            { chave: "n", rotulo: "n", alinhar: "right" },
          ]}
          linhas={dados.map((d) => ({ rotulo: d.rotulo, rotuloValor: d.rotuloValor, n: fmtInt(d.n) }))}
        />
      }
    >
      <QueryState
        carregando={q.isPending}
        erro={q.error}
        atualizando={q.isFetching && !q.isPending}
        aoTentarNovamente={() => void q.refetch()}
        esqueleto={<EsqueletoBarras horizontal barras={4} />}
      >
        <ResponsiveContainer width="100%" height="100%" initialDimension={{ width: 460, height: 240 }}>
          <BarChart data={dados} layout="vertical" margin={{ top: 0, right: 44, bottom: 0, left: 0 }} barCategoryGap="24%">
            <XAxis type="number" domain={[0, teto]} tickFormatter={(v: number) => fmtInt(v)} {...eixo} />
            <YAxis
              type="category"
              dataKey="rotulo"
              width={larguraDoRotulo(dados.map((d) => d.rotulo))}
              interval={0}
              {...eixo}
              axisLine={false}
              tick={fabricarTick(dados, tema)}
            />
            <Tooltip content={<TooltipMedia />} cursor={{ fill: tema.grade, fillOpacity: 0.5 }} />
            <Bar
              dataKey="valor"
              fill={tema.secundaria}
              radius={[0, 5, 5, 0]}
              isAnimationActive={false}
              className="cursor-pointer"
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
                <Cell key={d.categoria} fillOpacity={cf.opacidade(d.categoria)} />
              ))}
              <LabelList dataKey="rotuloValor" position="right" fill={tema.texto} fontSize={FONTE_DO_EIXO} fontWeight={600} />
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </QueryState>
    </ChartFrame>
  );
}
