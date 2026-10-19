/**
 * Qual frase de dados o rodapé de cada tela mostra (decisão D3). Cada vertente tem a sua, literal e
 * com portão: "fictícios" na obesidade, "respostas reais e anonimizadas" na diabetes. As telas de uma
 * vertente mostram só a dela; as telas comuns (Início, Estudos, Privacidade, a página que não existe),
 * as duas — elas falam das duas bases.
 */
export type AvisoDeDados = "ficticios" | "reais";

const TELAS_DA_OBESIDADE = ["/painel", "/consulta", "/simulador", "/monitoramento"];
const TELAS_DA_DIABETES = "/diabetes";

const dentroDe = (caminho: string, tela: string) => caminho === tela || caminho.startsWith(`${tela}/`);

export function avisosDaRota(caminho: string): AvisoDeDados[] {
  if (dentroDe(caminho, TELAS_DA_DIABETES)) return ["reais"];
  if (TELAS_DA_OBESIDADE.some((tela) => dentroDe(caminho, tela))) return ["ficticios"];
  return ["ficticios", "reais"];
}
