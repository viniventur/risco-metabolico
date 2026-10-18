import { useEffect, useState } from "react";

import { useSaude } from "@/shared/api/endpoints/saude";
import { cn } from "@/shared/lib/utils";

/** Só depois disto a espera vira aviso: uma API saudável responde em milissegundos e não pisca nada. */
const ESPERA_ATE_AVISAR_MS = 1500;

/**
 * O estado da API num selo da barra do topo, no lugar da faixa que empurrava a página a cada carga
 * (redesenho, 1.11). Aquecimento no mount (GET /health); "Acordando o modelo…" continua visível como
 * estado de carregamento de um reinício ou deploy (ADR 0009). Só os avisos vão para a região viva.
 */
export function EstadoApi() {
  const saude = useSaude();
  const [demorou, setDemorou] = useState(false);
  useEffect(() => {
    const id = window.setTimeout(() => setDemorou(true), ESPERA_ATE_AVISAR_MS);
    return () => window.clearTimeout(id);
  }, []);

  const pronto = saude.isSuccess && saude.data.artefato_carregado;
  const estado = pronto ? "pronto" : saude.isError ? "fora" : demorou ? "acordando" : "esperando";
  const texto = { pronto: "Modelo pronto", fora: "API indisponível", acordando: "Acordando o modelo…", esperando: "" }[estado];
  const aviso = estado === "fora" || estado === "acordando" ? texto : "";

  return (
    <div className="flex items-center">
      <span aria-live="polite" className="sr-only">
        {aviso}
      </span>
      {estado === "esperando" ? null : (
        <span
          aria-hidden="true"
          title={estado === "fora" ? "A API não respondeu. Se o serviço estiver reiniciando, aguarde alguns segundos." : undefined}
          className={cn(
            "inline-flex h-7 items-center gap-2 rounded-full border px-2.5 text-xs font-medium",
            estado === "pronto" && "border-transparent text-muted-foreground",
            estado === "acordando" && "border-warning/40 bg-warning/10 text-foreground",
            estado === "fora" && "border-destructive/40 bg-destructive/10 text-foreground",
          )}
        >
          <span
            className={cn(
              "size-2 rounded-full",
              estado === "pronto" && "bg-success",
              estado === "acordando" && "animate-pulse bg-warning",
              estado === "fora" && "bg-destructive",
            )}
          />
          <span className={estado === "pronto" ? "hidden sm:inline" : undefined}>{texto}</span>
        </span>
      )}
    </div>
  );
}
