import "./inicio.css";

import { Code, ShieldCheck } from "lucide-react";
import { Link } from "react-router-dom";

import { ROTA_DA_PRIVACIDADE } from "@/features/legal/rota";
import { URL_REPO } from "@/shared/api/http";
import { CreditosDoAutor } from "@/shared/autor/CreditosDoAutor";
import { Revelar } from "@/shared/movimento/Revelar";
import { Button } from "@/shared/ui/button";

import { Explorar } from "./Explorar";
import { Heroi } from "./Heroi";
import { MetricasDoModelo } from "./MetricasDoModelo";
import { ModeloServido } from "./ModeloServido";
import { SobreOProjeto } from "./SobreOProjeto";

/**
 * O Início: o herói, as métricas do modelo contando até o valor, a visão geral do projeto (objetivo,
 * dados, entradas, métodos, validação, serviço, monitoramento, auditoria e limitações), o modelo
 * servido, os atalhos e a autoria. O movimento é todo da casa (inicio.css e shared/movimento) e some
 * com `prefers-reduced-motion`: o conteúdo já nasce no lugar e os números, no valor final.
 */
export function InicioPage() {
  return (
    <div className="mx-auto flex max-w-7xl flex-col gap-12">
      <div className="flex flex-col gap-4">
        <Heroi />
        <MetricasDoModelo />
      </div>
      <SobreOProjeto />
      <ModeloServido />
      <Explorar />
      <Autoria />
    </div>
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
