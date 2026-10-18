import { useModelInfo } from "@/shared/api/endpoints/modelo";
import { fmtPct } from "@/shared/format/ptBR";
import { NumeroQueConta } from "@/shared/movimento/NumeroQueConta";
import { Revelar } from "@/shared/movimento/Revelar";
import { useApareceuNaTela } from "@/shared/movimento/useApareceuNaTela";
import { useContagem } from "@/shared/movimento/useContagem";
import { Skeleton } from "@/shared/ui/skeleton";

import { seguirOPonteiro } from "./seguirOPonteiro";

const METRICAS = [
  { chave: "acuracia", rotulo: "Acurácia", detalhe: "no conjunto de teste" },
  { chave: "f1_macro", rotulo: "F1-macro", detalhe: "média entre as 7 classes" },
  { chave: "recall_risco", rotulo: "Recall de risco", detalhe: "classes de sobrepeso e obesidade" },
] as const;

/**
 * As três métricas do modelo em teste, lidas de GET /model/info (nenhuma escrita no front). Quando a
 * faixa chega à tela, cada número conta de 0 até o valor e o anel ao lado enche junto.
 */
export function MetricasDoModelo() {
  const info = useModelInfo();
  const m = info.data?.metricas_teste;
  return (
    <section aria-label="Métricas do modelo em teste" className="grid grid-cols-1 gap-4 sm:grid-cols-3">
      {METRICAS.map((metrica, i) => (
        <Revelar key={metrica.chave} ordem={i}>
          <CartaoDaMetrica rotulo={metrica.rotulo} detalhe={metrica.detalhe} valor={m?.[metrica.chave]} carregando={info.isPending} />
        </Revelar>
      ))}
    </section>
  );
}

function CartaoDaMetrica({ rotulo, detalhe, valor, carregando }: { rotulo: string; detalhe: string; valor: number | undefined; carregando: boolean }) {
  const [ref, apareceu] = useApareceuNaTela<HTMLDivElement>();
  return (
    <div
      ref={ref}
      onPointerMove={seguirOPonteiro}
      aria-busy={carregando || undefined}
      className="cartao-holofote flex h-full items-center justify-between gap-4 rounded-xl border bg-card p-5 text-card-foreground shadow-sm transition-[translate,box-shadow] duration-300 hover:-translate-y-0.5 hover:shadow-md motion-reduce:transition-none"
    >
      <div className="flex min-w-0 flex-col gap-2">
        <span className="text-xs font-medium tracking-wide text-muted-foreground uppercase">{rotulo}</span>
        {carregando ? (
          <>
            <span className="sr-only">Carregando…</span>
            <Skeleton className="h-9 w-28" />
          </>
        ) : (
          <p className="text-3xl leading-none font-semibold tracking-tight">
            <NumeroQueConta valor={valor} formatar={fmtPct} ativo={apareceu} />
          </p>
        )}
        <span className="text-xs text-muted-foreground">{detalhe}</span>
      </div>
      <Anel fracao={valor} ativo={apareceu && !carregando} />
    </div>
  );
}

/** O anel que enche até a fração, no mesmo ritmo do número (desenho: o valor já está no texto ao lado). */
function Anel({ fracao, ativo }: { fracao: number | undefined; ativo: boolean }) {
  const atual = useContagem(fracao, ativo);
  return (
    <svg viewBox="0 0 64 64" className="size-16 shrink-0 -rotate-90" aria-hidden="true">
      <circle cx="32" cy="32" r="27" fill="none" strokeWidth="4" className="stroke-muted" />
      <circle
        cx="32"
        cy="32"
        r="27"
        fill="none"
        strokeWidth="4"
        strokeLinecap="round"
        pathLength={100}
        strokeDasharray="100"
        strokeDashoffset={100 - atual * 100}
        // Sem isto, o traço de comprimento zero com ponta redonda vira um ponto antes de a contagem começar.
        opacity={atual > 0 ? 1 : 0}
        className="stroke-primary"
      />
    </svg>
  );
}
