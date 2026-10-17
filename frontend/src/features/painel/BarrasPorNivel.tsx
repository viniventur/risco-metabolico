import { Bar, BarChart, Cell, LabelList, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

import { FILTRO_VAZIO } from "@/shared/filtros/filtroSchema";
import { useAgregado } from "@/shared/filtros/useAgregado";
import { useCrossFilter } from "@/shared/filtros/useCrossFilter";
import { useFiltros } from "@/shared/filtros/useFiltros";
import { fmtInt, fmtPontosPct } from "@/shared/format/ptBR";
import { useChartTheme } from "@/shared/tema/useChartTheme";
import { ChartFrame } from "@/shared/ui/ChartFrame";
import { QueryState } from "@/shared/ui/QueryState";
import { TabelaEquivalente } from "@/shared/ui/TabelaEquivalente";

import { maximoDe, pivotar, tetoDoEixo } from "./agregadoUtil";
import { TooltipContagem, type LinhaContagem } from "./Tooltips";

const ALTURA = 300;

/** Barras horizontais por nível, em ordem clínica. ORIGEM de cross-filter: só destaca, não se filtra. */
export function BarrasPorNivel() {
  const { filtros } = useFiltros();
  const cf = useCrossFilter("por-nivel", "nivel");
  const tema = useChartTheme();
  // O gráfico de origem não se filtra pelo próprio eixo: envia os filtros SEM `nivel` (7.3).
  const q = useAgregado("nivel", "contagem", { ...filtros, nivel: [] });
  // Domínio do eixo de valor derivado do dataset sem cross-filter: o eixo não pula ao filtrar.
  const global = useAgregado("nivel", "contagem", FILTRO_VAZIO);
  const dados: LinhaContagem[] = pivotar(q.data).map((l) => ({
    categoria: l.categoria,
    rotulo: l.categoria,
    contagem: l.valores.contagem ?? 0,
    pct: l.valores.pct ?? null,
  }));
  const teto = tetoDoEixo(maximoDe(pivotar(global.data), "contagem"));

  return (
    <ChartFrame
      titulo="Divisão por Nível de Obesidade"
      descricao="Registros por classe, em ordem clínica. Clique numa barra para filtrar o painel."
      altura={ALTURA}
      tabela={
        <TabelaEquivalente
          legenda="Registros por nível de obesidade"
          colunas={[
            { chave: "rotulo", rotulo: "Nível" },
            { chave: "contagem", rotulo: "Registros", alinhar: "right" },
            { chave: "pct", rotulo: "% do recorte", alinhar: "right" },
          ]}
          linhas={dados.map((d) => ({ rotulo: d.rotulo, contagem: fmtInt(d.contagem), pct: fmtPontosPct(d.pct) }))}
        />
      }
    >
      <QueryState carregando={q.isPending} erro={q.error} atualizando={q.isFetching && !q.isPending}>
        <ResponsiveContainer width="100%" height="100%" initialDimension={{ width: 600, height: ALTURA }}>
          <BarChart data={dados} layout="vertical" margin={{ top: 4, right: 48, bottom: 4, left: 4 }}>
            <XAxis type="number" domain={[0, teto]} tickFormatter={(v: number) => fmtInt(v)} stroke={tema.eixo} />
            <YAxis type="category" dataKey="rotulo" width={112} interval={0} stroke={tema.eixo} />
            <Tooltip content={<TooltipContagem />} cursor={{ fill: tema.grade }} />
            <Bar
              dataKey="contagem"
              fill={tema.primaria}
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
              <LabelList dataKey="contagem" position="right" formatter={(v: unknown) => fmtInt(Number(v))} fill={tema.texto} fontSize={12} />
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </QueryState>
    </ChartFrame>
  );
}
