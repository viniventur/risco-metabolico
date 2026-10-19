import { Activity, BookOpen, Calculator, House, LayoutDashboard, Table2, type LucideIcon } from "lucide-react";

export type ItemDeNavegacao = {
  rotulo: string;
  para: string;
  icone: LucideIcon;
  /** só acende no caminho exato (o Início, que é prefixo de tudo) */
  exato?: boolean;
};

export type GrupoDeNavegacao = { titulo: string; itens: ItemDeNavegacao[] };

/**
 * As 7 rotas de §7.1 em três grupos: o que se explora sobre a base, o que se faz com o modelo e o
 * estudo que o sustenta. Mora fora do `Sidebar.tsx` para o componente exportar só componente. A
 * vertente diabetes (decisão D5) é um grupo próprio, antes dos estudos, com as mesmas quatro telas; a
 * Visão Geral dela é `exato`, porque /diabetes é prefixo das outras três.
 */
export const NAVEGACAO: GrupoDeNavegacao[] = [
  {
    titulo: "Painel",
    itens: [
      { rotulo: "Início", para: "/", icone: House, exato: true },
      { rotulo: "Visão Geral", para: "/painel", icone: LayoutDashboard },
      { rotulo: "Consulta", para: "/consulta", icone: Table2 },
    ],
  },
  {
    titulo: "Modelo",
    itens: [
      { rotulo: "Simulador", para: "/simulador", icone: Calculator },
      { rotulo: "Monitoramento", para: "/monitoramento", icone: Activity },
    ],
  },
  {
    titulo: "Diabetes",
    itens: [
      { rotulo: "Visão Geral", para: "/diabetes", icone: LayoutDashboard, exato: true },
      { rotulo: "Consulta", para: "/diabetes/consulta", icone: Table2 },
      { rotulo: "Simulador", para: "/diabetes/simulador", icone: Calculator },
      { rotulo: "Monitoramento", para: "/diabetes/monitoramento", icone: Activity },
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

/** O grupo e o item da rota atual, para a trilha da barra do topo. */
export function localDaRota(caminho: string): { grupo: string; item: string } | null {
  for (const grupo of NAVEGACAO) {
    for (const item of grupo.itens) {
      const casa = item.exato ? caminho === item.para : caminho === item.para || caminho.startsWith(`${item.para}/`);
      if (casa) return { grupo: grupo.titulo, item: item.rotulo };
    }
  }
  return FORA_DO_MENU[caminho] ?? null;
}
