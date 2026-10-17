import { Bar, BarChart, Cell, LabelList, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

import type { RespostaTriagem } from "@/shared/api/endpoints/tipos";
import { fmtPct } from "@/shared/format/ptBR";
import { useChartTheme } from "@/shared/tema/useChartTheme";
import { TabelaEquivalente } from "@/shared/ui/TabelaEquivalente";

type Linha = { classe: string; pct: number; risco: boolean };

function TooltipBarras({ active, payload }: { active?: boolean; payload?: Array<{ payload: Linha }> }) {
  if (!active || !payload?.[0]) return null;
  const l = payload[0].payload;
  return (
    <div className="cartao px-3 py-2 text-xs">
      <strong>{l.classe}</strong> · {fmtPct(l.pct / 100)} {l.risco ? "· classe de risco" : ""}
    </div>
  );
}

/** 7 barras horizontais em ORDEM CLÍNICA, domínio fixo [0, 100], rótulo {v:.1f}% — como o Altair do legado. */
export function BarrasProbabilidade({ resposta, mostrarTabela }: { resposta: RespostaTriagem; mostrarTabela?: boolean }) {
  const tema = useChartTheme();
  const dados: Linha[] = resposta.probabilidades.map((p) => ({ classe: p.classe, pct: p.probabilidade * 100, risco: p.de_risco }));
  const altura = Math.max(260, 70 * dados.length);
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
  return (
    <div style={{ height: altura }} role="img" aria-label="Distribuição de probabilidade por classe, em ordem clínica">
      <ResponsiveContainer width="100%" height="100%" initialDimension={{ width: 600, height: altura }}>
        <BarChart data={dados} layout="vertical" margin={{ top: 8, right: 56, bottom: 8, left: 8 }}>
          <XAxis type="number" domain={[0, 100]} tickFormatter={(v: number) => `${v}%`} stroke={tema.eixo} />
          <YAxis type="category" dataKey="classe" width={120} interval={0} stroke={tema.eixo} />
          <Tooltip content={<TooltipBarras />} cursor={{ fill: tema.grade }} />
          <Bar dataKey="pct" radius={[0, 6, 6, 0]} barSize={48} isAnimationActive={false}>
            {dados.map((d) => (
              <Cell key={d.classe} fill={d.risco ? tema.primaria : tema.secundaria} />
            ))}
            <LabelList dataKey="pct" position="right" formatter={(v: unknown) => fmtPct(Number(v) / 100)} fill={tema.texto} fontSize={13} />
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
