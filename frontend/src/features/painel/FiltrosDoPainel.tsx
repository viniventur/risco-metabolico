import { ChevronDown, SlidersHorizontal } from "lucide-react";
import { useId, useState } from "react";

import { NOMES_FILTRO } from "@/shared/filtros/filtroSchema";
import { Slicer } from "@/shared/filtros/Slicer";
import { useFiltros } from "@/shared/filtros/useFiltros";
import { cn } from "@/shared/lib/utils";
import { Badge } from "@/shared/ui/badge";

/**
 * Os 6 filtros da Visão Geral em dropdowns de multi-seleção, numa faixa só, acima de tudo o que eles
 * comandam. É o caminho explícito para filtrar; o clique nos visuais continua valendo, e os dois
 * escrevem a mesma URL — o dropdown mostra o que o clique marcou, e vice-versa. No desktop a faixa
 * fica presa logo abaixo da barra do topo (h-14): dá para filtrar sem rolar de volta. Abaixo de
 * 768 px ela abre recolhida, com a contagem de filtros ativos no botão (como na Consulta).
 */
export function FiltrosDoPainel() {
  const { filtros } = useFiltros();
  const [aberto, setAberto] = useState(false);
  const idCorpo = useId();
  const ativos = NOMES_FILTRO.reduce((n, nome) => n + filtros[nome].length, 0);
  return (
    <div className="nao-imprimir z-20 rounded-lg border bg-card/90 p-2 shadow-sm backdrop-blur supports-[backdrop-filter]:bg-card/75 lg:sticky lg:top-[4.25rem]">
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
        className={cn("grid-cols-1 gap-2 pt-2 sm:grid-cols-2 md:grid md:grid-cols-3 md:pt-0 xl:grid-cols-6", aberto ? "grid" : "hidden")}
      >
        {NOMES_FILTRO.map((campo) => (
          <Slicer key={campo} campo={campo} variante="compacto" />
        ))}
      </div>
    </div>
  );
}
