import { Bar, BarChart, Cell, LabelList, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

import { FILTRO_VAZIO } from "@/shared/filtros/filtroSchema";
import { useAgregado } from "@/shared/filtros/useAgregado";
import { useCrossFilter } from "@/shared/filtros/useCrossFilter";
import { useFiltros } from "@/shared/filtros/useFiltros";
import { fmtInt, fmtNum } from "@/shared/format/ptBR";
import { useChartTheme } from "@/shared/tema/useChartTheme";
import { ChartFrame } from "@/shared/ui/ChartFrame";
import { QueryState } from "@/shared/ui/QueryState";
import { TabelaEquivalente } from "@/shared/ui/TabelaEquivalente";

import { maximoDe, pivotar, tetoDoEixo } from "./agregadoUtil";
import { TooltipMedia, type LinhaMedia } from "./Tooltips";

const ALTURA = 340;

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

  return (
    <ChartFrame
      titulo="IMC Médio por Consumo de Álcool"
      descricao="Média do IMC por frequência de consumo, da maior para a menor. Clique numa barra para filtrar."
      altura={ALTURA}
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
      <QueryState carregando={q.isPending} erro={q.error} atualizando={q.isFetching && !q.isPending}>
        <ResponsiveContainer width="100%" height="100%" initialDimension={{ width: 400, height: ALTURA }}>
          <BarChart data={dados} layout="vertical" margin={{ top: 4, right: 48, bottom: 4, left: 4 }}>
            <XAxis type="number" domain={[0, teto]} tickFormatter={(v: number) => fmtInt(v)} stroke={tema.eixo} />
            <YAxis type="category" dataKey="rotulo" width={110} interval={0} stroke={tema.eixo} />
            <Tooltip content={<TooltipMedia />} cursor={{ fill: tema.grade }} />
            <Bar
              dataKey="valor"
              fill={tema.secundaria}
              radius={[0, 6, 6, 0]}
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
              <LabelList dataKey="rotuloValor" position="right" fill={tema.texto} fontSize={12} />
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </QueryState>
    </ChartFrame>
  );
}
