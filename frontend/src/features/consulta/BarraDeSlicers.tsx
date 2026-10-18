import { ChevronDown, SlidersHorizontal } from "lucide-react";
import { useId, useState } from "react";

import { useDimensoes } from "@/shared/api/endpoints/painel";
import { NOMES_FILTRO, ROTULO_FILTRO, type NomeFiltro } from "@/shared/filtros/filtroSchema";
import { useAgregado } from "@/shared/filtros/useAgregado";
import { useFiltros } from "@/shared/filtros/useFiltros";
import { cn } from "@/shared/lib/utils";
import { Badge } from "@/shared/ui/badge";
import { Card } from "@/shared/ui/card";
import { GrupoDeAlternancia } from "@/shared/ui/GrupoDeAlternancia";
import { MultiSelect } from "@/shared/ui/MultiSelect";

import { pivotar } from "../painel/agregadoUtil";

const SLICERS: Array<{ campo: NomeFiltro; tipo: "multi" | "alternancia" }> = [
  { campo: "nivel", tipo: "multi" },
  { campo: "agua", tipo: "multi" },
  { campo: "alcool", tipo: "multi" },
  { campo: "caloricos", tipo: "multi" },
  { campo: "genero", tipo: "alternancia" },
  { campo: "historico_familiar", tipo: "alternancia" },
];

/**
 * Um slicer: TODAS as opções do domínio global (de /dimensoes), com a contagem do RECORTE atual
 * (por-categoria sem o próprio filtro, para a opção não selecionada continuar contável).
 * Exibe o rótulo ("<1L") e envia o valor ("1").
 */
function Slicer({ campo, tipo }: { campo: NomeFiltro; tipo: "multi" | "alternancia" }) {
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
    />
  );
}

/**
 * Os 6 slicers da página Consulta (§7.4): escrevem na URL e valem para o painel inteiro. Abaixo de
 * 768 px o cartão abre recolhido — antes os 6 empilhados empurravam a tabela para 687 px
 * (redesenho, 1.16); a contagem de filtros ativos fica no botão.
 */
export function BarraDeSlicers() {
  const { filtros } = useFiltros();
  const [aberto, setAberto] = useState(false);
  const idCorpo = useId();
  const ativos = NOMES_FILTRO.reduce((n, nome) => n + filtros[nome].length, 0);
  return (
    <Card>
      <div className="flex items-center justify-between gap-2 px-5 pt-4 pb-1 md:pb-0">
        <h2 className="flex items-center gap-2 text-[15px] font-semibold tracking-tight">
          <SlidersHorizontal aria-hidden="true" className="size-4 text-muted-foreground" />
          Filtros
          {ativos > 0 ? <Badge>{ativos} ativo(s)</Badge> : null}
        </h2>
        <button
          type="button"
          aria-expanded={aberto}
          aria-controls={idCorpo}
          onClick={() => setAberto((v) => !v)}
          className="inline-flex h-11 items-center gap-1.5 rounded-md px-3 text-sm font-medium text-muted-foreground hover:bg-accent md:hidden"
        >
          {aberto ? "Ocultar" : "Mostrar"}
          <ChevronDown aria-hidden="true" className={cn("size-4 transition-transform", aberto && "rotate-180")} />
        </button>
      </div>
      <div
        id={idCorpo}
        role="group"
        aria-label="Filtros"
        className={cn("grid-cols-1 gap-x-4 gap-y-4 p-5 pt-3 sm:grid-cols-2 md:grid lg:grid-cols-3 2xl:grid-cols-6", aberto ? "grid" : "hidden")}
      >
        {SLICERS.map((s) => (
          <Slicer key={s.campo} campo={s.campo} tipo={s.tipo} />
        ))}
      </div>
    </Card>
  );
}
