import { describe, expect, it } from "vitest";

import type { AgregadoDiabetes, FatoresDiabetes } from "../api/tipos";
import {
  linhasDePrevalencia,
  montarGruposDeFatores,
  montarPiramide,
  rotuloCurtoDaFaixaEtaria,
  tetoDaPrevalencia,
  ticksDaPrevalencia,
} from "./prevalencia";

const AMOSTRA_MINIMA = 15;

/** As quatro medidas de um grupo, como `_linhas_do_grupo` do backend as monta (prevalência suprimida abaixo da amostra mínima). */
function medidas(dims: Record<string, string>, n: number, k: number, total: number) {
  const suprimido = n < AMOSTRA_MINIMA;
  return [
    { ...dims, medida: "contagem", valor: n, n, suprimido: false },
    { ...dims, medida: "pct", valor: total ? (100 * n) / total : null, n, suprimido: false },
    { ...dims, medida: "n_diabetes", valor: k, n: k, suprimido: false },
    { ...dims, medida: "prevalencia", valor: suprimido ? null : (100 * k) / n, n, suprimido },
  ];
}

const numerar = (linhas: Record<string, unknown>[]) => linhas.map((l, i) => ({ ordem: i + 1, ...l }));

function agregado(campo: string, rotulo: string, grupos: Array<[string, string, number, number]>): AgregadoDiabetes {
  const total = grupos.reduce((s, [, , n]) => s + n, 0);
  return {
    campo,
    serie: null,
    dimensoes: [{ nome: campo, tipo: "texto" }],
    medidas: [],
    amostra_minima: AMOSTRA_MINIMA,
    total_filtrado: total,
    total_global: total,
    recorte: {},
    campos: [{ campo, rotulo, valores: grupos.map(([valor, r]) => ({ valor, rotulo: r })) }],
    linhas: numerar(grupos.flatMap(([valor, , n, k]) => medidas({ [campo]: valor }, n, k, total))),
  };
}

const IDADE = agregado("faixa_etaria", "Faixa etária", [
  ["1", "18 a 24 anos", 200, 4],
  ["2", "25 a 29 anos", 10, 1],
  ["13", "80 anos ou mais", 400, 80],
]);

describe("linhasDePrevalencia", () => {
  it("uma linha por grupo, na ordem do domínio, com o rótulo de `campos` e a prevalência do servidor", () => {
    const linhas = linhasDePrevalencia(IDADE);
    expect(linhas.map((l) => l.rotulo)).toEqual(["18 a 24 anos", "25 a 29 anos", "80 anos ou mais"]);
    expect(linhas[0]).toMatchObject({ valor: "1", contagem: 200, nDiabetes: 4, prevalencia: 2, suprimido: false });
    expect(linhas[2]?.prevalencia).toBe(20);
  });

  it("o grupo abaixo da amostra mínima fica no eixo, sem %", () => {
    expect(linhasDePrevalencia(IDADE)[1]).toMatchObject({ valor: "2", contagem: 10, prevalencia: null, suprimido: true });
  });

  it("a prevalência da base vem ao lado, grupo a grupo", () => {
    const recorte = agregado("faixa_etaria", "Faixa etária", [
      ["1", "18 a 24 anos", 100, 5],
      ["2", "25 a 29 anos", 0, 0],
      ["13", "80 anos ou mais", 50, 20],
    ]);
    const linhas = linhasDePrevalencia(recorte, IDADE);
    expect(linhas.map((l) => [l.prevalencia, l.prevalenciaBase])).toEqual([
      [5, 2],
      [null, null],
      [40, 20],
    ]);
    expect(linhasDePrevalencia(undefined)).toEqual([]);
  });
});

describe("eixo e rótulos", () => {
  it("o teto é o maior % entre a base e o recorte, arredondado para cima, e nunca passa de 100%", () => {
    expect(tetoDaPrevalencia([{ prevalencia: 21.85 }], [{ prevalencia: null }, { prevalencia: 12 }])).toBe(30);
    expect(tetoDaPrevalencia([{ prevalencia: 21.85 }], [{ prevalencia: 38.2 }])).toBe(50);
    expect(tetoDaPrevalencia([{ prevalencia: 97 }])).toBe(100);
  });

  it("os ticks do eixo são redondos, em no máximo cinco intervalos", () => {
    expect(ticksDaPrevalencia(30)).toEqual([0, 10, 20, 30]);
    expect(ticksDaPrevalencia(50)).toEqual([0, 10, 20, 30, 40, 50]);
    expect(ticksDaPrevalencia(100)).toEqual([0, 20, 40, 60, 80, 100]);
    expect(ticksDaPrevalencia(9)).toEqual([0, 2, 4, 6, 8]);
  });

  it("encurta o rótulo da faixa etária da API para o eixo", () => {
    expect(rotuloCurtoDaFaixaEtaria("18 a 24 anos")).toBe("18–24");
    expect(rotuloCurtoDaFaixaEtaria("80 anos ou mais")).toBe("80+");
    expect(rotuloCurtoDaFaixaEtaria("Sobrepeso")).toBe("Sobrepeso");
  });
});

describe("montarPiramide", () => {
  const piramide: AgregadoDiabetes = {
    ...IDADE,
    serie: "sexo",
    campos: [IDADE.campos[0]!, { campo: "sexo", rotulo: "Sexo", valores: [{ valor: "Feminino", rotulo: "Feminino" }, { valor: "Masculino", rotulo: "Masculino" }] }],
    linhas: numerar([
      ...medidas({ faixa_etaria: "1", sexo: "Feminino" }, 100, 2, 300),
      ...medidas({ faixa_etaria: "1", sexo: "Masculino" }, 50, 1, 300),
      ...medidas({ faixa_etaria: "13", sexo: "Feminino" }, 100, 20, 300),
      ...medidas({ faixa_etaria: "13", sexo: "Masculino" }, 50, 15, 300),
    ]),
  };

  it("as faixas mais velhas em cima e cada sexo com o próprio %", () => {
    const { linhas } = montarPiramide(piramide);
    expect(linhas.map((l) => l.rotulo)).toEqual(["80 anos ou mais", "18 a 24 anos"]);
    expect(linhas[0]?.porSexo.Masculino).toMatchObject({ contagem: 50, nDiabetes: 15, prevalencia: 30 });
  });

  it("o total de cada sexo soma as contagens do servidor (não é a média dos %)", () => {
    const { sexos } = montarPiramide(piramide);
    expect(sexos.map((s) => [s.rotulo, s.contagem, s.nDiabetes, s.prevalencia])).toEqual([
      ["Feminino", 200, 22, 11],
      ["Masculino", 100, 16, 16],
    ]);
  });

  it("com filtro de idade, as faixas continuam todas no desenho, mas o total é só o das filtradas", () => {
    const { linhas, sexos } = montarPiramide(piramide, ["13"]);
    expect(linhas).toHaveLength(2);
    expect(sexos.map((s) => [s.contagem, s.nDiabetes, s.prevalencia])).toEqual([
      [100, 20, 20],
      [50, 15, 30],
    ]);
  });
});

describe("montarGruposDeFatores", () => {
  const campos = [
    { campo: "pressao_alta", rotulo: "Pressão alta", valores: [{ valor: "Não", rotulo: "Não" }, { valor: "Sim", rotulo: "Sim" }] },
    { campo: "saude_geral", rotulo: "Saúde geral, na própria avaliação", valores: [{ valor: "1", rotulo: "Excelente" }, { valor: "2", rotulo: "Muito boa" }] },
  ];
  const fatores: FatoresDiabetes = {
    dimensoes: [],
    medidas: [],
    amostra_minima: AMOSTRA_MINIMA,
    total_filtrado: 300,
    total_global: 300,
    recorte: {},
    campos,
    linhas: numerar([
      ...medidas({ fator: "pressao_alta", resposta: "Não" }, 200, 12, 300),
      ...medidas({ fator: "pressao_alta", resposta: "Sim" }, 100, 24, 300),
      ...medidas({ fator: "saude_geral", resposta: "1" }, 290, 29, 300),
      ...medidas({ fator: "saude_geral", resposta: "2" }, 10, 7, 300),
    ]),
  };

  it("os fatores na ordem de `campos`, com o rótulo de cada resposta e o fator que também é filtro", () => {
    const grupos = montarGruposDeFatores(fatores);
    expect(grupos.map((g) => [g.rotulo, g.filtro])).toEqual([
      ["Pressão alta", "pressao_alta"],
      ["Saúde geral, na própria avaliação", undefined],
    ]);
    expect(grupos[1]?.linhas.map((l) => l.rotulo)).toEqual(["Excelente", "Muito boa"]);
    expect(grupos[1]?.linhas[1]).toMatchObject({ suprimido: true, prevalencia: null });
  });

  it("o traço do conjunto é ponderado pelas respostas, não a média das linhas", () => {
    const [pressao, saude] = montarGruposDeFatores(fatores);
    expect(pressao?.media).toBe(12);
    // (29 + 7) / 300 = 12%, mesmo com a resposta pequena suprimida
    expect(saude?.media).toBe(12);
  });

  it("o fator filtrado usa a consulta sem o próprio filtro: as respostas todas continuam no gráfico", () => {
    const semFiltro = agregado("pressao_alta", "Pressão alta", [
      ["Não", "Não", 1000, 60],
      ["Sim", "Sim", 500, 120],
    ]);
    const [pressao] = montarGruposDeFatores(fatores, new Map([["pressao_alta", semFiltro]]));
    expect(pressao?.linhas.map((l) => [l.valor, l.contagem, l.prevalencia])).toEqual([
      ["Não", 1000, 6],
      ["Sim", 500, 24],
    ]);
    expect(pressao?.media).toBe(12);
    expect(montarGruposDeFatores(undefined)).toEqual([]);
  });
});
