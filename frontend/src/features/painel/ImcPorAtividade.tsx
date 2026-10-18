import { Bar, BarChart, CartesianGrid, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

import { FILTRO_VAZIO } from "@/shared/filtros/filtroSchema";
import { useAgregado } from "@/shared/filtros/useAgregado";
import { useCrossFilter } from "@/shared/filtros/useCrossFilter";
import { useFiltros } from "@/shared/filtros/useFiltros";
import { useRotulos } from "@/shared/filtros/useRotulos";
import { fmtInt, fmtNum } from "@/shared/format/ptBR";
import { ChartFrame } from "@/shared/graficos/ChartFrame";
import { FONTE_DO_EIXO, propsDoEixo } from "@/shared/graficos/eixos";
import { LegendaHtml } from "@/shared/graficos/LegendaHtml";
import { TabelaEquivalente } from "@/shared/graficos/TabelaEquivalente";
import { QueryState } from "@/shared/estados/QueryState";
import { useChartTheme } from "@/shared/tema/useChartTheme";

import { EsqueletoBarras } from "./Esqueletos";
import { categoriasDe, maximoDe, pivotar, tetoDoEixo } from "./agregadoUtil";
import { TooltipSeries, type LinhaSeries } from "./Tooltips";

const SERIES = ["Feminino", "Masculino"] as const;

/** Colunas agrupadas (Feminino, Masculino) de IMC MÉDIO por frequência de atividade física. */
export function ImcPorAtividade() {
  const { filtros } = useFiltros();
  const cf = useCrossFilter("imc-atividade", "genero");
  const tema = useChartTheme();
  const rotulo = useRotulos();
  // A série é o gênero: para o cross-filter ser mútuo sem o gráfico sumir com uma série, envia sem `genero`.
  const q = useAgregado("atividade", "imc_medio", { ...filtros, genero: [] }, "genero");
  const global = useAgregado("atividade", "imc_medio", FILTRO_VAZIO, "genero");
  const linhas = pivotar(q.data);
  // Domínio completo com zeros: sem isso o Recharts reordena os grupos quando um gênero some do recorte.
  const dados: LinhaSeries[] = categoriasDe(linhas).map((categoria) => {
    const linha: LinhaSeries = { categoria, rotulo: rotulo("atividade", categoria) };
    for (const s of SERIES) {
      const celula = linhas.find((l) => l.categoria === categoria && l.serie === s);
      linha[s] = celula?.valores.imc_medio ?? 0;
      linha[`n_${s}`] = celula?.n ?? 0;
      linha[`suprimido_${s}`] = celula?.suprimido ?? false;
    }
    return linha;
  });
  const teto = tetoDoEixo(maximoDe(pivotar(global.data), "imc_medio"));
  const cor = (s: string) => (s === "Feminino" ? tema.feminino : tema.masculino);
  const eixo = propsDoEixo(tema);

  return (
    <ChartFrame
      titulo="IMC Médio por Frequência de Atividade Física"
      descricao="Média do IMC por gênero em cada faixa de atividade semanal. Clique numa coluna para filtrar o gênero."
      altura={300}
      tabela={
        <TabelaEquivalente
          legenda="IMC médio por frequência de atividade física e gênero"
          colunas={[
            { chave: "rotulo", rotulo: "Atividade" },
            { chave: "Feminino", rotulo: "Feminino", alinhar: "right" },
            { chave: "Masculino", rotulo: "Masculino", alinhar: "right" },
          ]}
          linhas={dados.map((d) => ({
            rotulo: d.rotulo,
            Feminino: d.suprimido_Feminino ? `n < 15 (n = ${fmtInt(d.n_Feminino as number)})` : fmtNum(d.Feminino as number, 1),
            Masculino: d.suprimido_Masculino ? `n < 15 (n = ${fmtInt(d.n_Masculino as number)})` : fmtNum(d.Masculino as number, 1),
          }))}
        />
      }
      legenda={
        <LegendaHtml
          titulo="Gênero"
          itens={SERIES.map((s) => ({ rotulo: s, cor: cor(s), ativo: cf.opacidade(s) === 1, aoClicar: () => cf.aoClicar(s) }))}
        />
      }
    >
      <QueryState
        carregando={q.isPending}
        erro={q.error}
        atualizando={q.isFetching && !q.isPending}
        aoTentarNovamente={() => void q.refetch()}
        esqueleto={<EsqueletoBarras barras={8} />}
      >
        <ResponsiveContainer width="100%" height="100%" initialDimension={{ width: 460, height: 300 }}>
          <BarChart data={dados} margin={{ top: 8, right: 4, bottom: 18, left: 0 }} barGap={3} barCategoryGap="22%">
            <CartesianGrid vertical={false} stroke={tema.grade} strokeDasharray="2 4" strokeOpacity={0.7} />
            <XAxis
              dataKey="rotulo"
              interval={0}
              {...eixo}
              label={{ value: "Atividade física semanal", position: "insideBottom", offset: -12, fill: tema.textoFraco, fontSize: FONTE_DO_EIXO }}
            />
            <YAxis
              domain={[0, teto]}
              tickFormatter={(v: number) => fmtInt(v)}
              width={48}
              {...eixo}
              axisLine={false}
              label={{ value: "IMC médio", angle: -90, position: "insideLeft", offset: 14, fill: tema.textoFraco, fontSize: FONTE_DO_EIXO }}
            />
            <Tooltip content={<TooltipSeries />} cursor={{ fill: tema.grade, fillOpacity: 0.5 }} />
            {SERIES.map((s) => (
              <Bar
                key={s}
                dataKey={s}
                fill={cor(s)}
                radius={[4, 4, 0, 0]}
                isAnimationActive={false}
                className="cursor-pointer"
                onClick={() => cf.aoClicar(s)}
                onMouseEnter={() => cf.aoEntrar(s)}
                onMouseLeave={cf.aoSair}
              >
                {dados.map((d) => (
                  <Cell key={`${s}-${d.categoria}`} fillOpacity={cf.opacidade(s)} />
                ))}
              </Bar>
            ))}
          </BarChart>
        </ResponsiveContainer>
      </QueryState>
    </ChartFrame>
  );
}
