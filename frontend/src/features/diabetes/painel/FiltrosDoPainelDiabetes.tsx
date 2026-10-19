import { ChevronDown, SlidersHorizontal } from "lucide-react";
import { useId, useState } from "react";

import { cn } from "@/shared/lib/utils";
import { Badge } from "@/shared/ui/badge";

import { NOMES_FILTRO_DIABETES } from "../filtros/filtroDiabetes";
import { SlicerDiabetes } from "../filtros/SlicerDiabetes";
import { useFiltrosDiabetes } from "../filtros/useFiltrosDiabetes";

/**
 * Os 6 filtros da Visão Geral da vertente em dropdowns, numa faixa acima de tudo o que eles comandam
 * (o desenho de FiltrosDoPainel, da obesidade): dropdown e clique nos gráficos escrevem a mesma URL.
 * O rótulo de cada filtro é o da API, mais longo que os curtos da obesidade ("Atividade física nos
 * últimos 30 dias"): a faixa usa no máximo três colunas e fica presa ao topo a partir de 1280 px, onde
 * cabe em duas linhas. Abaixo de 768 px ela abre recolhida, numa coluna, com a contagem de filtros
 * ativos no botão.
 */
export function FiltrosDoPainelDiabetes() {
  const { filtros } = useFiltrosDiabetes();
  const [aberto, setAberto] = useState(false);
  const idCorpo = useId();
  const ativos = NOMES_FILTRO_DIABETES.reduce((n, nome) => n + filtros[nome].length, 0);
  return (
    <div className="nao-imprimir z-20 rounded-lg border bg-card/90 p-2 shadow-sm backdrop-blur supports-[backdrop-filter]:bg-card/75 xl:sticky xl:top-[4.25rem]">
      <button
        type="button"
        aria-expanded={aberto}
        aria-controls={idCorpo}
        onClick={() => setAberto((v) => !v)}
        className="flex h-11 w-full items-center gap-2 rounded-md px-2 text-sm font-medium hover:bg-accent md:hidden"
      >
        <SlidersHorizontal aria-hidden="true" className="size-4 text-muted-foreground" />
        Filtros
        {ativos > 0 ? <Badge>{ativos} ativo(s)</Badge> : null}
        <ChevronDown aria-hidden="true" className={cn("ml-auto size-4 text-muted-foreground transition-transform", aberto && "rotate-180")} />
      </button>
      <div
        id={idCorpo}
        role="group"
        aria-label="Filtros do painel"
        className={cn("grid-cols-1 gap-2 pt-2 md:grid md:grid-cols-2 md:pt-0 xl:grid-cols-3", aberto ? "grid" : "hidden")}
      >
        {NOMES_FILTRO_DIABETES.map((campo) => (
          <SlicerDiabetes key={campo} campo={campo} variante="compacto" />
        ))}
      </div>
    </div>
  );
}
