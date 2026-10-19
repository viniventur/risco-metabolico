import { Calculator } from "lucide-react";

import { AvisoExtrapolacao } from "@/features/simulador/AvisoExtrapolacao";
import { classificarImc } from "@/shared/dominio";
import { EstadoVazio } from "@/shared/estados/EstadoVazio";
import { fmtImc, fmtMs, fmtPct } from "@/shared/format/ptBR";
import { cn } from "@/shared/lib/utils";
import { Card } from "@/shared/ui/card";
import { Separator } from "@/shared/ui/separator";
import { Skeleton } from "@/shared/ui/skeleton";

import type { EntradaDiabetes, RespostaDiabetes } from "../api/tipos";
import { BotoesRelatorioDiabetes } from "./BotoesRelatorioDiabetes";

/** Classe literal do ponto de cada macro-faixa do IMC (a mesma cor do cartão de IMC do simulador da obesidade). */
const PONTO: Record<string, string> = {
  abaixo: "bg-faixa-abaixo",
  normal: "bg-faixa-normal",
  sobrepeso: "bg-faixa-sobrepeso",
  obesidade: "bg-faixa-obesidade",
};

/** A leitura curta de cada classificação; a do relatório (dominio/relatorio.py) diz o mesmo. */
const LEITURA = {
  elevado: "No limiar ou acima dele: a triagem sugere conversar com um profissional de saúde sobre o exame de glicemia.",
  baixo: "Abaixo do limiar. Isso não descarta a diabetes: o limiar deixa de fora parte de quem tem a doença.",
};

/**
 * A probabilidade numa régua de 0 a 100%, com o traço do limiar: o leitor vê de que lado dele caiu. A
 * barra é o resultado da previsão — leva o magenta da marca (ADR 0011), como a barra da classe
 * estimada no simulador da obesidade.
 */
function ReguaDaProbabilidade({ probabilidade, limiar }: { probabilidade: number; limiar: number }) {
  return (
    <div aria-hidden="true" className="relative h-2.5 w-full rounded-full bg-muted">
      <div className="h-full rounded-full bg-previsao" style={{ width: `${Math.max(1, probabilidade * 100)}%` }} />
      <span className="absolute -top-1.5 -bottom-1.5 w-0.5 -translate-x-1/2 rounded-full bg-foreground" style={{ left: `${limiar * 100}%` }} />
    </div>
  );
}

function EsqueletoResultado() {
  return (
    <Card className="flex flex-col gap-5 p-5" aria-busy="true">
      <span className="sr-only">Calculando a probabilidade…</span>
      <Skeleton className="h-16 w-2/3" />
      <div className="grid grid-cols-2 gap-5">
        <Skeleton className="h-20" />
        <Skeleton className="h-20" />
      </div>
    </Card>
  );
}

type Props = { resposta?: RespostaDiabetes; entrada: EntradaDiabetes | null; nome: string; calculando: boolean };

/**
 * O resultado da triagem de diabetes (decisão D4): a classificação pelo limiar — o resultado da
 * previsão, em magenta — com a leitura curta, a probabilidade na régua com o traço do limiar, o IMC e
 * a faixa dele, o aviso dos valores fora da faixa da base e o relatório.
 */
export function ResultadoDiabetes({ resposta, entrada, nome, calculando }: Props) {
  if (calculando && !resposta) return <EsqueletoResultado />;
  if (!resposta || !entrada) {
    return (
      <Card className="p-5">
        <EstadoVazio
          icone={<Calculator className="size-5" />}
          titulo="O resultado aparece aqui"
          descricao="Preencha as três seções do formulário e clique em Calcular probabilidade: a classificação, a probabilidade com o limiar e a faixa do IMC."
          className="border-none py-12"
        />
      </Card>
    );
  }
  const faixa = classificarImc(resposta.imc);
  return (
    <Card className={cn("flex flex-col", calculando && "refetching")}>
      <section className="flex flex-col" aria-live="polite" aria-label="Resultado da triagem de diabetes">
        <div className="flex flex-col gap-5 p-5">
          <div className="flex flex-col gap-1">
            <span className="text-xs font-medium tracking-wide text-muted-foreground uppercase">Classificação</span>
            <p className="text-2xl leading-tight font-semibold tracking-tight text-previsao">{resposta.classificacao}</p>
            <p className="text-sm leading-snug text-muted-foreground">{resposta.risco_elevado ? LEITURA.elevado : LEITURA.baixo}</p>
          </div>
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
            <div className="flex flex-col gap-2">
              <span className="text-xs font-medium tracking-wide text-muted-foreground uppercase">Probabilidade estimada</span>
              <span className="text-3xl leading-none font-semibold">{fmtPct(resposta.probabilidade)}</span>
              <ReguaDaProbabilidade probabilidade={resposta.probabilidade} limiar={resposta.limiar} />
              <span className="text-xs leading-snug text-muted-foreground">
                Limiar de triagem: <span className="font-medium text-foreground tabular-nums">{fmtPct(resposta.limiar)}</span> (o traço). É a chance de já
                ter recebido o diagnóstico, na escala da base — não na da população.
              </span>
            </div>
            <div className="flex flex-col gap-2">
              <span className="text-xs font-medium tracking-wide text-muted-foreground uppercase">IMC</span>
              <span className="text-3xl leading-none font-semibold">{fmtImc(resposta.imc)}</span>
              <span className="inline-flex items-center gap-2 text-xs text-muted-foreground">
                <span aria-hidden="true" className={cn("size-2.5 shrink-0 rounded-full", PONTO[faixa.macro])} />
                {resposta.faixa_imc}
              </span>
            </div>
          </div>
          <AvisoExtrapolacao campos={resposta.fora_do_dominio_treino} />
        </div>
        <Separator />
        <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-3">
          <BotoesRelatorioDiabetes entrada={entrada} nome={nome} />
          <p className="text-xs text-muted-foreground">
            modelo v{resposta.versao_modelo} · resposta em {fmtMs(resposta.latencia_ms)}
          </p>
        </div>
      </section>
    </Card>
  );
}
