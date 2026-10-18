import { useState } from "react";

import { useMetadata } from "@/shared/api/endpoints/metadata";
import { usePrever } from "@/shared/api/endpoints/predicoes";
import type { EntradaTriagem, RespostaTriagem } from "@/shared/api/endpoints/tipos";
import { QueryState } from "@/shared/estados/QueryState";
import { PageHeader } from "@/shared/layout/PageHeader";
import { avisar } from "@/shared/ui/avisos";
import { Skeleton } from "@/shared/ui/skeleton";

import { textoDoErro } from "./textoDoErro";
import { FormularioTriagem } from "./FormularioTriagem";
import { ResultadoPredicao } from "./ResultadoPredicao";

const ID_RESULTADO = "resultado-da-triagem";

function EsqueletoFormulario() {
  return (
    <div className="flex flex-col gap-5 rounded-lg border bg-card p-6">
      <Skeleton className="h-16 w-full" />
      {Array.from({ length: 4 }, (_, i) => (
        <div key={i} className="grid grid-cols-2 gap-4">
          <Skeleton className="h-16" />
          <Skeleton className="h-16" />
        </div>
      ))}
    </div>
  );
}

/**
 * Simulador (§7.5): formulário à esquerda e resultado à direita, FIXO na rolagem a partir de 1280 px.
 * Abaixo disso o resultado vem depois do formulário, e a página rola até ele quando a resposta chega.
 */
export function SimuladorPage() {
  const metadata = useMetadata();
  const prever = usePrever();
  const [ultimaEntrada, setUltimaEntrada] = useState<EntradaTriagem | null>(null);
  const [nome, setNome] = useState("");

  function aoEnviar(entrada: EntradaTriagem) {
    setUltimaEntrada(entrada);
    prever.mutate(entrada, {
      onSuccess: () => {
        if (window.matchMedia?.("(max-width: 1279px)").matches) {
          document.getElementById(ID_RESULTADO)?.scrollIntoView({ behavior: "smooth", block: "start" });
        }
      },
      // A faixa fixa do formulário continua sendo o aviso (§6.8.3); o toast só reforça o 429.
      onError: (erro) => {
        if (erro.status === 429) avisar.alerta("Limite de predições", textoDoErro(erro));
      },
    });
  }

  const resposta: RespostaTriagem | undefined = prever.data;
  return (
    <>
      <PageHeader
        titulo="Simulador de triagem"
        descricao="Dezesseis respostas sobre medidas e hábitos viram a distribuição de probabilidade entre as sete classes e um risco acumulado. Triagem, não diagnóstico."
      />
      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,7fr)_minmax(0,5fr)] xl:items-start">
        <QueryState
          carregando={metadata.isPending}
          erro={metadata.error}
          aoTentarNovamente={() => void metadata.refetch()}
          esqueleto={<EsqueletoFormulario />}
        >
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
        <div id={ID_RESULTADO} className="scroll-mt-20 xl:sticky xl:top-20">
          <ResultadoPredicao resposta={resposta} entrada={ultimaEntrada} nome={nome} calculando={prever.isPending} />
        </div>
      </div>
    </>
  );
}
