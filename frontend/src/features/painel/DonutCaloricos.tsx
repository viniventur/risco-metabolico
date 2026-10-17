import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";

import { useAgregado } from "@/shared/filtros/useAgregado";
import { useCrossFilter } from "@/shared/filtros/useCrossFilter";
import { useFiltros } from "@/shared/filtros/useFiltros";
import { fmtInt, fmtPontosPct } from "@/shared/format/ptBR";
import { useChartTheme } from "@/shared/tema/useChartTheme";
import { ChartFrame } from "@/shared/ui/ChartFrame";
import { LegendaHtml } from "@/shared/ui/LegendaHtml";
import { QueryState } from "@/shared/ui/QueryState";
import { TabelaEquivalente } from "@/shared/ui/TabelaEquivalente";

import { pivotar } from "./agregadoUtil";
import { TooltipContagem, type LinhaContagem } from "./Tooltips";

const ALTURA = 300;

/** Rosca de consumo de alimentos calóricos. ORIGEM de cross-filter para 4 visuais; legenda em HTML fora do SVG. */
export function DonutCaloricos() {
  const { filtros } = useFiltros();
  const cf = useCrossFilter("caloricos", "caloricos");
  const tema = useChartTheme();
  const q = useAgregado("caloricos", "contagem", { ...filtros, caloricos: [] });
  const dados: LinhaContagem[] = pivotar(q.data).map((l) => ({
    categoria: l.categoria,
    rotulo: l.categoria === "Sim" ? "Consome" : "Não consome",
    contagem: l.valores.contagem ?? 0,
    pct: l.valores.pct ?? null,
  }));
  const total = dados.reduce((s, d) => s + d.contagem, 0);
  // Regra de cor legítima herdada: Consumo_Calorico_Frequente = 'Sim' -> azul (7.3).
  const cor = (categoria: string) => (categoria === "Sim" ? tema.primaria : tema.textoFraco);

  return (
    <ChartFrame
      titulo="Consumo de Alimentos Calóricos"
      descricao="Registros que relatam consumo frequente de alimentos calóricos. Clique numa fatia para filtrar."
      altura={ALTURA}
      tabela={
        <TabelaEquivalente
          legenda="Consumo frequente de alimentos calóricos"
          colunas={[
            { chave: "rotulo", rotulo: "Resposta" },
            { chave: "contagem", rotulo: "Registros", alinhar: "right" },
            { chave: "pct", rotulo: "% do recorte", alinhar: "right" },
          ]}
          linhas={dados.map((d) => ({ rotulo: d.rotulo, contagem: fmtInt(d.contagem), pct: fmtPontosPct(d.pct) }))}
        />
      }
    >
      <QueryState carregando={q.isPending} erro={q.error} atualizando={q.isFetching && !q.isPending}>
        <div className="flex h-full flex-col gap-2">
          <div className="min-h-0 flex-1">
            <ResponsiveContainer width="100%" height="100%" initialDimension={{ width: 400, height: ALTURA - 40 }}>
              <PieChart margin={{ top: 4, right: 4, bottom: 4, left: 4 }}>
                <Pie
                  data={dados}
                  dataKey="contagem"
                  nameKey="rotulo"
                  innerRadius="60%"
                  outerRadius="85%"
                  startAngle={341}
                  endAngle={-19}
                  paddingAngle={2}
                  stroke="none"
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
                    <Cell key={d.categoria} fill={cor(d.categoria)} fillOpacity={cf.opacidade(d.categoria)} />
                  ))}
                </Pie>
                <text x="50%" y="48%" textAnchor="middle" dominantBaseline="middle" fill={tema.texto} fontSize={24} fontWeight={700}>
                  {fmtInt(total)}
                </text>
                <text x="50%" y="60%" textAnchor="middle" dominantBaseline="middle" fill={tema.textoFraco} fontSize={11}>
                  registros
                </text>
                <Tooltip content={<TooltipContagem />} />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <LegendaHtml
            titulo="Consumo frequente de alimentos calóricos"
            itens={dados.map((d) => ({
              rotulo: d.rotulo,
              cor: cor(d.categoria),
              valor: `${fmtInt(d.contagem)} · ${fmtPontosPct(d.pct)}`,
              ativo: cf.opacidade(d.categoria) === 1,
              forma: "circulo",
              aoClicar: () => cf.aoClicar(d.categoria),
            }))}
          />
        </div>
      </QueryState>
    </ChartFrame>
  );
}
