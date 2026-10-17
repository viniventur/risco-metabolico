import { NOMES_FILTRO, type FiltroPainel } from "./filtroSchema";

/** FiltroPainel -> parâmetros repetíveis (`?nivel=a&nivel=b&genero=x`), estável e ordenado. */
export function paraQueryString(f: FiltroPainel): Record<string, string[]> {
  const saida: Record<string, string[]> = {};
  for (const nome of NOMES_FILTRO) {
    const valores = Array.from(new Set(f[nome])).sort((a, b) => a.localeCompare(b, "pt-BR"));
    if (valores.length > 0) saida[nome] = valores;
  }
  return saida;
}

/** Só para exibição/depuração: a string `nivel=a&nivel=b` na ordem canônica. */
export function paraStringLegivel(f: FiltroPainel): string {
  const partes: string[] = [];
  for (const [nome, valores] of Object.entries(paraQueryString(f))) {
    for (const v of valores) partes.push(`${nome}=${encodeURIComponent(v)}`);
  }
  return partes.join("&");
}
