import { ChevronDown, SlidersHorizontal } from "lucide-react";
import { useId, useState } from "react";

import type { TipoDeSlicer } from "@/shared/filtros/Slicer";
import { cn } from "@/shared/lib/utils";
import { Badge } from "@/shared/ui/badge";
import { Card } from "@/shared/ui/card";

import { NOMES_FILTRO_DIABETES, type NomeFiltroDiabetes } from "../filtros/filtroDiabetes";
import { SlicerDiabetes } from "../filtros/SlicerDiabetes";
import { useFiltrosDiabetes } from "../filtros/useFiltrosDiabetes";

/** As duas escalas abrem lista; as quatro respostas de dois valores são alternância (como gênero e histórico na obesidade). */
const SLICERS: Array<{ campo: NomeFiltroDiabetes; tipo: TipoDeSlicer }> = [
  { campo: "faixa_etaria", tipo: "multi" },
  { campo: "faixa_imc", tipo: "multi" },
  { campo: "sexo", tipo: "alternancia" },
  { campo: "pressao_alta", tipo: "alternancia" },
  { campo: "colesterol_alto", tipo: "alternancia" },
  { campo: "atividade_fisica_30_dias", tipo: "alternancia" },
];

/**
 * Os 6 slicers da Consulta da vertente (o desenho de BarraDeSlicers, da obesidade): escrevem na URL e
 * valem também para a Visão Geral da diabetes. Os rótulos da API são mais longos que os da obesidade:
 * no máximo três por linha. Abaixo de 768 px o cartão abre recolhido, com a contagem de ativos no botão.
 */
export function BarraDeSlicersDiabetes() {
  const { filtros } = useFiltrosDiabetes();
  const [aberto, setAberto] = useState(false);
  const idCorpo = useId();
  const ativos = NOMES_FILTRO_DIABETES.reduce((n, nome) => n + filtros[nome].length, 0);
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
        className={cn("grid-cols-1 gap-x-4 gap-y-4 p-5 pt-3 sm:grid-cols-2 md:grid lg:grid-cols-3", aberto ? "grid" : "hidden")}
      >
        {SLICERS.map((s) => (
          <SlicerDiabetes key={s.campo} campo={s.campo} tipo={s.tipo} />
        ))}
      </div>
    </Card>
  );
}
