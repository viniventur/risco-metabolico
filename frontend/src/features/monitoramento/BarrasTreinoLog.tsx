import { MousePointerClick } from "lucide-react";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

import type { RespostaDeriva } from "@/shared/api/endpoints/tipos";
import { EstadoVazio } from "@/shared/estados/EstadoVazio";
import { fmtInt, fmtNum, fmtPontosPct } from "@/shared/format/ptBR";
import { ChartFrame } from "@/shared/graficos/ChartFrame";
import { propsDoEixo } from "@/shared/graficos/eixos";
import { LegendaHtml } from "@/shared/graficos/LegendaHtml";
import { TabelaEquivalente } from "@/shared/graficos/TabelaEquivalente";
import { TooltipGrafico } from "@/shared/graficos/TooltipGrafico";
import { useChartTheme } from "@/shared/tema/useChartTheme";
import { Card } from "@/shared/ui/card";

type Linha = { faixa: string; treino: number; log: number; n_treino: number; n_log: number };

function TooltipFaixa({ active, payload }: { active?: boolean; payload?: Array<{ payload: Linha; color?: string; dataKey?: string | number }> }) {
  if (!active || !payload?.[0]) return null;
  const l = payload[0].payload;
  const cor = (chave: string) => payload.find((p) => p.dataKey === chave)?.color;
  return (
    <TooltipGrafico
      titulo={l.faixa}
      linhas={[
        { rotulo: "Treino", valor: `${fmtPontosPct(l.treino)} · n = ${fmtInt(l.n_treino)}`, cor: cor("treino") },
        { rotulo: "Log", valor: `${fmtPontosPct(l.log)} · n = ${fmtInt(l.n_log)}`, cor: cor("log") },
      ]}
    />
  );
}

function rotuloFaixa(f: NonNullable<RespostaDeriva["faixas"]>[number]): string {
  if (f.faixa_rotulo) return f.faixa_rotulo;
  // A faixa NULL das categóricas (ADR 0008) não tem limite nenhum: é o valor ausente, não "−∞ – +∞".
  if ((f.limite_inf === null || f.limite_inf === undefined) && (f.limite_sup === null || f.limite_sup === undefined)) return "ausente";
  const a = f.limite_inf === null || f.limite_inf === undefined ? "−∞" : fmtNum(f.limite_inf, 1);
  const b = f.limite_sup === null || f.limite_sup === undefined ? "+∞" : fmtNum(f.limite_sup, 1);
  return `${a} – ${b}`;
}

/**
 * Barras agrupadas da feature selecionada: proporção no treino e no log, faixa a faixa (§7.6). Sem
 * feature escolhida, um estado vazio compacto — antes um painel de 512×851 px com uma frase
 * (redesenho, 1.17).
 */
export function BarrasTreinoLog({ dado, feature, rotulo }: { dado: RespostaDeriva; feature: string; rotulo?: string }) {
  const tema = useChartTheme();
  const faixas = (dado.faixas ?? []).filter((f) => f.feature === feature).sort((a, b) => a.faixa_idx - b.faixa_idx);
  const dados: Linha[] = faixas.map((f) => ({
    faixa: rotuloFaixa(f),
    treino: f.proporcao_treino * 100,
    log: (f.prop_log ?? 0) * 100,
    n_treino: f.n_treino,
    n_log: f.n_log,
  }));
  if (!feature) {
    return (
      <Card className="p-5">
        <EstadoVazio
          icone={<MousePointerClick className="size-5" />}
          titulo="Escolha uma feature"
          descricao="Clique numa linha da tabela para comparar a distribuição do treino com a do log, faixa a faixa."
          className="py-10"
        />
      </Card>
    );
  }
  const eixo = propsDoEixo(tema);
  const inclinar = dados.some((d) => d.faixa.length > 6);
  return (
    <ChartFrame
      titulo={`Treino × log: ${rotulo ?? feature}`}
      descricao="Proporção de registros em cada faixa, no snapshot de treino e nas predições da janela."
      altura={300}
      tabela={
        <TabelaEquivalente
          legenda={`Distribuição por faixa de ${rotulo ?? feature}`}
          colunas={[
            { chave: "faixa", rotulo: "Faixa" },
            { chave: "treino", rotulo: "Treino", alinhar: "right" },
            { chave: "log", rotulo: "Log", alinhar: "right" },
          ]}
          linhas={dados.map((d) => ({
            faixa: d.faixa,
            treino: `${fmtPontosPct(d.treino)} (n = ${fmtInt(d.n_treino)})`,
            log: `${fmtPontosPct(d.log)} (n = ${fmtInt(d.n_log)})`,
          }))}
        />
      }
      legenda={
        <LegendaHtml
          titulo="Origem"
          itens={[
            { rotulo: "Treino (snapshot)", cor: tema.secundaria },
            { rotulo: "Log (janela)", cor: tema.primaria },
          ]}
        />
      }
    >
      <ResponsiveContainer width="100%" height="100%" initialDimension={{ width: 460, height: 300 }}>
        <BarChart data={dados} margin={{ top: 8, right: 8, bottom: 0, left: 0 }} barGap={2} barCategoryGap="20%">
          <CartesianGrid vertical={false} stroke={tema.grade} strokeDasharray="2 4" strokeOpacity={0.7} />
          {/* Faixas numéricas têm rótulos longos ("55,2 – 66,6"): inclinados, para não se sobreporem. */}
          {inclinar ? (
            <XAxis dataKey="faixa" interval={0} {...eixo} tick={{ ...eixo.tick, fontSize: 11 }} angle={-35} textAnchor="end" height={64} />
          ) : (
            <XAxis dataKey="faixa" interval={0} {...eixo} />
          )}
          <YAxis tickFormatter={(v: number) => `${fmtInt(v)}%`} width={44} {...eixo} axisLine={false} />
          <Tooltip content={<TooltipFaixa />} cursor={{ fill: tema.grade, fillOpacity: 0.5 }} />
          <Bar dataKey="treino" name="Treino" fill={tema.secundaria} radius={[4, 4, 0, 0]} isAnimationActive={false} />
          <Bar dataKey="log" name="Log" fill={tema.primaria} radius={[4, 4, 0, 0]} isAnimationActive={false} />
        </BarChart>
      </ResponsiveContainer>
    </ChartFrame>
  );
}
