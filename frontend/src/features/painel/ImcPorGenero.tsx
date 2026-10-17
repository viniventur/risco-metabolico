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

const ALTURA = 300;

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
  const cor = (genero: string) => (genero === "Feminino" ? tema.rosa : tema.azulClaro);

  return (
    <ChartFrame
      titulo="IMC Médio por Gênero"
      descricao="Média do IMC no recorte; o eixo começa em zero."
      altura={ALTURA}
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
      <QueryState carregando={q.isPending} erro={q.error} atualizando={q.isFetching && !q.isPending}>
        <ResponsiveContainer width="100%" height="100%" initialDimension={{ width: 400, height: ALTURA }}>
          <BarChart data={dados} margin={{ top: 20, right: 8, bottom: 4, left: 0 }}>
            <XAxis dataKey="rotulo" interval={0} stroke={tema.eixo} />
            <YAxis domain={[0, teto]} tickFormatter={(v: number) => fmtInt(v)} stroke={tema.eixo} width={36} />
            <Tooltip content={<TooltipMedia />} cursor={{ fill: tema.grade }} />
            <Bar
              dataKey="valor"
              radius={[6, 6, 0, 0]}
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
              <LabelList dataKey="rotuloValor" position="top" fill={tema.texto} fontSize={12} />
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </QueryState>
    </ChartFrame>
  );
}
