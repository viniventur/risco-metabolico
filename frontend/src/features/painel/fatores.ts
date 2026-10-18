import type { Agregado } from "@/shared/api/endpoints/tipos";
import { ORDEM_FREQUENCIA } from "@/shared/dominio";
import { pivotar } from "@/shared/filtros/agregadoUtil";
import type { NomeFiltro } from "@/shared/filtros/filtroSchema";

import { CLASSES_OBESIDADE } from "./niveis";

// Os fatores do gráfico "Fatores associados à obesidade" e a conta de cada linha, fora do componente
// para o teste (fatores.test.ts) exercitar a ordem, a supressão e a média sem desenhar nada.

/**
 * Abaixo deste n a composição de uma categoria não é desenhada: com 7 registros, um registro a mais
 * muda a barra em 14 pontos. É o mesmo n mínimo das médias de IMC (AMOSTRA_MINIMA, dominio/agregados.py).
 */
export const AMOSTRA_MINIMA = 15;

export type Fator = {
  /** a dimensão de /painel/por-categoria */
  campo: string;
  /** o título do grupo, como a pergunta do formulário: "Sim" e "Não" se leem sozinhos embaixo dele */
  pergunta: string;
  /** quando o fator também é filtro do painel, a linha filtra ao clicar */
  filtro?: NomeFiltro;
  /** a ordem de leitura das categorias (a do servidor é a do código de ponto, não a do sentido) */
  ordem: readonly string[];
};

export const FATORES: readonly Fator[] = [
  { campo: "historico_familiar", pergunta: "Histórico familiar de excesso de peso?", filtro: "historico_familiar", ordem: ["Sim", "Não"] },
  { campo: "caloricos", pergunta: "Come alimentos calóricos com frequência?", filtro: "caloricos", ordem: ["Sim", "Não"] },
  { campo: "atividade", pergunta: "Atividade física por semana", ordem: ["0", "1", "2", "3"] },
  { campo: "transporte", pergunta: "Meio de transporte habitual", ordem: ["Caminhada", "Bicicleta", "Moto", "Transporte Público", "Carro"] },
  { campo: "agua", pergunta: "Água por dia", filtro: "agua", ordem: ["1", "2", "3"] },
  { campo: "alcool", pergunta: "Bebida alcoólica", filtro: "alcool", ordem: ORDEM_FREQUENCIA },
];

export type LinhaFator = {
  valor: string;
  rotulo: string;
  n: number;
  suprimido: boolean;
  porNivel: Record<string, number>;
  /** fração da categoria nas 3 classes de obesidade */
  obesidade: number | null;
};

export type GrupoFator = { fator: Fator; linhas: LinhaFator[]; media: number | null };

function somaObesidade(porNivel: Record<string, number>): number {
  return CLASSES_OBESIDADE.reduce((s, c) => s + (porNivel[c] ?? 0), 0);
}

/** A tabela longa campo × nível vira uma linha por categoria, com a composição e a fração em obesidade. */
export function montarGrupo(fator: Fator, agregado: Agregado | undefined, rotulo: (campo: string, valor: string) => string): GrupoFator {
  const mapa = new Map<string, LinhaFator>();
  for (const l of pivotar(agregado)) {
    const linha = mapa.get(l.categoria) ?? { valor: l.categoria, rotulo: rotulo(fator.campo, l.categoria), n: 0, suprimido: false, porNivel: {}, obesidade: null };
    const contagem = l.valores.contagem ?? 0;
    if (l.serie) linha.porNivel[l.serie] = contagem;
    linha.n += contagem;
    mapa.set(l.categoria, linha);
  }
  const conhecidas = fator.ordem.filter((v) => mapa.has(v)).map((v) => mapa.get(v)!);
  const demais = [...mapa.values()].filter((l) => !fator.ordem.includes(l.valor));
  const linhas = [...conhecidas, ...demais].map((l) => ({
    ...l,
    suprimido: l.n < AMOSTRA_MINIMA,
    obesidade: l.n > 0 ? somaObesidade(l.porNivel) / l.n : null,
  }));
  const total = linhas.reduce((s, l) => s + l.n, 0);
  const media = total > 0 ? linhas.reduce((s, l) => s + somaObesidade(l.porNivel), 0) / total : null;
  return { fator, linhas, media };
}
