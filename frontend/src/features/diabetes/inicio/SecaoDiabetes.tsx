import { Activity, ArrowRight, BookOpen, Calculator, LayoutDashboard, Table2, type LucideIcon } from "lucide-react";
import type { ReactNode } from "react";
import { Link } from "react-router-dom";

import { CabecalhoDeSecao } from "@/features/inicio/SobreOProjeto";
import { seguirOPonteiro } from "@/features/inicio/seguirOPonteiro";
import { ErroInline } from "@/shared/estados/ErroInline";
import { fmtDataHora, fmtNum, fmtPct } from "@/shared/format/ptBR";
import { NumeroQueConta } from "@/shared/movimento/NumeroQueConta";
import { Revelar } from "@/shared/movimento/Revelar";
import { useApareceuNaTela } from "@/shared/movimento/useApareceuNaTela";
import { Skeleton } from "@/shared/ui/skeleton";

import { useModelInfoDiabetes } from "../api/modelo";
import type { InfoModeloDiabetes } from "../api/tipos";

type ChaveDaMetrica = keyof InfoModeloDiabetes["metricas_teste"];

/** As métricas do teste que dizem o que a triagem faz: a ordenação (ROC-AUC) e o ponto de operação no limiar. */
const METRICAS: Array<{ chave: ChaveDaMetrica; rotulo: string; detalhe: string; formatar: (v: number | null | undefined) => string }> = [
  { chave: "roc_auc", rotulo: "ROC-AUC", detalhe: "no conjunto de teste", formatar: (v) => fmtNum(v, 3) },
  { chave: "recall_no_limiar", rotulo: "Recall no limiar", detalhe: "dos casos de diabetes, os que o limiar encaminha", formatar: fmtPct },
  { chave: "precisao_no_limiar", rotulo: "Precisão no limiar", detalhe: "dos encaminhados, os que têm diabetes", formatar: fmtPct },
  { chave: "encaminhados_no_limiar", rotulo: "Encaminhados", detalhe: "das respostas, as que o limiar encaminha", formatar: fmtPct },
];

const TELAS: Array<{ para: string; titulo: string; texto: string; icone: LucideIcon }> = [
  { para: "/diabetes", titulo: "Visão Geral", texto: "O % com diabetes por idade, sexo, IMC e fatores associados, com filtros cruzados.", icone: LayoutDashboard },
  { para: "/diabetes/consulta", titulo: "Consulta", texto: "As respostas linha a linha, com a exportação do recorte inteiro.", icone: Table2 },
  { para: "/diabetes/simulador", titulo: "Simulador", texto: "A probabilidade, o limiar, a classificação e o relatório.", icone: Calculator },
  { para: "/diabetes/monitoramento", titulo: "Monitoramento", texto: "A deriva das entradas contra o treino, pelo PSI.", icone: Activity },
  {
    para: "/estudos/triagem-de-diabetes",
    titulo: "Notebook da triagem",
    texto: "O estudo: entradas, modelos, desbalanceamento, calibração e limiar.",
    icone: BookOpen,
  },
];

const CLASSE_DO_CARTAO =
  "cartao-holofote group flex h-full flex-col gap-3 rounded-2xl border bg-card p-5 text-card-foreground shadow-sm transition-[translate,box-shadow] duration-300 " +
  "hover:-translate-y-1 hover:shadow-lg hover:shadow-primary/10 motion-reduce:transition-none";

function Metrica({ rotulo, detalhe, valor, formatar, carregando }: { rotulo: string; detalhe: string; valor: number | undefined; formatar: (v: number | null | undefined) => string; carregando: boolean }) {
  const [ref, apareceu] = useApareceuNaTela<HTMLLIElement>();
  return (
    <li
      ref={ref}
      onPointerMove={seguirOPonteiro}
      aria-busy={carregando || undefined}
      className="cartao-holofote flex flex-col gap-2 rounded-xl border bg-card p-5 text-card-foreground shadow-sm transition-[translate,box-shadow] duration-300 hover:-translate-y-0.5 hover:shadow-md motion-reduce:transition-none"
    >
      <span className="text-xs font-medium tracking-wide text-muted-foreground uppercase">{rotulo}</span>
      {carregando ? (
        <>
          <span className="sr-only">Carregando…</span>
          <Skeleton className="h-9 w-24" />
        </>
      ) : (
        <p className="text-3xl leading-none font-semibold tracking-tight">
          <NumeroQueConta valor={valor} formatar={formatar} ativo={apareceu} />
        </p>
      )}
      <span className="text-xs leading-snug text-muted-foreground">{detalhe}</span>
    </li>
  );
}

function Par({ rotulo, children, mono }: { rotulo: string; children: ReactNode; mono?: boolean }) {
  return (
    <div className="flex min-w-0 flex-col gap-1">
      <dt className="text-xs font-medium tracking-wide text-muted-foreground uppercase">{rotulo}</dt>
      <dd className={mono ? "truncate font-mono text-[13px]" : "text-sm font-medium"}>{children}</dd>
    </div>
  );
}

/** O limiar com o critério e a validação cruzada, e o artefato da vertente: tudo do manifest, por /diabetes/model/info. */
function LimiarEModelo({ d }: { d: InfoModeloDiabetes }) {
  const cv = d.validacao_cruzada;
  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-col gap-1">
        <p className="text-sm text-muted-foreground">
          Limiar de triagem <strong className="text-2xl font-semibold text-foreground tabular-nums">{fmtPct(d.limiar.valor)}</strong>
        </p>
        <p className="text-sm leading-relaxed text-muted-foreground">
          O maior limiar com recall ≥ {fmtNum(d.limiar.recall_alvo, 2)} nas predições fora da dobra do treino. Na validação cruzada ({cv.n_splits} dobras), ROC-AUC{" "}
          <span className="font-medium text-foreground tabular-nums">{fmtNum(cv.roc_auc, 3)}</span> e PR-AUC{" "}
          <span className="font-medium text-foreground tabular-nums">{fmtNum(cv.pr_auc, 3)}</span>.
        </p>
      </div>
      <dl className="grid grid-cols-2 gap-x-6 gap-y-4 lg:grid-cols-5">
        <Par rotulo="Algoritmo">{d.algoritmo}</Par>
        <Par rotulo="Versão">v{d.versao}</Par>
        <Par rotulo="Release" mono>
          {d.release}
        </Par>
        <Par rotulo="Treinado em">{fmtDataHora(d.treinado_em)}</Par>
        <Par rotulo="Dados (versão)" mono>
          {d.versao_dados}
        </Par>
      </dl>
    </div>
  );
}

/**
 * A seção da vertente diabetes no Início: o que o modelo faz, as métricas do teste contando até o
 * valor, o limiar com o critério e o artefato, e as telas da vertente. Todo número vem de
 * /diabetes/model/info. Os atalhos ficam num menu próprio, ao lado do "Explorar" da obesidade.
 */
export function SecaoDiabetes() {
  const info = useModelInfoDiabetes();
  const d = info.data;
  return (
    <section aria-labelledby="diabetes-titulo" className="scroll-mt-20">
      <CabecalhoDeSecao
        id="diabetes-titulo"
        sobretitulo="Diabetes"
        titulo="Triagem de diabetes: o modelo em teste"
        descricao={`${d ? `${d.n_features_entrada} respostas viram` : "As respostas viram"} a probabilidade de já ter recebido o diagnóstico de diabetes; o limiar encaminha quem fica nele ou acima dele. A base é real e anonimizada: o BRFSS 2015, do CDC.`}
      />
      <ul aria-label="Desempenho da triagem de diabetes no teste" className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {METRICAS.map((m) => (
          <Metrica key={m.chave} rotulo={m.rotulo} detalhe={m.detalhe} valor={d?.metricas_teste[m.chave]} formatar={m.formatar} carregando={info.isPending} />
        ))}
      </ul>
      <Revelar className="mt-4">
        <div onPointerMove={seguirOPonteiro} className="cartao-holofote rounded-2xl border bg-card p-5 text-card-foreground shadow-sm sm:p-6">
          {info.isError ? (
            <ErroInline erro={info.error} titulo="Não foi possível ler o manifest da vertente" aoTentarNovamente={() => void info.refetch()} />
          ) : d ? (
            <LimiarEModelo d={d} />
          ) : (
            <div className="grid grid-cols-2 gap-4 lg:grid-cols-5">
              {Array.from({ length: 5 }, (_, i) => (
                <Skeleton key={i} className="h-10" />
              ))}
            </div>
          )}
        </div>
      </Revelar>
      <nav aria-label="Telas da vertente diabetes" className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-5">
        {TELAS.map(({ para, titulo, texto, icone: Icone }, i) => (
          <Revelar key={para} ordem={i % 3}>
            <Link to={para} onPointerMove={seguirOPonteiro} className={CLASSE_DO_CARTAO}>
              <span className="flex size-10 items-center justify-center rounded-xl bg-gradient-to-br from-primary/20 to-primary/5 text-primary ring-1 ring-primary/15 ring-inset transition-transform duration-300 group-hover:scale-110 group-hover:-rotate-6 motion-reduce:transition-none">
                <Icone aria-hidden="true" className="size-5" />
              </span>
              <span className="flex items-start justify-between gap-2 text-[15px] font-semibold">
                {titulo}
                <ArrowRight aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-muted-foreground transition-transform duration-200 group-hover:translate-x-1 group-hover:text-primary motion-reduce:transition-none" />
              </span>
              <span className="text-sm text-muted-foreground">{texto}</span>
            </Link>
          </Revelar>
        ))}
      </nav>
    </section>
  );
}
