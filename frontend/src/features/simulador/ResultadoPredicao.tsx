import { Calculator, ChartColumn, Table2 } from "lucide-react";
import { useState } from "react";

import type { EntradaTriagem, RespostaTriagem } from "@/shared/api/endpoints/tipos";
import { EstadoVazio } from "@/shared/estados/EstadoVazio";
import { fmtImc, fmtMs, fmtPct } from "@/shared/format/ptBR";
import { cn } from "@/shared/lib/utils";
import { MACRO_FAIXA } from "@/shared/tema/useChartTheme";
import { Button } from "@/shared/ui/button";
import { Card } from "@/shared/ui/card";
import { Separator } from "@/shared/ui/separator";
import { Skeleton } from "@/shared/ui/skeleton";

import { AvisoExtrapolacao } from "./AvisoExtrapolacao";
import { BarrasProbabilidade } from "./BarrasProbabilidade";
import { BotoesRelatorio } from "./BotoesRelatorio";

const PONTO: Record<string, string> = {
  abaixo: "bg-faixa-abaixo",
  normal: "bg-faixa-normal",
  sobrepeso: "bg-faixa-sobrepeso",
  obesidade: "bg-faixa-obesidade",
};

/** Risco acumulado em {:.1f}% com cor condicional acima de 50% — no legado `cor_risco` era calculada e nunca usada. */
function KpiRisco({ risco }: { risco: number }) {
  const alto = risco > 0.5;
  return (
    <div className="flex flex-col gap-2">
      <span className="text-xs font-medium tracking-wide text-muted-foreground uppercase">Risco acumulado</span>
      <span className={cn("text-3xl leading-none font-semibold tabular-nums", alto ? "text-destructive" : "text-success")}>{fmtPct(risco)}</span>
      <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted" aria-hidden="true">
        <div className={cn("h-full rounded-full", alto ? "bg-destructive" : "bg-success")} style={{ width: `${Math.max(1, risco * 100)}%` }} />
      </div>
      <span className="text-xs text-muted-foreground">Sobrepeso I e II + Obesidade I, II e III</span>
    </div>
  );
}

function EsqueletoResultado() {
  return (
    <Card className="flex flex-col gap-5 p-5" aria-busy="true">
      <span className="sr-only">Calculando a probabilidade…</span>
      <div className="grid grid-cols-2 gap-5">
        <Skeleton className="h-16" />
        <Skeleton className="h-16" />
      </div>
      <div className="flex flex-col gap-3">
        {Array.from({ length: 7 }, (_, i) => (
          <Skeleton key={i} className="h-6" style={{ width: `${40 + ((i * 37) % 55)}%` }} />
        ))}
      </div>
    </Card>
  );
}

type Props = { resposta?: RespostaTriagem; entrada: EntradaTriagem | null; nome: string; calculando: boolean };

export function ResultadoPredicao({ resposta, entrada, nome, calculando }: Props) {
  const [tabela, setTabela] = useState(false);
  if (calculando && !resposta) return <EsqueletoResultado />;
  if (!resposta || !entrada) {
    return (
      <Card className="p-5">
        <EstadoVazio
          icone={<Calculator className="size-5" />}
          titulo="O resultado aparece aqui"
          descricao="Preencha as três seções do formulário e clique em Calcular probabilidade: a classe estimada, o risco acumulado e as sete probabilidades."
          className="border-none py-12"
        />
      </Card>
    );
  }
  const faixa = MACRO_FAIXA[resposta.classe_prevista];
  return (
    <Card className={cn("flex flex-col", calculando && "refetching")}>
      <section className="flex flex-col" aria-live="polite" aria-label="Resultado da triagem">
        <div className="flex flex-col gap-5 p-5">
          <div className="flex flex-col gap-1">
            <span className="text-xs font-medium tracking-wide text-muted-foreground uppercase">Classe estimada</span>
            {/* O resultado da previsão: o magenta da marca Visor (ADR 0011). O ponto ao lado é a cor da macro-faixa,
                a mesma da dispersão e da consulta. */}
            <p className="flex items-center gap-2.5 text-2xl leading-tight font-semibold tracking-tight text-previsao">
              <span aria-hidden="true" className={cn("size-3 shrink-0 rounded-full", faixa ? PONTO[faixa] : "bg-muted")} />
              {resposta.classe_prevista}
            </p>
          </div>
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
            <KpiRisco risco={resposta.risco_acumulado} />
            <div className="flex flex-col gap-2">
              <span className="text-xs font-medium tracking-wide text-muted-foreground uppercase">IMC</span>
              <span className="text-3xl leading-none font-semibold tabular-nums">{fmtImc(resposta.imc)}</span>
              <span className="text-xs text-muted-foreground">{resposta.faixa_imc}</span>
            </div>
          </div>
          <AvisoExtrapolacao campos={resposta.fora_do_dominio_treino} />
        </div>
        <Separator />
        <div className="flex flex-col gap-3 p-5">
          <div className="flex items-start justify-between gap-3">
            <h2 className="text-[15px] leading-tight font-semibold tracking-tight">Probabilidade por classe</h2>
            <Button variant="ghost" size="sm" onClick={() => setTabela((v) => !v)} aria-pressed={tabela} className="nao-imprimir text-muted-foreground">
              {tabela ? <ChartColumn aria-hidden="true" /> : <Table2 aria-hidden="true" />}
              {tabela ? "Ver gráfico" : "Ver dados"}
            </Button>
          </div>
          <BarrasProbabilidade resposta={resposta} mostrarTabela={tabela} />
        </div>
        <Separator />
        <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-3">
          <BotoesRelatorio entrada={entrada} nome={nome} />
          <p className="text-xs text-muted-foreground">
            modelo v{resposta.versao_modelo} · resposta em {fmtMs(resposta.latencia_ms)}
          </p>
        </div>
      </section>
    </Card>
  );
}
