// Conteúdos de <Tooltip> declarados FORA do render dos gráficos (7.3).
import { fmtImc, fmtInt, fmtNum, fmtPontosPct } from "@/shared/format/ptBR";

type Carga<T> = {
  active?: boolean;
  payload?: Array<{ payload: T; dataKey?: string | number; name?: string | number }>;
};

export type LinhaContagem = { categoria: string; rotulo: string; contagem: number; pct: number | null };
export type LinhaMedia = {
  categoria: string;
  rotulo: string;
  valor: number;
  n: number;
  suprimido: boolean;
  rotuloValor: string;
};

export function TooltipContagem({ active, payload }: Carga<LinhaContagem>) {
  if (!active || !payload?.[0]) return null;
  const l = payload[0].payload;
  return (
    <div className="cartao px-3 py-2 text-xs">
      <strong>{l.rotulo}</strong>
      <div>
        {fmtInt(l.contagem)} registros · {fmtPontosPct(l.pct)} do recorte
      </div>
    </div>
  );
}

export function TooltipMedia({ active, payload }: Carga<LinhaMedia>) {
  if (!active || !payload?.[0]) return null;
  const l = payload[0].payload;
  return (
    <div className="cartao px-3 py-2 text-xs">
      <strong>{l.rotulo}</strong>
      <div>
        {l.suprimido ? `amostra insuficiente (n = ${fmtInt(l.n)})` : `IMC médio ${fmtNum(l.valor, 1)} · n = ${fmtInt(l.n)}`}
      </div>
    </div>
  );
}

export type LinhaSeries = { categoria: string; rotulo: string } & Record<string, unknown>;

export function TooltipSeries({ active, payload }: Carga<LinhaSeries>) {
  if (!active || !payload?.length) return null;
  const l = payload[0]!.payload;
  return (
    <div className="cartao px-3 py-2 text-xs">
      <strong>{l.rotulo}</strong>
      {payload.map((p) => {
        const serie = String(p.dataKey ?? p.name ?? "");
        const n = l[`n_${serie}`] as number | undefined;
        const suprimido = l[`suprimido_${serie}`] as boolean | undefined;
        const valor = l[serie] as number | undefined;
        return (
          <div key={serie}>
            {serie}:{" "}
            {suprimido ? `amostra insuficiente (n = ${fmtInt(n)})` : `IMC médio ${fmtNum(valor, 1)} · n = ${fmtInt(n)}`}
          </div>
        );
      })}
    </div>
  );
}

export type PontoPlot = { altura: number; peso: number; imc: number; nivel: string };

export function TooltipPonto({ active, payload }: Carga<PontoPlot>) {
  if (!active || !payload?.[0]) return null;
  const p = payload[0].payload;
  return (
    <div className="cartao px-3 py-2 text-xs">
      <strong>{p.nivel}</strong>
      <div>
        {fmtNum(p.peso, 1)} kg · {fmtNum(p.altura, 2)} m · IMC {fmtImc(p.imc)}
      </div>
    </div>
  );
}
