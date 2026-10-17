import { useState } from "react";

import { useMetadata } from "@/shared/api/endpoints/metadata";
import { usePrever } from "@/shared/api/endpoints/predicoes";
import type { EntradaTriagem, RespostaTriagem } from "@/shared/api/endpoints/tipos";
import { AVISO_REGISTRO_ANONIMO } from "@/shared/dominio";
import { QueryState } from "@/shared/ui/QueryState";
import { RodapeAviso } from "@/shared/ui/RodapeAviso";

import { FormularioTriagem } from "./FormularioTriagem";
import { ResultadoPredicao } from "./ResultadoPredicao";

export function SimuladorPage() {
  const metadata = useMetadata();
  const prever = usePrever();
  const [ultimaEntrada, setUltimaEntrada] = useState<EntradaTriagem | null>(null);
  const [nome, setNome] = useState("");

  function aoEnviar(entrada: EntradaTriagem) {
    setUltimaEntrada(entrada);
    prever.mutate(entrada);
  }

  const resposta: RespostaTriagem | undefined = prever.data;
  return (
    <div className="flex flex-col gap-4">
      <header className="flex flex-col gap-1">
        <h1 className="text-2xl font-bold">Simulador de triagem</h1>
        <RodapeAviso extra={AVISO_REGISTRO_ANONIMO} />
      </header>
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <QueryState carregando={metadata.isPending} erro={metadata.error}>
          {metadata.data ? (
            <FormularioTriagem
              metadata={metadata.data}
              nome={nome}
              aoMudarNome={setNome}
              aoEnviar={aoEnviar}
              enviando={prever.isPending}
              erro={prever.error}
            />
          ) : null}
        </QueryState>
        <ResultadoPredicao resposta={resposta} entrada={ultimaEntrada} nome={nome} />
      </div>
    </div>
  );
}
