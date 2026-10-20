import { Droplet, Weight, type LucideIcon } from "lucide-react";

/**
 * Os dois projetos do produto, lado a lado: a triagem de obesidade e a de diabetes, cada um com a sua
 * base, o seu modelo, as suas quatro telas e o seu notebook. É a fonte única de "que tela é de que
 * projeto": o menu, a trilha da barra do topo, o selo do cabeçalho de cada tela, os estudos e a frase
 * de dados do rodapé leem daqui. A identidade é o número, o nome e o ícone, sem cor nova: a marca
 * reserva a cor (ADR 0016).
 */
export type IdProjeto = "obesidade" | "diabetes";

export type Projeto = {
  id: IdProjeto;
  numero: number;
  nome: string;
  /** A natureza da base, como os blocos do Início a escrevem. */
  dados: string;
  /** A mesma, curta, para a linha de baixo do nome no menu. */
  dadosCurto: string;
  icone: LucideIcon;
  /** As telas do projeto: cada uma vale para ela e para os caminhos abaixo dela. */
  telas: readonly string[];
  /** A Visão Geral, a primeira tela do projeto. */
  visaoGeral: string;
  simulador: string;
  /** O slug do notebook do projeto em /estudos. */
  notebook: string;
};

export const OBESIDADE: Projeto = {
  id: "obesidade",
  numero: 1,
  nome: "Obesidade",
  dados: "dados fictícios",
  dadosCurto: "dados fictícios",
  icone: Weight,
  telas: ["/painel", "/consulta", "/simulador", "/monitoramento"],
  visaoGeral: "/painel",
  simulador: "/simulador",
  notebook: "comparacao-de-modelos",
};

export const DIABETES: Projeto = {
  id: "diabetes",
  numero: 2,
  nome: "Diabetes",
  dados: "dados reais e anonimizados",
  dadosCurto: "dados reais",
  icone: Droplet,
  telas: ["/diabetes"],
  visaoGeral: "/diabetes",
  simulador: "/diabetes/simulador",
  notebook: "triagem-de-diabetes",
};

export const PROJETOS: readonly Projeto[] = [OBESIDADE, DIABETES];

const dentroDe = (caminho: string, tela: string) => caminho === tela || caminho.startsWith(`${tela}/`);

/** O projeto de uma das telas dele (Visão Geral, Consulta, Simulador e Monitoramento); fora delas, nenhum. */
export function projetoDaTela(caminho: string): Projeto | null {
  return PROJETOS.find((projeto) => projeto.telas.some((tela) => dentroDe(caminho, tela))) ?? null;
}

/** O projeto de um notebook de /estudos, pelo slug. */
export function projetoDoNotebook(slug: string): Projeto | null {
  return PROJETOS.find((projeto) => projeto.notebook === slug) ?? null;
}

/** O projeto da rota: as telas dele e o notebook dele. O Início, a lista de estudos e a Política são dos dois. */
export function projetoDaRota(caminho: string): Projeto | null {
  return projetoDaTela(caminho) ?? (caminho.startsWith("/estudos/") ? projetoDoNotebook(caminho.slice("/estudos/".length)) : null);
}
