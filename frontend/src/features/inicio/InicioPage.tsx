import "./inicio.css";

import { Code, ShieldCheck } from "lucide-react";
import type { ReactNode } from "react";
import { Link } from "react-router-dom";

import { SecaoDiabetes } from "@/features/diabetes/inicio/SecaoDiabetes";
import { SobreADiabetes } from "@/features/diabetes/inicio/SobreADiabetes";
import { ROTA_DA_PRIVACIDADE } from "@/features/legal/rota";
import { URL_REPO } from "@/shared/api/http";
import { CreditosDoAutor } from "@/shared/autor/CreditosDoAutor";
import { Revelar } from "@/shared/movimento/Revelar";
import { DIABETES, OBESIDADE, type Projeto } from "@/shared/projetos";
import { Button } from "@/shared/ui/button";

import { CabecalhoObesidade } from "./CabecalhoObesidade";
import { Explorar } from "./Explorar";
import { Heroi } from "./Heroi";
import { MetricasDoModelo } from "./MetricasDoModelo";
import { ModeloServido } from "./ModeloServido";
import { SobreOProjeto } from "./SobreOProjeto";

/**
 * O Início em dois projetos (ADR 0016): o herói, que apresenta os dois, e um bloco para cada um, com
 * tudo o que é dele, na ordem de shared/projetos (a diabetes primeiro). A diabetes
 * (features/diabetes/inicio): o cabeçalho com "como funciona", as métricas com o velocímetro, o limiar
 * e o artefato, as telas, os dados e os limites. A obesidade: o cabeçalho, as métricas contando até o
 * valor, o modelo servido, os atalhos e a visão geral do projeto (objetivo, dados, entradas, métodos,
 * validação, serviço, monitoramento, auditoria e limitações). No fim, a autoria. O movimento é todo da
 * casa (inicio.css e shared/movimento) e some com `prefers-reduced-motion`: o conteúdo já nasce no
 * lugar e os números, no valor final.
 */
export function InicioPage() {
  return (
    <div className="mx-auto flex max-w-7xl flex-col gap-12">
      <Heroi />
      <BlocoDoProjeto projeto={DIABETES}>
        <SecaoDiabetes />
        <SobreADiabetes />
      </BlocoDoProjeto>
      <BlocoDoProjeto projeto={OBESIDADE}>
        <div className="flex flex-col gap-8">
          <CabecalhoObesidade />
          <MetricasDoModelo />
        </div>
        <ModeloServido />
        <Explorar />
        <SobreOProjeto />
      </BlocoDoProjeto>
      <Autoria />
    </div>
  );
}

/**
 * O bloco de um projeto: uma região com o nome dele ("Projeto 1: Obesidade"), num painel com borda e
 * fundo próprios, para que a fronteira entre os dois projetos se veja de longe. O id é a âncora dos
 * cartões do herói.
 */
function BlocoDoProjeto({ projeto, children }: { projeto: Projeto; children: ReactNode }) {
  return (
    <section
      id={`projeto-${projeto.id}`}
      aria-label={`Projeto ${projeto.numero}: ${projeto.nome}`}
      className="flex scroll-mt-20 flex-col gap-12 rounded-3xl border bg-muted/30 p-4 sm:p-6 lg:p-8"
    >
      {children}
    </section>
  );
}

function Autoria() {
  return (
    <Revelar as="section" className="flex flex-col gap-4 rounded-2xl border bg-gradient-to-br from-muted/60 via-card to-card p-6 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex flex-col gap-2">
        <h2 className="text-base font-semibold tracking-tight">Quem fez</h2>
        <p className="max-w-xl text-sm text-muted-foreground">Projeto de portfólio, com código aberto sob licença MIT. O autor e os outros projetos estão no site.</p>
        <CreditosDoAutor className="mt-1 text-foreground" />
      </div>
      <div className="flex flex-wrap gap-2">
        {URL_REPO ? (
          <Button asChild variant="outline">
            <a href={URL_REPO} target="_blank" rel="noreferrer">
              <Code aria-hidden="true" />
              Código-fonte
            </a>
          </Button>
        ) : null}
        <Button asChild variant="ghost" className="text-muted-foreground">
          <Link to={ROTA_DA_PRIVACIDADE}>
            <ShieldCheck aria-hidden="true" />
            Política de Privacidade
          </Link>
        </Button>
      </div>
    </Revelar>
  );
}
