import { useDimensoes } from "@/shared/api/endpoints/painel";
import { GrupoDeAlternancia } from "@/shared/ui/GrupoDeAlternancia";
import { MultiSelect } from "@/shared/ui/MultiSelect";

import { pivotar } from "./agregadoUtil";
import { ROTULO_CURTO_FILTRO, ROTULO_FILTRO, type NomeFiltro } from "./filtroSchema";
import { useAgregado } from "./useAgregado";
import { useFiltros } from "./useFiltros";

export type TipoDeSlicer = "multi" | "alternancia";

type Props = {
  campo: NomeFiltro;
  tipo?: TipoDeSlicer;
  /** só para `multi`: `compacto` põe o rótulo dentro do gatilho (a faixa da Visão Geral) */
  variante?: "padrao" | "compacto";
};

/**
 * Um slicer: TODAS as opções do domínio global (de /dimensoes), com a contagem do RECORTE atual
 * (por-categoria sem o próprio filtro, para a opção não selecionada continuar contável).
 * Exibe o rótulo ("<1L") e envia o valor ("1"). Serve à Consulta e à faixa de filtros da Visão Geral.
 */
export function Slicer({ campo, tipo = "multi", variante = "padrao" }: Props) {
  const { filtros, alternar, definir } = useFiltros();
  const dimensoes = useDimensoes();
  const contagem = useAgregado(campo, "contagem", { ...filtros, [campo]: [] });
  const porValor = new Map(pivotar(contagem.data).map((l) => [l.categoria, l.valores.contagem ?? 0]));
  const opcoes = (dimensoes.data?.[campo] ?? []).map((o) => ({
    valor: String(o.valor),
    rotulo: o.rotulo,
    n: porValor.get(String(o.valor)) ?? o.n,
  }));
  const selecionados = filtros[campo];
  if (tipo === "alternancia") {
    return <GrupoDeAlternancia rotulo={ROTULO_FILTRO[campo]} opcoes={opcoes} selecionados={selecionados} aoAlternar={(v) => alternar(campo, v)} />;
  }
  return (
    <MultiSelect
      rotulo={ROTULO_FILTRO[campo]}
      opcoes={opcoes}
      selecionados={selecionados}
      aoAlternar={(v) => alternar(campo, v)}
      aoLimpar={() => definir(campo, [])}
      variante={variante}
      rotuloCurto={variante === "compacto" ? ROTULO_CURTO_FILTRO[campo] : undefined}
    />
  );
}
