import { X } from "lucide-react";

import { NOMES_FILTRO_DIABETES } from "./filtroDiabetes";
import { rotuloDoValor, useCamposDiabetes } from "./useCamposDiabetes";
import { useFiltrosDiabetes } from "./useFiltrosDiabetes";

/**
 * Os filtros ativos da vertente como chips removíveis, embaixo do cabeçalho (o desenho de
 * shared/filtros/FiltrosAtivos): é o que diz por que o painel mostra menos respostas que a base.
 */
export function FiltrosAtivosDiabetes() {
  const { filtros, alternar, vazio } = useFiltrosDiabetes();
  const campos = useCamposDiabetes(NOMES_FILTRO_DIABETES);
  if (vazio) return null;
  return (
    <ul className="flex flex-wrap items-center gap-1.5" aria-label="Filtros ativos">
      {NOMES_FILTRO_DIABETES.flatMap((nome) =>
        filtros[nome].map((valor) => {
          const campo = campos.get(nome);
          const rotuloCampo = campo?.rotulo ?? nome;
          const texto = rotuloDoValor(campo, valor);
          return (
            <li key={`${nome}=${valor}`}>
              <button
                type="button"
                onClick={() => alternar(nome, valor)}
                aria-label={`Remover filtro ${rotuloCampo}: ${texto}`}
                className="alvo-toque inline-flex h-8 items-center gap-1.5 rounded-full border border-primary/30 bg-accent pr-2 pl-3 text-xs text-accent-foreground transition-colors hover:bg-primary/15"
              >
                <span className="text-muted-foreground">{rotuloCampo}:</span>
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
