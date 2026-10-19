import type { Agregado } from "@/shared/api/endpoints/tipos";

/** Uma categoria (ou célula categoria × série) da tabela longa, com todas as suas medidas. */
export type LinhaAgregado = {
  categoria: string;
  serie?: string;
  n: number;
  suprimido: boolean;
  valores: Record<string, number | null>;
};

type LinhaLonga = { ordem: number; medida: string; valor: number | null; n: number; suprimido: boolean } & Record<
  string,
  unknown
>;

/** O que `pivotar` lê de um agregado: também serve à tabela longa da vertente diabetes, que tem o mesmo formato. */
export type TabelaLonga = Pick<Agregado, "campo" | "serie" | "linhas">;

/**
 * Pivota a tabela longa de /painel/por-categoria (uma linha por categoria × medida) para uma linha
 * por categoria, na ORDEM do domínio que o backend já entrega. O domínio vem completo (grupo
 * ausente = n 0), então o eixo nunca pula quando um filtro esvazia uma categoria.
 */
export function pivotar(agregado: TabelaLonga | undefined): LinhaAgregado[] {
  if (!agregado) return [];
  const dim = agregado.campo;
  const serie = agregado.serie ?? undefined;
  const mapa = new Map<string, LinhaAgregado>();
  const linhas = [...(agregado.linhas as LinhaLonga[])].sort((a, b) => a.ordem - b.ordem);
  for (const l of linhas) {
    const categoria = String(l[dim]);
    const s = serie ? String(l[serie]) : undefined;
    const chave = `${categoria}|${s ?? ""}`;
    let alvo = mapa.get(chave);
    if (!alvo) {
      alvo = { categoria, serie: s, n: l.n, suprimido: l.suprimido, valores: {} };
      mapa.set(chave, alvo);
    }
    alvo.valores[l.medida] = l.valor;
    alvo.suprimido = alvo.suprimido || l.suprimido;
  }
  return [...mapa.values()];
}

/** Categorias distintas, na ordem de chegada (= ordem do domínio). */
export function categoriasDe(linhas: LinhaAgregado[]): string[] {
  return [...new Set(linhas.map((l) => l.categoria))];
}

/** Séries distintas, na ordem de chegada. */
export function seriesDe(linhas: LinhaAgregado[]): string[] {
  return [...new Set(linhas.map((l) => l.serie).filter((s): s is string => s !== undefined))];
}

/** Maior valor de uma medida (ignora nulos/suprimidos); 0 se não houver. */
export function maximoDe(linhas: LinhaAgregado[], medida: string): number {
  let maior = 0;
  for (const l of linhas) {
    const v = l.valores[medida];
    if (v !== null && v !== undefined && v > maior) maior = v;
  }
  return maior;
}

/** Teto "redondo" para o domínio do eixo de valor, derivado do dataset SEM cross-filter (7.3). */
export function tetoDoEixo(maximo: number): number {
  if (maximo <= 0) return 1;
  const passo = 10 ** Math.floor(Math.log10(maximo));
  return Math.ceil((maximo * 1.05) / passo) * passo;
}
