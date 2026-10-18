import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";

import { useAgregado } from "@/shared/filtros/useAgregado";
import { useCrossFilter } from "@/shared/filtros/useCrossFilter";
import { useFiltros } from "@/shared/filtros/useFiltros";
import { fmtInt, fmtPontosPct } from "@/shared/format/ptBR";
import { ChartFrame } from "@/shared/graficos/ChartFrame";
import { LegendaHtml } from "@/shared/graficos/LegendaHtml";
import { TabelaEquivalente } from "@/shared/graficos/TabelaEquivalente";
import { QueryState } from "@/shared/estados/QueryState";
import { useChartTheme } from "@/shared/tema/useChartTheme";

import { EsqueletoRosca } from "./Esqueletos";
import { pivotar } from "./agregadoUtil";
import { TooltipContagem, type LinhaContagem } from "./Tooltips";

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
      descricao="Registros que relatam consumo frequente. Clique numa fatia para filtrar."
      altura={240}
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
      legenda={
        q.data ? (
          <LegendaHtml
            titulo="Consumo frequente de alimentos calóricos"
            itens={[...dados].reverse().map((d) => ({
              rotulo: d.rotulo,
              cor: cor(d.categoria),
              valor: `${fmtInt(d.contagem)} · ${fmtPontosPct(d.pct)}`,
              ativo: cf.opacidade(d.categoria) === 1,
              forma: "circulo",
              aoClicar: () => cf.aoClicar(d.categoria),
            }))}
          />
        ) : null
      }
    >
      <QueryState
        carregando={q.isPending}
        erro={q.error}
        atualizando={q.isFetching && !q.isPending}
        aoTentarNovamente={() => void q.refetch()}
        esqueleto={<EsqueletoRosca />}
      >
        <ResponsiveContainer width="100%" height="100%" initialDimension={{ width: 360, height: 240 }}>
          <PieChart margin={{ top: 0, right: 0, bottom: 0, left: 0 }}>
            <Pie
              data={dados}
              dataKey="contagem"
              nameKey="rotulo"
              innerRadius="62%"
              outerRadius="92%"
              startAngle={341}
              endAngle={-19}
              paddingAngle={2}
              cornerRadius={3}
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
            <text x="50%" y="47%" textAnchor="middle" dominantBaseline="middle" fill={tema.texto} fontSize={26} fontWeight={600}>
              {fmtInt(total)}
            </text>
            <text x="50%" y="60%" textAnchor="middle" dominantBaseline="middle" fill={tema.textoFraco} fontSize={12}>
              registros
            </text>
            <Tooltip content={<TooltipContagem />} />
          </PieChart>
        </ResponsiveContainer>
      </QueryState>
    </ChartFrame>
  );
}
