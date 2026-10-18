import type { Agregado } from "@/shared/api/endpoints/tipos";
import { CLASSES_RISCO, ORDEM_CLINICA } from "@/shared/dominio";
import { pivotar } from "@/shared/filtros/agregadoUtil";
import type { FiltroPainel } from "@/shared/filtros/filtroSchema";
import { useAgregado } from "@/shared/filtros/useAgregado";
import type { TemaGrafico } from "@/shared/tema/useChartTheme";

/** As três classes de obesidade (o fim da ordem clínica). */
export const CLASSES_OBESIDADE: readonly string[] = ORDEM_CLINICA.slice(4);

/**
 * As 4 famílias dos 7 níveis, na ordem clínica: a família dá a matiz e o grau dá o passo do degradê
 * (tokens `--nivel-*`). O rótulo da família vai nas chaves do gráfico de níveis e na legenda.
 */
export const FAMILIAS: ReadonlyArray<{ chave: string; rotulo: string; niveis: readonly string[] }> = [
  { chave: "abaixo", rotulo: "Abaixo do peso", niveis: ["Abaixo do Peso"] },
  { chave: "normal", rotulo: "Peso normal", niveis: ["Peso Normal"] },
  { chave: "sobrepeso", rotulo: "Sobrepeso", niveis: ["Sobrepeso I", "Sobrepeso II"] },
  { chave: "obesidade", rotulo: "Obesidade", niveis: CLASSES_OBESIDADE },
];

/** A amostra da família na legenda: a cor do nível, ou o degradê dos graus quando a família tem mais de um. */
export function amostraDaFamilia(niveis: readonly string[], tema: TemaGrafico): string {
  const cores = niveis.map((n) => tema.corDoNivel[n] ?? "");
  return cores.length > 1 ? `linear-gradient(90deg, ${cores.join(", ")})` : (cores[0] ?? "");
}

/** Classe do Tailwind do fundo de cada nível (estática, para o Tailwind achar no código). */
export const FUNDO_DO_NIVEL: Record<string, string> = {
  "Abaixo do Peso": "bg-nivel-abaixo",
  "Peso Normal": "bg-nivel-normal",
  "Sobrepeso I": "bg-nivel-sobrepeso-1",
  "Sobrepeso II": "bg-nivel-sobrepeso-2",
  "Obesidade I": "bg-nivel-obesidade-1",
  "Obesidade II": "bg-nivel-obesidade-2",
  "Obesidade III": "bg-nivel-obesidade-3",
};

export type ResumoNiveis = {
  total: number;
  /** registros por nível, nas 7 classes (0 quando o recorte não tem a classe) */
  porNivel: Record<string, number>;
  /** fração do recorte nas 5 classes de sobrepeso e obesidade (CLASSES_RISCO) */
  excesso: number | null;
  /** fração do recorte nas 3 classes de obesidade */
  obesidade: number | null;
};

/** Soma as contagens de /painel/por-categoria?campo=nivel; as frações são da contagem do servidor. */
export function resumirNiveis(agregado: Agregado): ResumoNiveis {
  const porNivel: Record<string, number> = {};
  for (const nivel of ORDEM_CLINICA) porNivel[nivel] = 0;
  for (const linha of pivotar(agregado)) porNivel[linha.categoria] = linha.valores.contagem ?? 0;
  const total = agregado.total_filtrado;
  const soma = (classes: readonly string[]) => classes.reduce((s, c) => s + (porNivel[c] ?? 0), 0);
  return {
    total,
    porNivel,
    excesso: total > 0 ? soma(CLASSES_RISCO) / total : null,
    obesidade: total > 0 ? soma(CLASSES_OBESIDADE) / total : null,
  };
}

/** O resumo das 7 classes num recorte (com o filtro de nível aplicado: é a composição do próprio recorte). */
export function useResumoNiveis(filtros: FiltroPainel) {
  const q = useAgregado("nivel", "contagem", filtros);
  return { ...q, resumo: q.data ? resumirNiveis(q.data) : undefined };
}
