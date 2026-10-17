import { parseAsArrayOf, parseAsString, useQueryStates } from "nuqs";
import { useCallback, useMemo } from "react";

import { FILTRO_VAZIO, filtroVazio, normalizarFiltro, type FiltroPainel, type NomeFiltro } from "./filtroSchema";

const parsers = {
  nivel: parseAsArrayOf(parseAsString).withDefault([]),
  genero: parseAsArrayOf(parseAsString).withDefault([]),
  agua: parseAsArrayOf(parseAsString).withDefault([]),
  alcool: parseAsArrayOf(parseAsString).withDefault([]),
  caloricos: parseAsArrayOf(parseAsString).withDefault([]),
  historico_familiar: parseAsArrayOf(parseAsString).withDefault([]),
};

/**
 * Os filtros do painel moram na URL (nuqs): o painel se compartilha por link e voltar/avançar
 * vira desfazer de filtro de graça. Os valores viajam para o servidor como query params.
 */
export function useFiltros() {
  const [estado, setEstado] = useQueryStates(parsers, { history: "push", throttleMs: 200 });

  const filtros = useMemo<FiltroPainel>(() => normalizarFiltro(estado), [estado]);
  const vazio = filtroVazio(filtros);

  const alternar = useCallback(
    (nome: NomeFiltro, valor: string) => {
      void setEstado((atual) => {
        const lista = atual[nome] ?? [];
        return { [nome]: lista.includes(valor) ? lista.filter((v) => v !== valor) : [...lista, valor] };
      });
    },
    [setEstado],
  );

  const definir = useCallback(
    (nome: NomeFiltro, valores: string[]) => {
      void setEstado({ [nome]: valores });
    },
    [setEstado],
  );

  const limpar = useCallback(() => {
    void setEstado({ ...FILTRO_VAZIO });
  }, [setEstado]);

  return { filtros, vazio, alternar, definir, limpar, FILTRO_VAZIO };
}
