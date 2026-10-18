import { Activity, ArrowRight, BookOpen, Calculator, LayoutDashboard, Table2, type LucideIcon } from "lucide-react";
import { Link } from "react-router-dom";

import { cn } from "@/shared/lib/utils";
import { Revelar } from "@/shared/movimento/Revelar";

import { seguirOPonteiro } from "./seguirOPonteiro";
import { CabecalhoDeSecao } from "./SobreOProjeto";

const ATALHOS: Array<{ para: string; titulo: string; texto: string; icone: LucideIcon }> = [
  { para: "/painel", titulo: "Visão Geral", texto: "Indicadores e sete visuais com filtros cruzados sobre a base.", icone: LayoutDashboard },
  { para: "/consulta", titulo: "Consulta", texto: "Seis filtros e a tabela de registros, com exportação do recorte.", icone: Table2 },
  { para: "/monitoramento", titulo: "Monitoramento", texto: "A deriva das entradas contra o treino, feature a feature, pelo PSI.", icone: Activity },
  {
    para: "/estudos/comparacao-de-modelos",
    titulo: "Notebook de comparação de modelos",
    texto: "Com o gráfico interativo e os dois A/B que fecharam as decisões de modelagem.",
    icone: BookOpen,
  },
];

const CLASSE_DO_CARTAO =
  "cartao-holofote group flex h-full flex-col gap-3 rounded-2xl border bg-card p-5 text-card-foreground shadow-sm transition-[translate,box-shadow] duration-300 " +
  "hover:-translate-y-1 hover:shadow-lg hover:shadow-primary/10 motion-reduce:transition-none";

/**
 * Por onde começar: o simulador em destaque (ocupa duas linhas e leva o feixe na borda) e as outras
 * telas ao lado. Cada cartão é um link inteiro, com o holofote que segue o ponteiro.
 */
export function Explorar() {
  return (
    <section aria-labelledby="explorar-titulo">
      <CabecalhoDeSecao id="explorar-titulo" sobretitulo="Explorar" titulo="Por onde começar" />
      <nav aria-label="Atalhos" className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <Revelar className="sm:col-span-2 lg:col-span-1 lg:row-span-2">
          <div className="borda-com-feixe h-full rounded-2xl">
            <Link
              to="/simulador"
              onPointerMove={seguirOPonteiro}
              className={cn(CLASSE_DO_CARTAO, "relative justify-between gap-6 overflow-hidden bg-gradient-to-br from-muted/80 via-card to-card p-6")}
            >
              <span className="flex size-12 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-lg shadow-primary/30 transition-transform duration-300 group-hover:scale-110 group-hover:-rotate-6 motion-reduce:transition-none">
                <Calculator aria-hidden="true" className="size-6" />
              </span>
              <span className="flex flex-col gap-2">
                <span className="text-xl font-semibold tracking-tight">Simulador de triagem</span>
                <span className="text-sm leading-relaxed text-muted-foreground">
                  Dezesseis respostas, sete probabilidades em ordem clínica, o risco acumulado e o relatório para baixar ou imprimir.
                </span>
              </span>
              <span className="inline-flex items-center gap-1.5 text-sm font-semibold text-primary">
                Abrir o simulador
                <ArrowRight aria-hidden="true" className="size-4 transition-transform duration-200 group-hover:translate-x-1 motion-reduce:transition-none" />
              </span>
            </Link>
          </div>
        </Revelar>
        {ATALHOS.map(({ para, titulo, texto, icone: Icone }, i) => (
          <Revelar key={para} ordem={(i % 2) + 1}>
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
