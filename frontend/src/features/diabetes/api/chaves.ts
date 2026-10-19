import type { FiltroDiabetes } from "../filtros/filtroDiabetes";

// Chaves de cache do TanStack Query da vertente diabetes, todas sob "diabetes": nunca colidem com as
// da obesidade (shared/api/queryKeys.ts). Os filtros entram normalizados (useFiltrosDiabetes), para o
// mesmo recorte em outra ordem de parâmetros bater no mesmo cache.
export const chavesDiabetes = {
  dimensoes: ["diabetes", "dimensoes"] as const,
  resumo: (f: FiltroDiabetes) => ["diabetes", "painel", "resumo", f] as const,
  porCategoria: (campo: string, serie: string | undefined, f: FiltroDiabetes) =>
    ["diabetes", "painel", "por-categoria", campo, serie ?? "", f] as const,
  fatores: (f: FiltroDiabetes) => ["diabetes", "painel", "fatores", f] as const,
  registros: (f: FiltroDiabetes, pagina: number, tamanho: number, ordenarPor: string, direcao: string) =>
    ["diabetes", "registros", f, pagina, tamanho, ordenarPor, direcao] as const,
  metadata: ["diabetes", "metadata"] as const,
  modelo: ["diabetes", "modelo"] as const,
  deriva: (janela: number, feature?: string) => ["diabetes", "monitoramento", "deriva", janela, feature ?? ""] as const,
};
