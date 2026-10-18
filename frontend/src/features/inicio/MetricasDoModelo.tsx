import { useModelInfo } from "@/shared/api/endpoints/modelo";
import { fmtPct } from "@/shared/format/ptBR";
import { NumeroQueConta } from "@/shared/movimento/NumeroQueConta";
import { Revelar } from "@/shared/movimento/Revelar";
import { useApareceuNaTela } from "@/shared/movimento/useApareceuNaTela";
import { Skeleton } from "@/shared/ui/skeleton";

import { seguirOPonteiro } from "./seguirOPonteiro";
import { Velocimetro } from "./Velocimetro";

const METRICAS = [
  { chave: "acuracia", rotulo: "Acurácia", detalhe: "no conjunto de teste" },
  { chave: "f1_macro", rotulo: "F1-macro", detalhe: "média entre as 7 classes" },
  { chave: "recall_risco", rotulo: "Recall de risco", detalhe: "classes de sobrepeso e obesidade" },
] as const;

/**
 * As três métricas do modelo em teste, lidas de GET /model/info (nenhuma escrita no front). Quando a
 * faixa chega à tela, cada número conta de 0 até o valor e o ponteiro do velocímetro ao lado sobe junto.
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
      className="cartao-holofote @container h-full rounded-xl border bg-card p-5 text-card-foreground shadow-sm transition-[translate,box-shadow] duration-300 hover:-translate-y-0.5 hover:shadow-md motion-reduce:transition-none"
    >
      {/* Lado a lado quando o cartão tem largura (16rem de conteúdo); nos três cartões espremidos entre
          640 e 1279 px, o velocímetro desce para baixo do texto em vez de esmagar o número. */}
      <div className="flex h-full flex-col gap-3 @3xs:flex-row @3xs:items-center @3xs:justify-between @3xs:gap-4">
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
        <Velocimetro fracao={valor} ativo={apareceu && !carregando} className="self-center" />
      </div>
    </div>
  );
}
