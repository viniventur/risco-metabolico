import { useState } from "react";

import { textoDoErro } from "@/features/simulador/textoDoErro";
import { QueryState } from "@/shared/estados/QueryState";
import { PageHeader } from "@/shared/layout/PageHeader";
import { avisar } from "@/shared/ui/avisos";
import { Skeleton } from "@/shared/ui/skeleton";

import { useMetadataDiabetes } from "../api/modelo";
import { usePreverDiabetes } from "../api/predicoes";
import type { EntradaDiabetes } from "../api/tipos";
import { FormularioDiabetes } from "./FormularioDiabetes";
import { ResultadoDiabetes } from "./ResultadoDiabetes";

const ID_RESULTADO = "resultado-da-triagem-de-diabetes";

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
 * O simulador da vertente (o desenho do simulador da obesidade): o formulário de /diabetes/metadata à
 * esquerda e o resultado à direita, FIXO na rolagem a partir de 1280 px. Abaixo disso o resultado vem
 * depois do formulário, e a página rola até ele quando a resposta chega.
 */
export function SimuladorDiabetesPage() {
  const metadata = useMetadataDiabetes();
  const prever = usePreverDiabetes();
  const [ultimaEntrada, setUltimaEntrada] = useState<EntradaDiabetes | null>(null);
  const [nome, setNome] = useState("");
  const respostas = metadata.data?.grupos.reduce((soma, g) => soma + g.campos.length, 0);

  function aoEnviar(entrada: EntradaDiabetes) {
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

  return (
    <>
      <PageHeader
        titulo="Simulador de triagem de diabetes"
        descricao={`${respostas ? `${respostas} respostas viram` : "As respostas viram"} a probabilidade de já ter recebido o diagnóstico de diabetes; o limiar do modelo a classifica em risco elevado ou baixo. Triagem, não diagnóstico.`}
      />
      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,7fr)_minmax(0,5fr)] xl:items-start">
        <QueryState
          carregando={metadata.isPending}
          erro={metadata.error}
          aoTentarNovamente={() => void metadata.refetch()}
          esqueleto={<EsqueletoFormulario />}
        >
          {metadata.data ? (
            <FormularioDiabetes
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
          <ResultadoDiabetes resposta={prever.data} entrada={ultimaEntrada} nome={nome} calculando={prever.isPending} />
        </div>
      </div>
    </>
  );
}
