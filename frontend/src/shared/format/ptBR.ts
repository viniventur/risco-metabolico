// Toda formatação de número e percentual do front passa por aqui (7.3): arredondar é apresentação.
const numero = new Intl.NumberFormat("pt-BR");
const umaCasa = new Intl.NumberFormat("pt-BR", { minimumFractionDigits: 1, maximumFractionDigits: 1 });
const duasCasas = new Intl.NumberFormat("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

/** 0.413 -> "41,3%" (fração 0–1). */
export function fmtPct(fracao: number | null | undefined, casas = 1): string {
  if (fracao === null || fracao === undefined || Number.isNaN(fracao)) return "—";
  return `${(fracao * 100).toLocaleString("pt-BR", { minimumFractionDigits: casas, maximumFractionDigits: casas })}%`;
}

/** 41.3 -> "41,3%" (já em pontos percentuais, como vem dos agregados `pct`/`percentual`). */
export function fmtPontosPct(pontos: number | null | undefined, casas = 1): string {
  if (pontos === null || pontos === undefined || Number.isNaN(pontos)) return "—";
  return `${pontos.toLocaleString("pt-BR", { minimumFractionDigits: casas, maximumFractionDigits: casas })}%`;
}

export function fmtInt(valor: number | null | undefined): string {
  if (valor === null || valor === undefined || Number.isNaN(valor)) return "—";
  return numero.format(Math.round(valor));
}

const formatadores = new Map<number, Intl.NumberFormat>([
  [0, new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 0 })],
  [1, umaCasa],
  [2, duasCasas],
]);

/** Qualquer número de casas (3 para o PSI); os formatadores são cacheados por casas. */
export function fmtNum(valor: number | null | undefined, casas = 1): string {
  if (valor === null || valor === undefined || Number.isNaN(valor)) return "—";
  let f = formatadores.get(casas);
  if (!f) {
    f = new Intl.NumberFormat("pt-BR", { minimumFractionDigits: casas, maximumFractionDigits: casas });
    formatadores.set(casas, f);
  }
  return f.format(valor);
}

/**
 * Diferença com sinal (o recorte contra a base): 2.71 -> "+2,7"; −0.4 -> "−0,4"; o que arredonda
 * para zero sai sem sinal ("0,0"). O menos é o sinal tipográfico (U+2212), não o hífen.
 */
export function fmtDiferenca(valor: number | null | undefined, casas = 1): string {
  if (valor === null || valor === undefined || Number.isNaN(valor)) return "—";
  const arredondado = Number(valor.toFixed(casas));
  const sinal = arredondado > 0 ? "+" : arredondado < 0 ? "−" : "";
  return `${sinal}${fmtNum(Math.abs(arredondado), casas)}`;
}

/** Diferença entre dois percentuais, em pontos percentuais: 9.94 -> "+9,9 p.p." */
export function fmtDiferencaPontos(pontos: number | null | undefined, casas = 1): string {
  const texto = fmtDiferenca(pontos, casas);
  return texto === "—" ? texto : `${texto} p.p.`;
}

/** 24.22 -> "24,22" (IMC, 2 casas, como o app legado). */
export function fmtImc(valor: number | null | undefined): string {
  return fmtNum(valor, 2);
}

export function fmtMs(ms: number | null | undefined): string {
  if (ms === null || ms === undefined) return "—";
  return `${umaCasa.format(ms)} ms`;
}

export function fmtDataHora(iso: string | null | undefined): string {
  if (!iso) return "—";
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? iso : d.toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" });
}
