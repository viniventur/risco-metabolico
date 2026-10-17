import type { FiltroPainel } from "@/shared/filtros/filtroSchema";

// Chaves de cache do TanStack Query. Filtros entram serializados e ordenados (paraQueryString),
// para o mesmo recorte em ordem diferente de parâmetros bater no mesmo cache.
export const chaves = {
  saude: ["saude"] as const,
  modelo: (versao?: string) => ["modelo", versao ?? "padrao"] as const,
  importancia: (top: number) => ["modelo", "importancia", top] as const,
  metadata: ["metadata"] as const,
  dimensoes: ["dimensoes"] as const,
  resumo: (f: FiltroPainel) => ["painel", "resumo", f] as const,
  porCategoria: (campo: string, metrica: string, serie: string | undefined, f: FiltroPainel) =>
    ["painel", "por-categoria", campo, metrica, serie ?? "", f] as const,
  genero: (f: FiltroPainel) => ["painel", "genero", f] as const,
  pontos: (amostra: number, f: FiltroPainel) => ["painel", "pontos", amostra, f] as const,
  registros: (f: FiltroPainel, pagina: number, tamanho: number, ordenarPor: string, direcao: string) =>
    ["registros", f, pagina, tamanho, ordenarPor, direcao] as const,
  deriva: (janela: number, feature?: string) => ["monitoramento", "deriva", janela, feature ?? ""] as const,
  estudos: ["estudos", "manifest"] as const,
  estudo: (slug: string) => ["estudos", slug] as const,
};
