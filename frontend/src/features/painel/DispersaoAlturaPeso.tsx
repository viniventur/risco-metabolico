import { useMemo } from "react";
import { CartesianGrid, ReferenceDot, ResponsiveContainer, Scatter, ScatterChart, Tooltip, XAxis, YAxis, ZAxis } from "recharts";

import { useMetadata } from "@/shared/api/endpoints/metadata";
import { usePontos } from "@/shared/api/endpoints/painel";
import { LIMITES_IMC, ORDEM_CLINICA } from "@/shared/dominio";
import { QueryState } from "@/shared/estados/QueryState";
import { useFiltros } from "@/shared/filtros/useFiltros";
import { fmtImc, fmtInt, fmtNum } from "@/shared/format/ptBR";
import { ChartFrame } from "@/shared/graficos/ChartFrame";
import { dominioRedondo, FONTE_DO_EIXO, propsDoEixo, ticksEntre } from "@/shared/graficos/eixos";
import { LegendaHtml } from "@/shared/graficos/LegendaHtml";
import { TabelaEquivalente } from "@/shared/graficos/TabelaEquivalente";
import { MACRO_FAIXA, useChartTheme } from "@/shared/tema/useChartTheme";
import { Skeleton } from "@/shared/ui/skeleton";

import { TooltipPonto, type PontoPlot } from "./Tooltips";

const AMOSTRA = 2000;
const PASSO_PESO = 30;
const PASSO_ALTURA = 0.1;
/** Pontos por curva de IMC: o bastante para a parábola parecer lisa na largura do cartão. */
const PONTOS_DA_CURVA = 24;

const MACROS = [
  { chave: "abaixo", rotulo: "Abaixo do peso", nivel: "Abaixo do Peso" },
  { chave: "normal", rotulo: "Peso normal", nivel: "Peso Normal" },
  { chave: "sobrepeso", rotulo: "Sobrepeso (I e II)", nivel: "Sobrepeso I" },
  { chave: "obesidade", rotulo: "Obesidade (I a III)", nivel: "Obesidade I" },
] as const;

/** Nada é desenhado nos vértices da curva de IMC: ela é só a linha (`line` do <Scatter>). */
const semMarca = () => <g />;

/**
 * Nuvem altura × peso, uma série por nível (7 séries), recebendo o cross-filter do donut e da barra
 * de nível pelo servidor. Redesenho (1.3, 1.4): pontos pequenos e semitransparentes na rampa
 * ordinal das macro-faixas, eixos em passos redondos com a unidade no título, e as LINHAS DE IMC
 * (18,5 · 25 · 30 · 35 · 40) como segundo canal no lugar das formas de marca — elas mostram por
 * que as classes aparecem em faixas diagonais: o nível é, quase todo, o IMC = peso / altura².
 */
export function DispersaoAlturaPeso() {
  const { filtros } = useFiltros();
  const tema = useChartTheme();
  const q = usePontos(AMOSTRA, filtros);
  const metadata = useMetadata();

  // Domínio dos eixos derivado do dataset SEM cross-filter (a faixa observada no treino, /metadata),
  // arredondado para passos que se leem de cabeça.
  const eixos = useMemo(() => {
    const campos = metadata.data?.grupos.flatMap((g) => g.campos) ?? [];
    const altura = campos.find((c) => c.nome === "Altura");
    const peso = campos.find((c) => c.nome === "Peso");
    const [a0, a1] = dominioRedondo(altura?.minimo ?? 1.45, altura?.maximo ?? 1.98, PASSO_ALTURA);
    const [p0, p1] = dominioRedondo(peso?.minimo ?? 39, peso?.maximo ?? 173, PASSO_PESO);
    return {
      altura: [a0, a1] as [number, number],
      peso: [p0, p1] as [number, number],
      ticksAltura: ticksEntre(a0, a1, PASSO_ALTURA),
      ticksPeso: ticksEntre(p0, p1, PASSO_PESO),
    };
  }, [metadata.data]);

  // As curvas peso = IMC × altura², recortadas ao domínio do peso.
  const curvas = useMemo(
    () =>
      LIMITES_IMC.map((imc) => {
        const [a0, a1] = eixos.altura;
        const pontos: { altura: number; peso: number }[] = [];
        for (let i = 0; i <= PONTOS_DA_CURVA; i++) {
          const altura = a0 + ((a1 - a0) * i) / PONTOS_DA_CURVA;
          const peso = imc * altura * altura;
          if (peso >= eixos.peso[0] && peso <= eixos.peso[1]) pontos.push({ altura, peso });
        }
        return { imc, pontos, fim: pontos[pontos.length - 1] };
      }),
    [eixos],
  );

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
  const eixo = propsDoEixo(tema);
  const rotuloDoEixo = { fill: tema.textoFraco, fontSize: FONTE_DO_EIXO };

  return (
    <ChartFrame
      titulo="Análise Cruzada - Altura, Peso e o Nível de Obesidade"
      descricao={`Até ${fmtInt(AMOSTRA)} registros do recorte (amostra determinística). As linhas tracejadas são os limites de IMC.`}
      altura={340}
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
      legenda={
        <LegendaHtml
          titulo="Faixas na dispersão"
          itens={[
            ...MACROS.map((m) => ({ rotulo: m.rotulo, cor: tema.corDaMacroFaixa[m.nivel] ?? "", forma: "circulo" as const })),
            { rotulo: "Limite de IMC", cor: tema.textoFraco, forma: "quadrado" as const },
          ]}
        />
      }
    >
      <QueryState
        carregando={q.isPending}
        erro={q.error}
        atualizando={q.isFetching && !q.isPending}
        vazio={q.data?.length === 0}
        aoTentarNovamente={() => void q.refetch()}
        esqueleto={<Skeleton className="h-full w-full" />}
      >
        <ResponsiveContainer width="100%" height="100%" initialDimension={{ width: 640, height: 340 }}>
          <ScatterChart margin={{ top: 8, right: 52, bottom: 18, left: 4 }}>
            <CartesianGrid stroke={tema.grade} strokeDasharray="2 4" strokeOpacity={0.7} />
            <XAxis
              type="number"
              dataKey="altura"
              name="Altura"
              domain={eixos.altura}
              ticks={eixos.ticksAltura}
              allowDataOverflow
              tickFormatter={(v: number) => fmtNum(v, 2)}
              label={{ value: "Altura (m)", position: "insideBottom", offset: -12, ...rotuloDoEixo }}
              {...eixo}
            />
            <YAxis
              type="number"
              dataKey="peso"
              name="Peso"
              domain={eixos.peso}
              ticks={eixos.ticksPeso}
              allowDataOverflow
              tickFormatter={(v: number) => fmtInt(v)}
              width={52}
              label={{ value: "Peso (kg)", angle: -90, position: "insideLeft", offset: 12, ...rotuloDoEixo }}
              {...eixo}
            />
            <ZAxis range={[16, 16]} />
            <Tooltip content={<TooltipPonto />} cursor={{ stroke: tema.grade, strokeDasharray: "3 3" }} />
            {curvas.map((c) => (
              <Scatter
                key={`imc-${c.imc}`}
                data={c.pontos}
                line={{ stroke: tema.textoFraco, strokeWidth: 1, strokeDasharray: "4 4", strokeOpacity: 0.8 }}
                shape={semMarca}
                isAnimationActive={false}
                legendType="none"
                tooltipType="none"
              />
            ))}
            {ORDEM_CLINICA.map((n) => (
              <Scatter
                key={n}
                name={n}
                data={grupos[n] ?? []}
                fill={tema.corDaMacroFaixa[n]}
                fillOpacity={MACRO_FAIXA[n] === "obesidade" ? 0.5 : 0.62}
                isAnimationActive={false}
              />
            ))}
            {curvas.map((c) =>
              c.fim ? (
                <ReferenceDot
                  key={`rotulo-${c.imc}`}
                  x={c.fim.altura}
                  y={c.fim.peso}
                  r={0}
                  ifOverflow="visible"
                  label={{ value: fmtNum(c.imc, c.imc % 1 ? 1 : 0), position: "right", fill: tema.textoFraco, fontSize: 11 }}
                />
              ) : null,
            )}
          </ScatterChart>
        </ResponsiveContainer>
      </QueryState>
    </ChartFrame>
  );
}
