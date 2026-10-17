import { useMemo } from "react";
import { ResponsiveContainer, Scatter, ScatterChart, Tooltip, XAxis, YAxis, ZAxis } from "recharts";

import { useMetadata } from "@/shared/api/endpoints/metadata";
import { usePontos } from "@/shared/api/endpoints/painel";
import { FORMA_DO_NIVEL, FORMA_LEGENDA, ORDEM_CLINICA, type Nivel } from "@/shared/dominio";
import { useCrossFilter } from "@/shared/filtros/useCrossFilter";
import { useFiltros } from "@/shared/filtros/useFiltros";
import { fmtImc, fmtInt, fmtNum } from "@/shared/format/ptBR";
import { useChartTheme } from "@/shared/tema/useChartTheme";
import { ChartFrame } from "@/shared/ui/ChartFrame";
import { LegendaHtml } from "@/shared/ui/LegendaHtml";
import { QueryState } from "@/shared/ui/QueryState";
import { TabelaEquivalente } from "@/shared/ui/TabelaEquivalente";

import { TooltipPonto, type PontoPlot } from "./Tooltips";

const ALTURA = 340;
const AMOSTRA = 2000;

/**
 * Nuvem altura × peso, uma série por nível (7 séries). Cor por MACRO-FAIXA (4 tons) e forma da
 * marca como segundo canal. Recebe o cross-filter do donut e da barra de nível pelo servidor.
 */
export function DispersaoAlturaPeso() {
  const { filtros } = useFiltros();
  const cf = useCrossFilter("dispersao", "nivel");
  const tema = useChartTheme();
  const q = usePontos(AMOSTRA, filtros);
  const metadata = useMetadata();

  // Domínio dos eixos derivado do dataset SEM cross-filter: a faixa observada no treino (/metadata).
  const dominio = useMemo(() => {
    const campos = metadata.data?.grupos.flatMap((g) => g.campos) ?? [];
    const altura = campos.find((c) => c.nome === "Altura");
    const peso = campos.find((c) => c.nome === "Peso");
    return {
      altura: [altura?.minimo ?? 1.4, altura?.maximo ?? 2.0] as [number, number],
      peso: [peso?.minimo ?? 35, peso?.maximo ?? 180] as [number, number],
    };
  }, [metadata.data]);

  const grupos = useMemo(() => {
    const porNivel: Record<string, PontoPlot[]> = {};
    for (const n of ORDEM_CLINICA) porNivel[n] = [];
    for (const p of q.data ?? []) (porNivel[p.nivel] ??= []).push(p);
    return porNivel;
  }, [q.data]);

  const resumoPorNivel = ORDEM_CLINICA.map((n) => {
    const pontos = grupos[n] ?? [];
    const imc = pontos.length ? pontos.reduce((s, p) => s + p.imc, 0) / pontos.length : null;
    return { nivel: n, n: pontos.length, imc };
  });

  return (
    <ChartFrame
      titulo="Análise Cruzada - Altura, Peso e o Nível de Obesidade"
      descricao={`Até ${fmtInt(AMOSTRA)} registros do recorte, amostra determinística. Cor por faixa; forma distingue as classes.`}
      altura={ALTURA}
      tabela={
        <TabelaEquivalente
          legenda="Pontos da dispersão resumidos por nível"
          colunas={[
            { chave: "nivel", rotulo: "Nível" },
            { chave: "n", rotulo: "Pontos", alinhar: "right" },
            { chave: "imc", rotulo: "IMC médio", alinhar: "right" },
          ]}
          linhas={resumoPorNivel.map((r) => ({ nivel: r.nivel, n: fmtInt(r.n), imc: r.imc === null ? "—" : fmtImc(r.imc) }))}
        />
      }
    >
      <QueryState carregando={q.isPending} erro={q.error} atualizando={q.isFetching && !q.isPending}>
        <div className="flex h-full flex-col gap-2">
          <div className="min-h-0 flex-1">
            <ResponsiveContainer width="100%" height="100%" initialDimension={{ width: 600, height: ALTURA - 40 }}>
              <ScatterChart margin={{ top: 8, right: 16, bottom: 4, left: 0 }}>
                <XAxis
                  type="number"
                  dataKey="altura"
                  name="Altura"
                  unit=" m"
                  domain={dominio.altura}
                  tickFormatter={(v: number) => fmtNum(v, 2)}
                  stroke={tema.eixo}
                />
                <YAxis
                  type="number"
                  dataKey="peso"
                  name="Peso"
                  unit=" kg"
                  domain={dominio.peso}
                  tickFormatter={(v: number) => fmtInt(v)}
                  stroke={tema.eixo}
                  width={44}
                />
                <ZAxis range={[24, 24]} />
                <Tooltip content={<TooltipPonto />} cursor={{ strokeDasharray: "3 3" }} />
                {ORDEM_CLINICA.map((n) => (
                  <Scatter
                    key={n}
                    name={n}
                    data={grupos[n] ?? []}
                    fill={tema.corDaMacroFaixa[n]}
                    fillOpacity={cf.opacidade(n)}
                    shape={FORMA_DO_NIVEL[n as Nivel]}
                    isAnimationActive={false}
                  />
                ))}
              </ScatterChart>
            </ResponsiveContainer>
          </div>
          <LegendaHtml
            titulo="Níveis na dispersão"
            itens={ORDEM_CLINICA.map((n) => ({
              rotulo: n,
              cor: tema.corDaMacroFaixa[n] ?? "",
              forma: FORMA_LEGENDA[FORMA_DO_NIVEL[n as Nivel]],
              ativo: cf.opacidade(n) === 1,
              aoClicar: () => cf.aoClicar(n),
            }))}
          />
        </div>
      </QueryState>
    </ChartFrame>
  );
}
