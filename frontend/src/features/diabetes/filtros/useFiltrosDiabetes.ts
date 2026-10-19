import { parseAsArrayOf, parseAsString, useQueryStates } from "nuqs";
import { useCallback, useMemo } from "react";

import { FILTRO_VAZIO_DIABETES, filtroVazioDiabetes, normalizarFiltroDiabetes, type FiltroDiabetes, type NomeFiltroDiabetes } from "./filtroDiabetes";

const parsers = {
  sexo: parseAsArrayOf(parseAsString).withDefault([]),
  faixa_etaria: parseAsArrayOf(parseAsString).withDefault([]),
  faixa_imc: parseAsArrayOf(parseAsString).withDefault([]),
  pressao_alta: parseAsArrayOf(parseAsString).withDefault([]),
  colesterol_alto: parseAsArrayOf(parseAsString).withDefault([]),
  atividade_fisica_30_dias: parseAsArrayOf(parseAsString).withDefault([]),
};

/**
 * Os filtros da vertente diabetes moram na URL (nuqs), como os da obesidade (shared/filtros/useFiltros):
 * o painel se compartilha por link e voltar/avançar vira desfazer de filtro. Os nomes não colidem com
 * os da obesidade, e as telas de cada vertente só leem os seus.
 */
export function useFiltrosDiabetes() {
  const [estado, setEstado] = useQueryStates(parsers, { history: "push", throttleMs: 200 });

  const filtros = useMemo<FiltroDiabetes>(() => normalizarFiltroDiabetes(estado), [estado]);
  const vazio = filtroVazioDiabetes(filtros);

  const alternar = useCallback(
    (nome: NomeFiltroDiabetes, valor: string) => {
      void setEstado((atual) => {
        const lista = atual[nome] ?? [];
        return { [nome]: lista.includes(valor) ? lista.filter((v) => v !== valor) : [...lista, valor] };
      });
    },
    [setEstado],
  );

  const definir = useCallback(
    (nome: NomeFiltroDiabetes, valores: string[]) => {
      void setEstado({ [nome]: valores });
    },
    [setEstado],
  );

  const limpar = useCallback(() => {
    void setEstado({ ...FILTRO_VAZIO_DIABETES });
  }, [setEstado]);

  return { filtros, vazio, alternar, definir, limpar };
}
