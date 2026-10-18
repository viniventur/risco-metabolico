import { z } from "zod";

// Os 6 filtros do painel (ADR 0005): multivalorados, viajam na URL e vão ao servidor como query params.
export const filtroSchema = z.object({
  nivel: z.array(z.string()).default([]),
  genero: z.array(z.string()).default([]),
  agua: z.array(z.string()).default([]),
  alcool: z.array(z.string()).default([]),
  caloricos: z.array(z.string()).default([]),
  historico_familiar: z.array(z.string()).default([]),
});

export type FiltroPainel = z.infer<typeof filtroSchema>;
export type NomeFiltro = keyof FiltroPainel;

export const NOMES_FILTRO: NomeFiltro[] = ["nivel", "genero", "agua", "alcool", "caloricos", "historico_familiar"];

export const FILTRO_VAZIO: FiltroPainel = {
  nivel: [],
  genero: [],
  agua: [],
  alcool: [],
  caloricos: [],
  historico_familiar: [],
};

export const ROTULO_FILTRO: Record<NomeFiltro, string> = {
  nivel: "Nível de obesidade",
  genero: "Gênero",
  agua: "Consumo de água",
  alcool: "Consumo de álcool",
  caloricos: "Alimentos calóricos",
  historico_familiar: "Histórico familiar",
};

/** O rótulo que cabe dentro do gatilho compacto da faixa de filtros ("Água · Todos"); o completo vai ao leitor de tela. */
export const ROTULO_CURTO_FILTRO: Record<NomeFiltro, string> = {
  nivel: "Nível",
  genero: "Gênero",
  agua: "Água",
  alcool: "Álcool",
  caloricos: "Calóricos",
  historico_familiar: "Histórico",
};

export function filtroVazio(f: FiltroPainel): boolean {
  return NOMES_FILTRO.every((n) => f[n].length === 0);
}

/** Normaliza: valores únicos e ordenados por filtro — chave de cache estável. */
export function normalizarFiltro(f: Partial<FiltroPainel>): FiltroPainel {
  const saida = { ...FILTRO_VAZIO };
  for (const nome of NOMES_FILTRO) {
    saida[nome] = Array.from(new Set(f[nome] ?? [])).sort((a, b) => a.localeCompare(b, "pt-BR"));
  }
  return saida;
}
