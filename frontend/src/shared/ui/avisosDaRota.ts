import { projetoDaTela, type IdProjeto } from "@/shared/projetos";

/**
 * Qual frase de dados o rodapé de cada tela mostra (decisão D3). Cada vertente tem a sua, literal e
 * com portão: "fictícios" na obesidade, "respostas reais e anonimizadas" na diabetes. As telas de uma
 * vertente (shared/projetos) mostram só a dela; as telas comuns (Início, Estudos, Privacidade, a página
 * que não existe), as duas — elas falam das duas bases.
 */
export type AvisoDeDados = "ficticios" | "reais";

const AVISO_DO_PROJETO: Record<IdProjeto, AvisoDeDados> = { obesidade: "ficticios", diabetes: "reais" };

export function avisosDaRota(caminho: string): AvisoDeDados[] {
  const projeto = projetoDaTela(caminho);
  return projeto ? [AVISO_DO_PROJETO[projeto.id]] : ["ficticios", "reais"];
}
