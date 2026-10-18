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
 * estudo que o sustenta. Mora fora do `Sidebar.tsx` para o componente exportar só componente.
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
    titulo: "Estudos",
    itens: [{ rotulo: "Estudos", para: "/estudos", icone: BookOpen }],
  },
];

/** O grupo e o item da rota atual, para a trilha da barra do topo. */
export function localDaRota(caminho: string): { grupo: string; item: string } | null {
  for (const grupo of NAVEGACAO) {
    for (const item of grupo.itens) {
      const casa = item.exato ? caminho === item.para : caminho === item.para || caminho.startsWith(`${item.para}/`);
      if (casa) return { grupo: grupo.titulo, item: item.rotulo };
    }
  }
  return null;
}
