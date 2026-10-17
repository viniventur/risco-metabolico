import { Bar, BarChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

import type { RespostaDeriva } from "@/shared/api/endpoints/tipos";
import { fmtInt, fmtNum, fmtPontosPct } from "@/shared/format/ptBR";
import { useChartTheme } from "@/shared/tema/useChartTheme";
import { ChartFrame } from "@/shared/ui/ChartFrame";
import { LegendaHtml } from "@/shared/ui/LegendaHtml";
import { TabelaEquivalente } from "@/shared/ui/TabelaEquivalente";

const ALTURA = 320;

type Linha = { faixa: string; treino: number; log: number; n_treino: number; n_log: number };

function TooltipFaixa({ active, payload }: { active?: boolean; payload?: Array<{ payload: Linha }> }) {
  if (!active || !payload?.[0]) return null;
  const l = payload[0].payload;
  return (
    <div className="cartao px-3 py-2 text-xs">
      <strong>{l.faixa}</strong>
      <div>
        treino {fmtPontosPct(l.treino)} (n = {fmtInt(l.n_treino)}) · log {fmtPontosPct(l.log)} (n = {fmtInt(l.n_log)})
      </div>
    </div>
  );
}

function rotuloFaixa(f: NonNullable<RespostaDeriva["faixas"]>[number]): string {
  if (f.faixa_rotulo) return f.faixa_rotulo;
  const a = f.limite_inf === null || f.limite_inf === undefined ? "−∞" : fmtNum(f.limite_inf, 1);
  const b = f.limite_sup === null || f.limite_sup === undefined ? "+∞" : fmtNum(f.limite_sup, 1);
  return `${a} – ${b}`;
}

/** Barras agrupadas da feature selecionada: proporção no treino e no log, faixa a faixa (§7.6). */
export function BarrasTreinoLog({ dado, feature }: { dado: RespostaDeriva; feature: string }) {
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
      <section className="cartao flex min-h-40 items-center justify-center p-4 text-sm text-texto-fraco">
        Selecione uma feature na tabela para comparar a distribuição do treino com a do log, faixa a faixa.
      </section>
    );
  }
  return (
    <ChartFrame
      titulo={`Treino × log: ${feature}`}
      descricao="Proporção de registros em cada faixa, no snapshot de treino e nas predições da janela."
      altura={ALTURA}
      tabela={
        <TabelaEquivalente
          legenda={`Distribuição por faixa de ${feature}`}
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
    >
      <div className="flex h-full flex-col gap-2">
        <div className="min-h-0 flex-1">
          <ResponsiveContainer width="100%" height="100%" initialDimension={{ width: 600, height: ALTURA - 40 }}>
            <BarChart data={dados} margin={{ top: 8, right: 8, bottom: 4, left: 0 }} barGap={2}>
              <XAxis dataKey="faixa" interval={0} stroke={tema.eixo} tick={{ fontSize: 11 }} />
              <YAxis tickFormatter={(v: number) => `${fmtInt(v)}%`} stroke={tema.eixo} width={44} />
              <Tooltip content={<TooltipFaixa />} cursor={{ fill: tema.grade }} />
              <Bar dataKey="treino" name="Treino" fill={tema.secundaria} radius={[4, 4, 0, 0]} isAnimationActive={false} />
              <Bar dataKey="log" name="Log" fill={tema.primaria} radius={[4, 4, 0, 0]} isAnimationActive={false} />
            </BarChart>
          </ResponsiveContainer>
        </div>
        <LegendaHtml
          titulo="Origem"
          itens={[
            { rotulo: "Treino (snapshot)", cor: tema.secundaria },
            { rotulo: "Log (janela)", cor: tema.primaria },
          ]}
        />
      </div>
    </ChartFrame>
  );
}
