import { Activity, BookOpen, Calculator, House, LayoutDashboard, Table2, type LucideIcon } from "lucide-react";

import { DIABETES, OBESIDADE, type Projeto } from "@/shared/projetos";

export type ItemDeNavegacao = {
  rotulo: string;
  para: string;
  icone: LucideIcon;
  /** só acende no caminho exato (o Início, que é prefixo de tudo) */
  exato?: boolean;
};

/** Um grupo do menu; o de um projeto traz o projeto, e o menu o desenha como um bloco próprio. */
export type GrupoDeNavegacao = { titulo: string; itens: ItemDeNavegacao[]; projeto?: Projeto };

/**
 * O menu em dois projetos (ADR 0016): o Início, que fala dos dois; um bloco por projeto, na ordem de
 * shared/projetos (a diabetes primeiro), com as mesmas quatro telas e os mesmos nomes; e os estudos, os
 * notebooks dos dois. Mora fora do `Sidebar.tsx` para o componente exportar só componente. A Visão
 * Geral da diabetes é `exato`, porque /diabetes é prefixo das outras três.
 */
export const NAVEGACAO: GrupoDeNavegacao[] = [
  {
    titulo: "Início",
    itens: [{ rotulo: "Início", para: "/", icone: House, exato: true }],
  },
  {
    titulo: DIABETES.nome,
    projeto: DIABETES,
    itens: [
      { rotulo: "Visão Geral", para: "/diabetes", icone: LayoutDashboard, exato: true },
      { rotulo: "Consulta", para: "/diabetes/consulta", icone: Table2 },
      { rotulo: "Simulador", para: "/diabetes/simulador", icone: Calculator },
      { rotulo: "Monitoramento", para: "/diabetes/monitoramento", icone: Activity },
    ],
  },
  {
    titulo: OBESIDADE.nome,
    projeto: OBESIDADE,
    itens: [
      { rotulo: "Visão Geral", para: "/painel", icone: LayoutDashboard },
      { rotulo: "Consulta", para: "/consulta", icone: Table2 },
      { rotulo: "Simulador", para: "/simulador", icone: Calculator },
      { rotulo: "Monitoramento", para: "/monitoramento", icone: Activity },
    ],
  },
  {
    titulo: "Estudos",
    itens: [{ rotulo: "Estudos", para: "/estudos", icone: BookOpen }],
  },
];

/** Telas que não estão no menu (o rodapé linka para elas), com a trilha que a barra do topo mostra. */
const FORA_DO_MENU: Record<string, { grupo: string; item: string }> = {
  "/privacidade": { grupo: "Sobre", item: "Política de Privacidade" },
};

/** O grupo, o item e o projeto da rota atual, para a trilha da barra do topo. */
export function localDaRota(caminho: string): { grupo: string; item: string; projeto?: Projeto } | null {
  for (const grupo of NAVEGACAO) {
    for (const item of grupo.itens) {
      const casa = item.exato ? caminho === item.para : caminho === item.para || caminho.startsWith(`${item.para}/`);
      if (casa) return { grupo: grupo.titulo, item: item.rotulo, projeto: grupo.projeto };
    }
  }
  return FORA_DO_MENU[caminho] ?? null;
}
