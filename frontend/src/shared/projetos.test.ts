import { describe, expect, it } from "vitest";

import { NAVEGACAO } from "./layout/navegacao";
import { DIABETES, OBESIDADE, projetoDaRota, projetoDaTela, projetoDoNotebook } from "./projetos";

describe("o projeto de cada rota (ADR 0016)", () => {
  it("as quatro telas de cada projeto e o notebook dele são dele; o Início, os estudos e a Política, dos dois", () => {
    for (const tela of ["/painel", "/consulta", "/simulador", "/monitoramento", "/estudos/comparacao-de-modelos"]) expect(projetoDaRota(tela)).toBe(OBESIDADE);
    for (const tela of ["/diabetes", "/diabetes/consulta", "/diabetes/simulador", "/diabetes/monitoramento", "/estudos/triagem-de-diabetes"]) {
      expect(projetoDaRota(tela)).toBe(DIABETES);
    }
    for (const tela of ["/", "/estudos", "/privacidade", "/pagina-que-nao-existe", "/estudos/outro-notebook"]) expect(projetoDaRota(tela)).toBeNull();
    // um prefixo parecido não é o projeto
    expect(projetoDaRota("/diabetesx")).toBeNull();
    expect(projetoDaRota("/simuladores")).toBeNull();
  });

  it("o notebook é do projeto, mas não é uma tela dele: o rodapé dos estudos continua com as duas frases", () => {
    expect(projetoDoNotebook("comparacao-de-modelos")).toBe(OBESIDADE);
    expect(projetoDoNotebook("triagem-de-diabetes")).toBe(DIABETES);
    expect(projetoDaTela("/estudos/triagem-de-diabetes")).toBeNull();
  });

  it("o menu tem um bloco por projeto, com as mesmas quatro telas, e cada uma é do projeto do bloco", () => {
    const blocos = NAVEGACAO.filter((grupo) => grupo.projeto);
    expect(blocos.map((grupo) => grupo.titulo)).toEqual(["Obesidade", "Diabetes"]);
    for (const grupo of blocos) {
      expect(grupo.itens.map((item) => item.rotulo)).toEqual(["Visão Geral", "Consulta", "Simulador", "Monitoramento"]);
      for (const item of grupo.itens) expect(projetoDaTela(item.para)).toBe(grupo.projeto);
      expect(grupo.itens[0]?.para).toBe(grupo.projeto?.visaoGeral);
      expect(grupo.itens.map((item) => item.para)).toContain(grupo.projeto?.simulador);
    }
  });
});
