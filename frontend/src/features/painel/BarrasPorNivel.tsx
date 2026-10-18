import { Bar, BarChart, Cell, LabelList, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

import { FILTRO_VAZIO } from "@/shared/filtros/filtroSchema";
import { useAgregado } from "@/shared/filtros/useAgregado";
import { useCrossFilter } from "@/shared/filtros/useCrossFilter";
import { useFiltros } from "@/shared/filtros/useFiltros";
import { fmtInt, fmtPontosPct } from "@/shared/format/ptBR";
import { ChartFrame } from "@/shared/graficos/ChartFrame";
import { FONTE_DO_EIXO, larguraDoRotulo, propsDoEixo } from "@/shared/graficos/eixos";
import { TabelaEquivalente } from "@/shared/graficos/TabelaEquivalente";
import { QueryState } from "@/shared/estados/QueryState";
import { useChartTheme } from "@/shared/tema/useChartTheme";

import { EsqueletoBarras } from "./Esqueletos";
import { maximoDe, pivotar, tetoDoEixo } from "./agregadoUtil";
import { TooltipContagem, type LinhaContagem } from "./Tooltips";

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
  const eixo = propsDoEixo(tema);

  return (
    <ChartFrame
      titulo="Divisão por Nível de Obesidade"
      descricao="Registros por classe, em ordem clínica. Clique numa barra para filtrar o painel."
      altura={300}
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
      <QueryState
        carregando={q.isPending}
        erro={q.error}
        atualizando={q.isFetching && !q.isPending}
        aoTentarNovamente={() => void q.refetch()}
        esqueleto={<EsqueletoBarras horizontal barras={7} />}
      >
        <ResponsiveContainer width="100%" height="100%" initialDimension={{ width: 600, height: 300 }}>
          <BarChart data={dados} layout="vertical" margin={{ top: 0, right: 44, bottom: 0, left: 0 }} barCategoryGap="22%">
            <XAxis type="number" domain={[0, teto]} tickFormatter={(v: number) => fmtInt(v)} {...eixo} />
            <YAxis type="category" dataKey="rotulo" width={larguraDoRotulo(dados.map((d) => d.rotulo))} interval={0} {...eixo} axisLine={false} />
            <Tooltip content={<TooltipContagem />} cursor={{ fill: tema.grade, fillOpacity: 0.5 }} />
            <Bar
              dataKey="contagem"
              fill={tema.primaria}
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
              <LabelList dataKey="contagem" position="right" formatter={(v: unknown) => fmtInt(Number(v))} fill={tema.texto} fontSize={FONTE_DO_EIXO} />
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </QueryState>
    </ChartFrame>
  );
}
