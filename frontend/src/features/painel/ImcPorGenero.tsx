import { Bar, BarChart, Cell, LabelList, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

import { FILTRO_VAZIO } from "@/shared/filtros/filtroSchema";
import { useAgregado } from "@/shared/filtros/useAgregado";
import { useCrossFilter } from "@/shared/filtros/useCrossFilter";
import { useFiltros } from "@/shared/filtros/useFiltros";
import { fmtInt, fmtNum } from "@/shared/format/ptBR";
import { ChartFrame } from "@/shared/graficos/ChartFrame";
import { FONTE_DO_EIXO, propsDoEixo } from "@/shared/graficos/eixos";
import { TabelaEquivalente } from "@/shared/graficos/TabelaEquivalente";
import { QueryState } from "@/shared/estados/QueryState";
import { useChartTheme } from "@/shared/tema/useChartTheme";

import { EsqueletoBarras } from "./Esqueletos";
import { maximoDe, pivotar, tetoDoEixo } from "./agregadoUtil";
import { TooltipMedia, type LinhaMedia } from "./Tooltips";

/** Colunas de IMC médio por gênero (título explícito: no original o visual não tinha título). */
export function ImcPorGenero() {
  const { filtros } = useFiltros();
  const cf = useCrossFilter("imc-genero", "genero");
  const tema = useChartTheme();
  const q = useAgregado("genero", "imc_medio", { ...filtros, genero: [] });
  const global = useAgregado("genero", "imc_medio", FILTRO_VAZIO);
  const dados: LinhaMedia[] = pivotar(q.data).map((l) => ({
    categoria: l.categoria,
    rotulo: l.categoria,
    valor: l.valores.imc_medio ?? 0,
    n: l.n,
    suprimido: l.suprimido,
    rotuloValor: l.suprimido ? "n < 15" : fmtNum(l.valores.imc_medio, 1),
  }));
  const teto = tetoDoEixo(maximoDe(pivotar(global.data), "imc_medio"));
  const cor = (genero: string) => (genero === "Feminino" ? tema.feminino : tema.masculino);
  const eixo = propsDoEixo(tema);

  return (
    <ChartFrame
      titulo="IMC Médio por Gênero"
      descricao="Média do IMC no recorte; o eixo começa em zero."
      altura={240}
      tabela={
        <TabelaEquivalente
          legenda="IMC médio por gênero"
          colunas={[
            { chave: "rotulo", rotulo: "Gênero" },
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
        esqueleto={<EsqueletoBarras barras={2} />}
      >
        <ResponsiveContainer width="100%" height="100%" initialDimension={{ width: 280, height: 240 }}>
          <BarChart data={dados} margin={{ top: 20, right: 4, bottom: 0, left: -8 }} barCategoryGap="28%">
            <XAxis dataKey="rotulo" interval={0} {...eixo} />
            <YAxis domain={[0, teto]} tickFormatter={(v: number) => fmtInt(v)} width={36} {...eixo} axisLine={false} />
            <Tooltip content={<TooltipMedia />} cursor={{ fill: tema.grade, fillOpacity: 0.5 }} />
            <Bar
              dataKey="valor"
              radius={[5, 5, 0, 0]}
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
              <LabelList dataKey="rotuloValor" position="top" fill={tema.texto} fontSize={FONTE_DO_EIXO} fontWeight={600} />
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </QueryState>
    </ChartFrame>
  );
}
