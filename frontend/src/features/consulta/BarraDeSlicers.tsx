import { useDimensoes } from "@/shared/api/endpoints/painel";
import { ROTULO_FILTRO, type NomeFiltro } from "@/shared/filtros/filtroSchema";
import { useAgregado } from "@/shared/filtros/useAgregado";
import { useFiltros } from "@/shared/filtros/useFiltros";
import { MultiSelect } from "@/shared/ui/MultiSelect";
import { SegmentedControl } from "@/shared/ui/SegmentedControl";

import { pivotar } from "../painel/agregadoUtil";

const SLICERS: Array<{ campo: NomeFiltro; tipo: "multi" | "segmentado" }> = [
  { campo: "nivel", tipo: "multi" },
  { campo: "agua", tipo: "multi" },
  { campo: "alcool", tipo: "multi" },
  { campo: "caloricos", tipo: "multi" },
  { campo: "genero", tipo: "segmentado" },
  { campo: "historico_familiar", tipo: "segmentado" },
];

/**
 * Um slicer: TODAS as opções do domínio global (de /dimensoes), com a contagem do RECORTE atual
 * (por-categoria sem o próprio filtro, para a opção não selecionada continuar contável).
 * Exibe o rótulo ("<1L") e envia o valor ("1").
 */
function Slicer({ campo, tipo }: { campo: NomeFiltro; tipo: "multi" | "segmentado" }) {
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
  if (tipo === "segmentado") {
    return <SegmentedControl rotulo={ROTULO_FILTRO[campo]} opcoes={opcoes} selecionados={selecionados} aoAlternar={(v) => alternar(campo, v)} />;
  }
  return (
    <MultiSelect
      rotulo={ROTULO_FILTRO[campo]}
      opcoes={opcoes}
      selecionados={selecionados}
      aoAlternar={(v) => alternar(campo, v)}
      aoLimpar={() => definir(campo, [])}
    />
  );
}

/** Os 6 slicers da página Consulta (§7.4): escrevem na URL e valem para o painel inteiro. */
export function BarraDeSlicers() {
  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-6" role="group" aria-label="Filtros">
      {SLICERS.map((s) => (
        <Slicer key={s.campo} campo={s.campo} tipo={s.tipo} />
      ))}
    </div>
  );
}
