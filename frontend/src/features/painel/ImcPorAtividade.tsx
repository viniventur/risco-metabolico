import { Bar, BarChart, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

import { FILTRO_VAZIO } from "@/shared/filtros/filtroSchema";
import { useAgregado } from "@/shared/filtros/useAgregado";
import { useCrossFilter } from "@/shared/filtros/useCrossFilter";
import { useFiltros } from "@/shared/filtros/useFiltros";
import { fmtInt, fmtNum } from "@/shared/format/ptBR";
import { useChartTheme } from "@/shared/tema/useChartTheme";
import { ChartFrame } from "@/shared/ui/ChartFrame";
import { LegendaHtml } from "@/shared/ui/LegendaHtml";
import { QueryState } from "@/shared/ui/QueryState";
import { TabelaEquivalente } from "@/shared/ui/TabelaEquivalente";

import { categoriasDe, maximoDe, pivotar, tetoDoEixo } from "./agregadoUtil";
import { TooltipSeries, type LinhaSeries } from "./Tooltips";
import { useRotulos } from "./useRotulos";

const ALTURA = 340;
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
  const cor = (s: string) => (s === "Feminino" ? tema.rosa : tema.azulClaro);

  return (
    <ChartFrame
      titulo="IMC Médio por Frequência de Atividade Física"
      descricao="Média do IMC por gênero em cada faixa de atividade semanal. Clique numa coluna para filtrar o gênero."
      altura={ALTURA}
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
    >
      <QueryState carregando={q.isPending} erro={q.error} atualizando={q.isFetching && !q.isPending}>
        <div className="flex h-full flex-col gap-2">
          <div className="min-h-0 flex-1">
            <ResponsiveContainer width="100%" height="100%" initialDimension={{ width: 600, height: ALTURA - 40 }}>
              <BarChart data={dados} margin={{ top: 8, right: 8, bottom: 4, left: 0 }} barGap={2}>
                <XAxis dataKey="rotulo" interval={0} stroke={tema.eixo} />
                <YAxis
                  domain={[0, teto]}
                  tickFormatter={(v: number) => fmtInt(v)}
                  stroke={tema.eixo}
                  width={40}
                  label={{ value: "IMC médio", angle: -90, position: "insideLeft", fill: tema.textoFraco, fontSize: 11 }}
                />
                <Tooltip content={<TooltipSeries />} cursor={{ fill: tema.grade }} />
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
          </div>
          <LegendaHtml
            titulo="Gênero"
            itens={SERIES.map((s) => ({ rotulo: s, cor: cor(s), ativo: cf.opacidade(s) === 1, aoClicar: () => cf.aoClicar(s) }))}
          />
        </div>
      </QueryState>
    </ChartFrame>
  );
}
