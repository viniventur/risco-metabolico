import { ArrowRight, Calculator } from "lucide-react";
import type { ReactNode } from "react";
import { Link } from "react-router-dom";

import type { Projeto } from "@/shared/projetos";
import { Button } from "@/shared/ui/button";

import { Chip } from "./SobreOProjeto";

type Props = {
  projeto: Projeto;
  /** O id do h2, que dá nome à seção do projeto. */
  id: string;
  titulo: string;
  descricao: ReactNode;
  /** A versão do modelo, do /model/info do projeto; enquanto ela não chega, o selo dela não aparece. */
  versao?: string;
  /** O cartão ao lado: o "Como funciona" do projeto. */
  lado: ReactNode;
};

/**
 * O cabeçalho de um projeto no Início (ADR 0016): o ícone e "Projeto N · Nome", o título, o que o
 * modelo faz, a natureza da base e a versão do modelo, e os atalhos para o simulador e a visão geral
 * do projeto; ao lado, o "Como funciona" dele. Os dois projetos usam o mesmo cabeçalho, para que a
 * diferença entre eles fique no conteúdo, e não no desenho.
 */
export function CabecalhoDoProjeto({ projeto, id, titulo, descricao, versao, lado }: Props) {
  const Icone = projeto.icone;
  // Os botões dos dois projetos têm o mesmo texto: o leitor de tela ouve de qual projeto é cada um. O
  // espaço fica fora do span: dentro dele, o cálculo do nome acessível o descartaria.
  const doProjeto = <span className="sr-only">da {projeto.nome.toLowerCase()}</span>;
  return (
    <div className="grid grid-cols-1 gap-8 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)] lg:items-center">
      <div className="flex flex-col items-start gap-4">
        <div className="flex items-center gap-3">
          <span aria-hidden="true" className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-lg shadow-primary/20">
            <Icone className="size-5" />
          </span>
          <p className="flex flex-col leading-tight">
            <span className="text-xs font-semibold tracking-wider text-muted-foreground uppercase">Projeto {projeto.numero}</span>{" "}
            <span className="text-lg font-semibold tracking-tight">{projeto.nome}</span>
          </p>
        </div>
        <h2 id={id} className="text-2xl font-semibold tracking-tight text-balance sm:text-[1.75rem]">
          {titulo}
        </h2>
        <p className="max-w-2xl text-sm leading-relaxed text-muted-foreground sm:text-[15px]">{descricao}</p>
        <p className="flex flex-wrap gap-1.5">
          <Chip>{projeto.dados}</Chip>
          {versao ? <Chip>modelo v{versao}</Chip> : null}
        </p>
        <div className="flex flex-wrap gap-2.5 pt-1">
          <Button asChild>
            <Link to={projeto.simulador}>
              <Calculator aria-hidden="true" />
              Abrir o simulador{" "}
              {doProjeto}
            </Link>
          </Button>
          <Button asChild variant="outline" className="group/botao">
            <Link to={projeto.visaoGeral}>
              Explorar o painel{" "}
              {doProjeto}
              <ArrowRight aria-hidden="true" className="transition-transform duration-200 group-hover/botao:translate-x-1 motion-reduce:transition-none" />
            </Link>
          </Button>
        </div>
      </div>
      {lado}
    </div>
  );
}
