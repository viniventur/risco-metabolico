import { pivotar } from "@/shared/filtros/agregadoUtil";
import type { TipoDeSlicer } from "@/shared/filtros/Slicer";
import { GrupoDeAlternancia } from "@/shared/ui/GrupoDeAlternancia";
import { MultiSelect } from "@/shared/ui/MultiSelect";
import { Skeleton } from "@/shared/ui/skeleton";

import { useDimensoesDiabetes, usePorCategoriaDiabetes } from "../api/painel";
import { semFiltros, type NomeFiltroDiabetes } from "./filtroDiabetes";
import { useFiltrosDiabetes } from "./useFiltrosDiabetes";

type Props = {
  campo: NomeFiltroDiabetes;
  tipo?: TipoDeSlicer;
  /** só para `multi`: `compacto` põe o rótulo dentro do gatilho (a faixa da Visão Geral) */
  variante?: "padrao" | "compacto";
};

/**
 * Um slicer da vertente, no desenho de shared/filtros/Slicer: TODAS as opções do domínio global (de
 * /diabetes/dimensoes), com a contagem do RECORTE atual (por-categoria sem o próprio filtro, para a
 * opção não selecionada continuar contável). O rótulo do filtro é o da API (`campos`), não uma cópia.
 */
export function SlicerDiabetes({ campo, tipo = "multi", variante = "padrao" }: Props) {
  const { filtros, alternar, definir } = useFiltrosDiabetes();
  const dimensoes = useDimensoesDiabetes();
  const contagem = usePorCategoriaDiabetes(campo, semFiltros(filtros, campo));
  if (!contagem.data && contagem.isPending) {
    return <Skeleton aria-hidden="true" className={variante === "compacto" ? "h-10 w-full" : "h-[4.25rem] w-full"} />;
  }
  const rotulo = contagem.data?.campos[0]?.rotulo ?? campo;
  const porValor = new Map(pivotar(contagem.data).map((l) => [l.categoria, l.valores.contagem ?? 0]));
  const opcoes = (dimensoes.data?.[campo] ?? []).map((o) => ({
    valor: String(o.valor),
    rotulo: o.rotulo,
    n: porValor.get(String(o.valor)) ?? o.n,
  }));
  const selecionados = filtros[campo];
  if (tipo === "alternancia") {
    return <GrupoDeAlternancia rotulo={rotulo} opcoes={opcoes} selecionados={selecionados} aoAlternar={(v) => alternar(campo, v)} />;
  }
  return (
    <MultiSelect
      rotulo={rotulo}
      opcoes={opcoes}
      selecionados={selecionados}
      aoAlternar={(v) => alternar(campo, v)}
      aoLimpar={() => definir(campo, [])}
      variante={variante}
    />
  );
}
