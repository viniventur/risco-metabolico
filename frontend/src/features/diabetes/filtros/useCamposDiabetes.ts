import { useQueries, type UseQueryResult } from "@tanstack/react-query";

import { consultaPorCategoriaDiabetes } from "../api/painel";
import type { AgregadoDiabetes, CampoPainelDiabetes } from "../api/tipos";
import { FILTRO_VAZIO_DIABETES } from "./filtroDiabetes";

/** Um mapa campo -> rótulos; o primeiro que chegar vale (as respostas repetem o mesmo rótulo). */
export function juntarCampos(campos: CampoPainelDiabetes[]): Map<string, CampoPainelDiabetes> {
  const mapa = new Map<string, CampoPainelDiabetes>();
  for (const c of campos) if (!mapa.has(c.campo)) mapa.set(c.campo, c);
  return mapa;
}

// Fora do hook: com a referência estável, o `combine` só roda de novo quando uma consulta muda.
const combinar = (resultados: UseQueryResult<AgregadoDiabetes>[]) => juntarCampos(resultados.flatMap((r) => r.data?.campos ?? []));

/**
 * Os rótulos de campos do painel e de cada valor deles, como a API os entrega em `campos` — o front
 * não guarda uma segunda cópia. Vêm de `/diabetes/painel/por-categoria` sem filtro, a mesma consulta
 * que dá a base dos gráficos (cache longo): pedir o rótulo não custa uma requisição a mais.
 */
export function useCamposDiabetes(campos: readonly string[]): Map<string, CampoPainelDiabetes> {
  return useQueries({
    queries: campos.map((campo) => consultaPorCategoriaDiabetes({ campo, filtros: FILTRO_VAZIO_DIABETES })),
    combine: combinar,
  });
}

/** O rótulo de um valor no campo (o da API), ou o próprio valor enquanto o rótulo não chegou. */
export function rotuloDoValor(campo: CampoPainelDiabetes | undefined, valor: string): string {
  return campo?.valores.find((v) => v.valor === valor)?.rotulo ?? valor;
}
