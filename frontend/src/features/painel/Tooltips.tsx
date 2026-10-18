// Conteúdos de <Tooltip> declarados FORA do render dos gráficos (§7.3), todos sobre o TooltipGrafico.
import { TooltipGrafico } from "@/shared/graficos/TooltipGrafico";
import { fmtImc, fmtInt, fmtNum } from "@/shared/format/ptBR";

type Carga<T> = {
  active?: boolean;
  payload?: Array<{ payload: T; dataKey?: string | number; name?: string | number; color?: string; fill?: string }>;
};

export type LinhaMedia = {
  categoria: string;
  rotulo: string;
  valor: number;
  n: number;
  suprimido: boolean;
  rotuloValor: string;
};

export function TooltipMedia({ active, payload }: Carga<LinhaMedia>) {
  if (!active || !payload?.[0]) return null;
  const l = payload[0].payload;
  if (l.suprimido) {
    return <TooltipGrafico titulo={l.rotulo} linhas={[{ rotulo: "Registros", valor: fmtInt(l.n) }]} nota="Amostra insuficiente (n < 15): a média não é exibida." />;
  }
  return (
    <TooltipGrafico
      titulo={l.rotulo}
      linhas={[
        { rotulo: "IMC médio", valor: fmtNum(l.valor, 1), cor: payload[0].color ?? payload[0].fill },
        { rotulo: "Registros", valor: fmtInt(l.n) },
      ]}
    />
  );
}

export type LinhaSeries = { categoria: string; rotulo: string } & Record<string, unknown>;

export function TooltipSeries({ active, payload }: Carga<LinhaSeries>) {
  if (!active || !payload?.length) return null;
  const l = payload[0]!.payload;
  return (
    <TooltipGrafico
      titulo={l.rotulo}
      linhas={payload.map((p) => {
        const serie = String(p.dataKey ?? p.name ?? "");
        const n = l[`n_${serie}`] as number | undefined;
        const suprimido = l[`suprimido_${serie}`] as boolean | undefined;
        const valor = l[serie] as number | undefined;
        return {
          rotulo: serie,
          cor: p.color ?? p.fill,
          valor: suprimido ? `n < 15 (n = ${fmtInt(n)})` : `${fmtNum(valor, 1)} · n = ${fmtInt(n)}`,
        };
      })}
      nota="IMC médio por gênero"
    />
  );
}

export type PontoPlot = { altura: number; peso: number; imc: number; nivel: string };

export function TooltipPonto({ active, payload }: Carga<PontoPlot>) {
  if (!active || !payload?.[0]) return null;
  const p = payload[0].payload;
  return (
    <TooltipGrafico
      titulo={p.nivel}
      linhas={[
        { rotulo: "Peso", valor: `${fmtNum(p.peso, 1)} kg`, cor: payload[0].color ?? payload[0].fill },
        { rotulo: "Altura", valor: `${fmtNum(p.altura, 2)} m` },
        { rotulo: "IMC", valor: fmtImc(p.imc) },
      ]}
    />
  );
}
