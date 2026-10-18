import { X } from "lucide-react";

import { NOMES_FILTRO, ROTULO_FILTRO } from "./filtroSchema";
import { useFiltros } from "./useFiltros";
import { useRotulos } from "./useRotulos";

/**
 * Os filtros ativos como chips removíveis, embaixo do cabeçalho. É o que diz ao leitor por que o
 * painel mostra 272 e não 2.111 registros — antes, um clique numa barra filtrava tudo sem deixar
 * rastro visível além do contador.
 */
export function FiltrosAtivos() {
  const { filtros, alternar, vazio } = useFiltros();
  const rotulo = useRotulos();
  if (vazio) return null;
  return (
    <ul className="flex flex-wrap items-center gap-1.5" aria-label="Filtros ativos">
      {NOMES_FILTRO.flatMap((nome) =>
        filtros[nome].map((valor) => {
          const texto = rotulo(nome, valor);
          return (
            <li key={`${nome}=${valor}`}>
              <button
                type="button"
                onClick={() => alternar(nome, valor)}
                aria-label={`Remover filtro ${ROTULO_FILTRO[nome]}: ${texto}`}
                className="alvo-toque inline-flex h-8 items-center gap-1.5 rounded-full border border-primary/30 bg-accent pr-2 pl-3 text-xs text-accent-foreground transition-colors hover:bg-primary/15"
              >
                <span className="text-muted-foreground">{ROTULO_FILTRO[nome]}:</span>
                <span className="font-medium">{texto}</span>
                <X aria-hidden="true" className="size-3.5" />
              </button>
            </li>
          );
        }),
      )}
    </ul>
  );
}
