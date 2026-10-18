import { ArrowRight, BookOpen, Calculator, ExternalLink, LayoutDashboard, Table2, type LucideIcon } from "lucide-react";
import type { ReactNode } from "react";
import { Link } from "react-router-dom";

import { useModelInfo } from "@/shared/api/endpoints/modelo";
import { URL_DOCS } from "@/shared/api/http";
import { ErroInline } from "@/shared/estados/ErroInline";
import { fmtDataHora, fmtPct } from "@/shared/format/ptBR";
import { Badge } from "@/shared/ui/badge";
import { Button } from "@/shared/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/shared/ui/card";
import { KpiCard } from "@/shared/ui/KpiCard";
import { Skeleton } from "@/shared/ui/skeleton";

const PASSOS = [
  { numero: "16", texto: "respostas sobre medidas corporais e hábitos" },
  { numero: "1", texto: "modelo treinado e versionado, servido por API" },
  { numero: "7", texto: "probabilidades em ordem clínica e um risco acumulado" },
];

function Hero() {
  return (
    <section className="grid grid-cols-1 gap-8 lg:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)] lg:items-center">
      <div className="flex flex-col items-start gap-4">
        <Badge variant="outline" className="gap-1.5 text-muted-foreground">
          <span aria-hidden="true" className="size-1.5 rounded-full bg-warning" />
          Dados fictícios · triagem, não diagnóstico
        </Badge>
        <h1 className="text-3xl leading-tight font-semibold tracking-tight text-balance sm:text-4xl">Triagem Metabólica</h1>
        <p className="max-w-2xl text-base leading-relaxed text-muted-foreground">
          Dezesseis respostas sobre medidas corporais e hábitos viram, em milissegundos, a distribuição de probabilidade entre sete
          faixas de composição corporal e um risco metabólico acumulado. A saída ordena prioridade de atenção; ela não fecha diagnóstico.
        </p>
        <div className="flex flex-wrap gap-2 pt-1">
          <Button asChild>
            <Link to="/simulador">
              <Calculator aria-hidden="true" />
              Abrir o simulador
            </Link>
          </Button>
          <Button asChild variant="outline">
            <Link to="/painel">
              Explorar a visão geral
              <ArrowRight aria-hidden="true" />
            </Link>
          </Button>
        </div>
      </div>
      <ol className="flex flex-col gap-3 rounded-xl border bg-card p-5 shadow-sm" aria-label="Como funciona">
        {PASSOS.map((p, i) => (
          <li key={p.numero} className="flex items-center gap-4">
            <span className="flex size-12 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-xl font-semibold text-primary tabular-nums">
              {p.numero}
            </span>
            <span className="text-sm leading-snug">{p.texto}</span>
            {i < PASSOS.length - 1 ? <span className="sr-only">, depois</span> : null}
          </li>
        ))}
      </ol>
    </section>
  );
}

function CardsMetricas() {
  const info = useModelInfo();
  const m = info.data?.metricas_teste;
  return (
    <section aria-label="Métricas do modelo em teste" className="grid grid-cols-1 gap-4 sm:grid-cols-3">
      <KpiCard rotulo="Acurácia" valor={fmtPct(m?.acuracia)} carregando={info.isPending} detalhe="no conjunto de teste" />
      <KpiCard rotulo="F1-macro" valor={fmtPct(m?.f1_macro)} carregando={info.isPending} detalhe="média entre as 7 classes" />
      <KpiCard rotulo="Recall de risco" valor={fmtPct(m?.recall_risco)} carregando={info.isPending} detalhe="classes de sobrepeso e obesidade" />
    </section>
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

function CardModelo() {
  const info = useModelInfo();
  const d = info.data;
  const hp = d?.hiperparametros ?? {};
  const chaves = ["n_estimators", "max_depth", "learning_rate", "subsample", "colsample_bytree"].filter((k) => k in hp);
  return (
    <Card>
      <CardHeader className="flex-row items-start justify-between gap-4">
        <div className="flex flex-col gap-1">
          <CardTitle>Modelo servido</CardTitle>
          <CardDescription>
            Lido de <code className="rounded bg-muted px-1 py-0.5 font-mono text-[12px]">GET /model/info</code>, que lê o manifest do treino — nenhum
            número desta página é escrito à mão.
          </CardDescription>
        </div>
        <Button asChild variant="ghost" size="sm" className="shrink-0 text-muted-foreground">
          <a href={URL_DOCS} target="_blank" rel="noreferrer">
            Documentação da API
            <ExternalLink aria-hidden="true" />
          </a>
        </Button>
      </CardHeader>
      <CardContent>
        {info.isError ? (
          <ErroInline erro={info.error} titulo="Não foi possível ler o manifest do modelo" aoTentarNovamente={() => void info.refetch()} />
        ) : !d ? (
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
            {Array.from({ length: 4 }, (_, i) => (
              <Skeleton key={i} className="h-10" />
            ))}
          </div>
        ) : (
          <div className="flex flex-col gap-5">
            <dl className="grid grid-cols-2 gap-x-6 gap-y-4 lg:grid-cols-5">
              <Par rotulo="Algoritmo">{d.algoritmo}</Par>
              <Par rotulo="Versão">v{d.versao}</Par>
              <Par rotulo="Treinado em">{fmtDataHora(d.treinado_em)}</Par>
              <Par rotulo="Features">
                {d.n_features_entrada} de entrada → {d.n_features_modelo} no modelo
              </Par>
              <Par rotulo="Dados (versão)" mono>
                {d.versao_dados}
              </Par>
            </dl>
            {chaves.length ? (
              <div className="flex flex-col gap-2">
                <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">Hiperparâmetros</p>
                <ul className="flex flex-wrap gap-1.5">
                  {chaves.map((k) => (
                    <li key={k}>
                      <Badge variant="secondary" className="font-mono text-[12px] font-normal">
                        {k}={String(hp[k])}
                      </Badge>
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

const CARTOES: Array<{ para: string; titulo: string; texto: string; Icone: LucideIcon }> = [
  { para: "/painel", titulo: "Visão Geral", texto: "Indicadores e sete visuais com filtros cruzados sobre a base.", Icone: LayoutDashboard },
  { para: "/consulta", titulo: "Consulta", texto: "Seis filtros e a tabela de registros, com exportação do recorte.", Icone: Table2 },
  { para: "/simulador", titulo: "Simulador", texto: "Dezesseis respostas, sete probabilidades e o relatório.", Icone: Calculator },
];

const CLASSE_DO_CARTAO =
  "group flex h-full flex-col gap-3 rounded-lg border bg-card p-5 shadow-sm transition-colors hover:border-primary/40 hover:bg-accent/40";

function CartoesNavegacao() {
  return (
    <nav aria-label="Atalhos" className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {CARTOES.map(({ para, titulo, texto, Icone }) => (
        <Link key={para} to={para} aria-label={`Abrir ${titulo}`} className={CLASSE_DO_CARTAO}>
          <span className="flex size-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <Icone aria-hidden="true" className="size-5" />
          </span>
          <span className="flex items-center gap-1.5 text-[15px] font-semibold">
            {titulo}
            <ArrowRight aria-hidden="true" className="size-4 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
          </span>
          <span className="text-sm text-muted-foreground">{texto}</span>
        </Link>
      ))}
      <Link to="/estudos/comparacao-de-modelos" className={CLASSE_DO_CARTAO}>
        <span className="flex size-10 items-center justify-center rounded-lg bg-secondary text-foreground">
          <BookOpen aria-hidden="true" className="size-5" />
        </span>
        <span className="flex items-center gap-1.5 text-[15px] font-semibold">
          Ver o notebook de comparação de modelos
          <ArrowRight aria-hidden="true" className="size-4 shrink-0 text-muted-foreground" />
        </span>
        <span className="text-sm text-muted-foreground">Com o gráfico interativo e os dois A/B que fecharam as decisões de modelagem.</span>
      </Link>
    </nav>
  );
}

export function InicioPage() {
  return (
    <div className="flex flex-col gap-8">
      <Hero />
      <CardsMetricas />
      <CardModelo />
      <CartoesNavegacao />
    </div>
  );
}
