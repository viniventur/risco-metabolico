import { useState } from "react";

import type { EntradaTriagem, RespostaTriagem } from "@/shared/api/endpoints/tipos";
import { fmtImc, fmtMs, fmtPct } from "@/shared/format/ptBR";
import { IconeTabela } from "@/shared/ui/icones";

import { AvisoExtrapolacao } from "./AvisoExtrapolacao";
import { BarrasProbabilidade } from "./BarrasProbabilidade";
import { BotoesRelatorio } from "./BotoesRelatorio";

/** Risco acumulado em {:.1f}% com cor condicional acima de 50% — no legado `cor_risco` era calculada e nunca usada. */
function KpiRisco({ risco }: { risco: number }) {
  const alto = risco > 0.5;
  return (
    <div className={`cartao flex flex-col p-4 ${alto ? "border-perigo" : "border-sucesso"}`}>
      <span className="text-xs font-semibold uppercase tracking-wide text-texto-fraco">Risco acumulado</span>
      <span className={`text-3xl font-bold tabular-nums ${alto ? "text-perigo" : "text-sucesso"}`}>{fmtPct(risco)}</span>
      <span className="text-xs text-texto-fraco">Sobrepeso I/II + Obesidade I/II/III</span>
    </div>
  );
}

type Props = { resposta?: RespostaTriagem; entrada: EntradaTriagem | null; nome: string };

export function ResultadoPredicao({ resposta, entrada, nome }: Props) {
  const [tabela, setTabela] = useState(false);
  if (!resposta || !entrada) {
    return (
      <section className="cartao flex min-h-40 items-center justify-center p-4 text-sm text-texto-fraco" aria-live="polite">
        Preencha o formulário e calcule a probabilidade para ver o resultado aqui.
      </section>
    );
  }
  return (
    <section className="flex flex-col gap-3" aria-live="polite" aria-label="Resultado da triagem">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <div className="cartao flex flex-col p-4">
          <span className="text-xs font-semibold uppercase tracking-wide text-texto-fraco">Classe estimada</span>
          <span className="text-2xl font-bold">{resposta.classe_prevista}</span>
        </div>
        <KpiRisco risco={resposta.risco_acumulado} />
        <div className="cartao flex flex-col p-4">
          <span className="text-xs font-semibold uppercase tracking-wide text-texto-fraco">IMC</span>
          <span className="text-2xl font-bold tabular-nums">{fmtImc(resposta.imc)}</span>
          <span className="text-xs text-texto-fraco">{resposta.faixa_imc}</span>
        </div>
      </div>
      <AvisoExtrapolacao campos={resposta.fora_do_dominio_treino} />
      <div className="cartao flex flex-col gap-2 p-4">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-semibold">Distribuição de probabilidade por classe</h2>
          <button
            type="button"
            onClick={() => setTabela((v) => !v)}
            aria-pressed={tabela}
            className="nao-imprimir flex h-9 items-center gap-1 rounded-card border border-borda px-2 text-xs"
          >
            <IconeTabela width={16} height={16} /> {tabela ? "Ver gráfico" : "Ver dados"}
          </button>
        </div>
        <BarrasProbabilidade resposta={resposta} mostrarTabela={tabela} />
      </div>
      <BotoesRelatorio entrada={entrada} nome={nome} />
      <p className="text-xs text-texto-fraco">
        modelo v{resposta.versao_modelo} · resposta em {fmtMs(resposta.latencia_ms)}
      </p>
    </section>
  );
}
