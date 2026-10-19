/**
 * Os 6 filtros da vertente diabetes (ADR 0005, como os da obesidade): multivalorados, viajam na URL e
 * vão ao servidor como query params. Os nomes são os da API (`/diabetes/dimensoes`), que são os do
 * `campo` de `/diabetes/painel/por-categoria`. O alvo não é filtro: com ele, o % com diabetes viraria
 * 100% ou 0%. Os RÓTULOS de cada filtro e de cada valor vêm da API (`campos`, `/dimensoes`).
 */
export const NOMES_FILTRO_DIABETES = ["sexo", "faixa_etaria", "faixa_imc", "pressao_alta", "colesterol_alto", "atividade_fisica_30_dias"] as const;

export type NomeFiltroDiabetes = (typeof NOMES_FILTRO_DIABETES)[number];
export type FiltroDiabetes = Record<NomeFiltroDiabetes, string[]>;

export const FILTRO_VAZIO_DIABETES: FiltroDiabetes = {
  sexo: [],
  faixa_etaria: [],
  faixa_imc: [],
  pressao_alta: [],
  colesterol_alto: [],
  atividade_fisica_30_dias: [],
};

export function filtroVazioDiabetes(f: FiltroDiabetes): boolean {
  return NOMES_FILTRO_DIABETES.every((n) => f[n].length === 0);
}

/** "2" antes de "10": as faixas etárias são inteiros em texto. */
const ordenar = (a: string, b: string) => a.localeCompare(b, "pt-BR", { numeric: true });

/** Normaliza: valores únicos e ordenados por filtro — chave de cache estável. */
export function normalizarFiltroDiabetes(f: Partial<FiltroDiabetes>): FiltroDiabetes {
  const saida = { ...FILTRO_VAZIO_DIABETES };
  for (const nome of NOMES_FILTRO_DIABETES) saida[nome] = Array.from(new Set(f[nome] ?? [])).sort(ordenar);
  return saida;
}

/** FiltroDiabetes -> parâmetros repetíveis (`?faixa_etaria=9&faixa_etaria=10&sexo=Feminino`), sem os vazios. */
export function paraQueryStringDiabetes(f: FiltroDiabetes): Partial<Record<NomeFiltroDiabetes, string[]>> {
  const saida: Partial<Record<NomeFiltroDiabetes, string[]>> = {};
  for (const nome of NOMES_FILTRO_DIABETES) {
    const valores = Array.from(new Set(f[nome])).sort(ordenar);
    if (valores.length > 0) saida[nome] = valores;
  }
  return saida;
}

/** O recorte sem alguns filtros: o gráfico de ORIGEM não se filtra pelo próprio eixo (7.3). */
export function semFiltros(f: FiltroDiabetes, ...nomes: NomeFiltroDiabetes[]): FiltroDiabetes {
  const saida = { ...f };
  for (const nome of nomes) saida[nome] = [];
  return saida;
}
