import { pivotar, tetoDoEixo } from "@/shared/filtros/agregadoUtil";

import type { AgregadoDiabetes, CampoPainelDiabetes, FatoresDiabetes } from "../api/tipos";
import { NOMES_FILTRO_DIABETES, type NomeFiltroDiabetes } from "../filtros/filtroDiabetes";

// A conta de cada gráfico da Visão Geral da vertente, fora dos componentes: o teste (prevalencia.test.ts)
// exercita a ordem, a supressão, a base e as médias sem desenhar nada. Todo número sai das contagens do
// servidor (contagem, n_diabetes, prevalencia); os rótulos, de `campos`.

/** Um grupo (faixa etária, faixa de IMC, resposta de um fator) com o que os gráficos desenham. */
export type LinhaPrevalencia = {
  valor: string;
  rotulo: string;
  contagem: number;
  nDiabetes: number;
  /** % com diabetes no grupo (0 a 100); nula quando o grupo tem menos respostas que a amostra mínima */
  prevalencia: number | null;
  suprimido: boolean;
  /** % com diabetes do mesmo grupo na base inteira */
  prevalenciaBase: number | null;
};

const rotulosDe = (campo: CampoPainelDiabetes | undefined) => new Map((campo?.valores ?? []).map((v) => [v.valor, v.rotulo]));

/** A tabela longa de por-categoria vira uma linha por grupo, na ordem do domínio, com a prevalência da base ao lado. */
export function linhasDePrevalencia(recorte: AgregadoDiabetes | undefined, base?: AgregadoDiabetes): LinhaPrevalencia[] {
  const rotulos = rotulosDe(recorte?.campos[0]);
  const naBase = new Map(pivotar(base).map((l) => [l.categoria, l.valores.prevalencia ?? null]));
  return pivotar(recorte).map((l) => ({
    valor: l.categoria,
    rotulo: rotulos.get(l.categoria) ?? l.categoria,
    contagem: l.valores.contagem ?? 0,
    nDiabetes: l.valores.n_diabetes ?? 0,
    prevalencia: l.suprimido ? null : (l.valores.prevalencia ?? null),
    suprimido: l.suprimido,
    prevalenciaBase: naBase.get(l.categoria) ?? null,
  }));
}

/** O teto "redondo" do eixo de % com diabetes: o maior valor entre os recortes dados (a base e o atual), até 100%. */
export function tetoDaPrevalencia(...conjuntos: Array<Array<{ prevalencia: number | null }>>): number {
  let maior = 0;
  for (const linhas of conjuntos) for (const l of linhas) if (l.prevalencia !== null && l.prevalencia > maior) maior = l.prevalencia;
  return Math.min(100, tetoDoEixo(maior));
}

const PASSOS = [1, 2, 5, 10, 20, 25, 50];

/** Os ticks redondos do eixo de %, de 0 ao teto, em no máximo cinco intervalos (0, 10, 20, 30 num teto de 30). */
export function ticksDaPrevalencia(teto: number): number[] {
  const passo = PASSOS.find((p) => teto / p <= 5) ?? 50;
  const ticks: number[] = [];
  for (let v = 0; v <= teto + passo / 1000; v += passo) ticks.push(v);
  return ticks;
}

/** "18 a 24 anos" -> "18–24"; "80 anos ou mais" -> "80+": o rótulo da API encurtado para caber no eixo. */
export function rotuloCurtoDaFaixaEtaria(rotulo: string): string {
  const intervalo = /^(\d+) a (\d+) anos$/.exec(rotulo);
  if (intervalo) return `${intervalo[1]}–${intervalo[2]}`;
  const aberto = /^(\d+) anos ou mais$/.exec(rotulo);
  return aberto ? `${aberto[1]}+` : rotulo;
}

// ---- A pirâmide: faixa etária × sexo ----------------------------------------------------------------

export type CelulaPiramide = { contagem: number; nDiabetes: number; prevalencia: number | null; suprimido: boolean };
export type LinhaPiramide = { valor: string; rotulo: string; porSexo: Record<string, CelulaPiramide> };
export type TotalDoSexo = { valor: string; rotulo: string; contagem: number; nDiabetes: number; prevalencia: number | null };

const CELULA_VAZIA: CelulaPiramide = { contagem: 0, nDiabetes: 0, prevalencia: null, suprimido: true };

/**
 * A tabela longa faixa etária × sexo vira uma linha por faixa, das mais velhas para as mais novas (a
 * pirâmide cresce de baixo para cima), e o total de cada sexo no recorte — soma das contagens do
 * servidor, nunca uma média de porcentagens. A pirâmide chega sem o filtro de idade (as faixas fora
 * dele só esmaecem): `faixas` diz quais faixas o total soma, para ele ser o do recorte.
 */
export function montarPiramide(agregado: AgregadoDiabetes | undefined, faixas: readonly string[] = []): { linhas: LinhaPiramide[]; sexos: TotalDoSexo[] } {
  const rotulosFaixa = rotulosDe(agregado?.campos[0]);
  const sexos = agregado?.campos[1]?.valores ?? [];
  const porFaixa = new Map<string, LinhaPiramide>();
  for (const l of pivotar(agregado)) {
    if (l.serie === undefined) continue;
    const linha = porFaixa.get(l.categoria) ?? { valor: l.categoria, rotulo: rotulosFaixa.get(l.categoria) ?? l.categoria, porSexo: {} };
    linha.porSexo[l.serie] = {
      contagem: l.valores.contagem ?? 0,
      nDiabetes: l.valores.n_diabetes ?? 0,
      prevalencia: l.suprimido ? null : (l.valores.prevalencia ?? null),
      suprimido: l.suprimido,
    };
    porFaixa.set(l.categoria, linha);
  }
  const linhas = [...porFaixa.values()].reverse();
  const doRecorte = faixas.length > 0 ? linhas.filter((l) => faixas.includes(l.valor)) : linhas;
  const totais = sexos.map((s) => {
    const contagem = doRecorte.reduce((soma, l) => soma + (l.porSexo[s.valor]?.contagem ?? 0), 0);
    const nDiabetes = doRecorte.reduce((soma, l) => soma + (l.porSexo[s.valor]?.nDiabetes ?? 0), 0);
    return { valor: s.valor, rotulo: s.rotulo, contagem, nDiabetes, prevalencia: contagem > 0 ? (100 * nDiabetes) / contagem : null };
  });
  return { linhas, sexos: totais };
}

export function celulaDe(linha: LinhaPiramide, sexo: string): CelulaPiramide {
  return linha.porSexo[sexo] ?? CELULA_VAZIA;
}

// ---- Os fatores --------------------------------------------------------------------------------------

export type GrupoFatorDiabetes = {
  campo: string;
  rotulo: string;
  linhas: LinhaPrevalencia[];
  /** % com diabetes no conjunto do fator (soma dos casos ÷ soma das respostas), o traço de referência */
  media: number | null;
  /** quando o fator também é filtro da vertente, a linha filtra ao clicar */
  filtro?: NomeFiltroDiabetes;
};

const comoFiltro = (campo: string): NomeFiltroDiabetes | undefined => NOMES_FILTRO_DIABETES.find((n) => n === campo);

/**
 * Os 16 fatores de /diabetes/painel/fatores, na ordem de `campos`. O fator que também é filtro e está
 * filtrado vem de `semOProprioFiltro` (por-categoria sem o filtro dele): as respostas todas continuam
 * visíveis e a escolhida se destaca, como na origem de um cross-filter.
 */
export function montarGruposDeFatores(fatores: FatoresDiabetes | undefined, semOProprioFiltro: ReadonlyMap<string, AgregadoDiabetes> = new Map()): GrupoFatorDiabetes[] {
  if (!fatores) return [];
  const porFator = new Map<string, LinhaPrevalencia[]>();
  for (const l of pivotar({ campo: "fator", serie: "resposta", linhas: fatores.linhas })) {
    const lista = porFator.get(l.categoria) ?? [];
    lista.push({
      valor: l.serie ?? "",
      rotulo: l.serie ?? "",
      contagem: l.valores.contagem ?? 0,
      nDiabetes: l.valores.n_diabetes ?? 0,
      prevalencia: l.suprimido ? null : (l.valores.prevalencia ?? null),
      suprimido: l.suprimido,
      prevalenciaBase: null,
    });
    porFator.set(l.categoria, lista);
  }
  return fatores.campos.map((campo) => {
    const substituto = semOProprioFiltro.get(campo.campo);
    const rotulos = rotulosDe(campo);
    const linhas = (substituto ? linhasDePrevalencia(substituto) : (porFator.get(campo.campo) ?? [])).map((l) => ({ ...l, rotulo: rotulos.get(l.valor) ?? l.rotulo }));
    const respostas = linhas.reduce((s, l) => s + l.contagem, 0);
    const casos = linhas.reduce((s, l) => s + l.nDiabetes, 0);
    return { campo: campo.campo, rotulo: campo.rotulo, linhas, media: respostas > 0 ? (100 * casos) / respostas : null, filtro: comoFiltro(campo.campo) };
  });
}
