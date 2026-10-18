import { Bar, BarChart, Cell, LabelList, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

import type { RespostaTriagem } from "@/shared/api/endpoints/tipos";
import { fmtPct } from "@/shared/format/ptBR";
import { FONTE_DO_EIXO, larguraDoRotulo, propsDoEixo } from "@/shared/graficos/eixos";
import { TabelaEquivalente } from "@/shared/graficos/TabelaEquivalente";
import { TooltipGrafico } from "@/shared/graficos/TooltipGrafico";
import { useChartTheme } from "@/shared/tema/useChartTheme";

type Linha = { classe: string; pct: number; risco: boolean; prevista: boolean };

function TooltipBarras({ active, payload }: { active?: boolean; payload?: Array<{ payload: Linha }> }) {
  if (!active || !payload?.[0]) return null;
  const l = payload[0].payload;
  return (
    <TooltipGrafico
      titulo={l.classe}
      linhas={[{ rotulo: "Probabilidade", valor: fmtPct(l.pct / 100) }]}
      nota={[l.prevista ? "Classe estimada" : null, l.risco ? "Classe de risco" : null].filter(Boolean).join(" · ") || undefined}
    />
  );
}

/** Altura por classe: 7 barras legíveis sem empurrar o resultado para fora da dobra. */
const ALTURA_POR_CLASSE = 40;

/**
 * 7 barras horizontais em ORDEM CLÍNICA, domínio fixo [0, 100], rótulo {v:.1f}% — como o Altair do
 * legado — e em COR ÚNICA (§7.5): a classe estimada em opacidade cheia, as demais na mesma cor mais
 * clara. Antes eram dois azuis sem legenda (redesenho, 1.14).
 */
export function BarrasProbabilidade({ resposta, mostrarTabela }: { resposta: RespostaTriagem; mostrarTabela?: boolean }) {
  const tema = useChartTheme();
  const dados: Linha[] = resposta.probabilidades.map((p) => ({
    classe: p.classe,
    pct: p.probabilidade * 100,
    risco: p.de_risco,
    prevista: p.classe === resposta.classe_prevista,
  }));
  const altura = ALTURA_POR_CLASSE * dados.length + 32;
  if (mostrarTabela) {
    return (
      <TabelaEquivalente
        legenda="Probabilidade por classe"
        colunas={[
          { chave: "classe", rotulo: "Classe" },
          { chave: "pct", rotulo: "Probabilidade", alinhar: "right" },
          { chave: "risco", rotulo: "Risco" },
        ]}
        linhas={dados.map((d) => ({ classe: d.classe, pct: fmtPct(d.pct / 100), risco: d.risco ? "sim" : "não" }))}
      />
    );
  }
  const eixo = propsDoEixo(tema);
  return (
    <div style={{ height: altura }} role="img" aria-label="Distribuição de probabilidade por classe, em ordem clínica">
      <ResponsiveContainer width="100%" height="100%" initialDimension={{ width: 480, height: altura }}>
        <BarChart data={dados} layout="vertical" margin={{ top: 0, right: 52, bottom: 0, left: 0 }} barCategoryGap="26%">
          <XAxis type="number" domain={[0, 100]} ticks={[0, 25, 50, 75, 100]} tickFormatter={(v: number) => `${v}%`} {...eixo} />
          <YAxis type="category" dataKey="classe" width={larguraDoRotulo(dados.map((d) => d.classe))} interval={0} {...eixo} axisLine={false} />
          <Tooltip content={<TooltipBarras />} cursor={{ fill: tema.grade, fillOpacity: 0.5 }} />
          <Bar dataKey="pct" fill={tema.primaria} radius={[0, 5, 5, 0]} background={{ fill: tema.grade, fillOpacity: 0.35, radius: 5 }} isAnimationActive={false}>
            {dados.map((d) => (
              <Cell key={d.classe} fillOpacity={d.prevista ? 1 : 0.5} />
            ))}
            <LabelList dataKey="pct" position="right" formatter={(v: unknown) => fmtPct(Number(v) / 100)} fill={tema.texto} fontSize={FONTE_DO_EIXO} />
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
