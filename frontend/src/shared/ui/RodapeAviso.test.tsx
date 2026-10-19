import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { avisosDaRota } from "./avisosDaRota";
import { RodapeDaRota } from "./RodapeAviso";

const FICTICIOS = /Os dados exibidos são fictícios/;
const REAIS = /Os dados exibidos são respostas reais e anonimizadas de uma pesquisa pública de saúde dos Estados Unidos \(BRFSS 2015, CDC\)/;

describe("rodapé por rota (decisão D3)", () => {
  it("as telas de cada vertente mostram só a frase dela; as comuns, as duas", () => {
    for (const tela of ["/diabetes", "/diabetes/consulta", "/diabetes/simulador", "/diabetes/monitoramento"]) expect(avisosDaRota(tela)).toEqual(["reais"]);
    for (const tela of ["/painel", "/consulta", "/simulador", "/monitoramento"]) expect(avisosDaRota(tela)).toEqual(["ficticios"]);
    for (const tela of ["/", "/estudos", "/estudos/triagem-de-diabetes", "/privacidade", "/pagina-que-nao-existe"]) {
      expect(avisosDaRota(tela)).toEqual(["ficticios", "reais"]);
    }
    // um prefixo parecido não é a vertente
    expect(avisosDaRota("/diabetesx")).toEqual(["ficticios", "reais"]);
  });

  it("numa tela da diabetes, a frase de D3 aparece uma vez e a de dados fictícios não aparece", () => {
    render(<RodapeDaRota caminho="/diabetes/simulador" />);
    expect(screen.getAllByText(REAIS)).toHaveLength(1);
    expect(screen.queryByText(FICTICIOS)).toBeNull();
    expect(screen.getByRole("note")).toHaveTextContent("Nenhum registro identifica uma pessoa.");
  });

  it("numa tela da obesidade, só a frase de dados fictícios, como antes", () => {
    render(<RodapeDaRota caminho="/painel" />);
    expect(screen.getAllByText(FICTICIOS)).toHaveLength(1);
    expect(screen.queryByText(REAIS)).toBeNull();
  });

  it("no Início, as duas frases, cada uma uma vez", () => {
    render(<RodapeDaRota caminho="/" />);
    expect(screen.getAllByRole("note")).toHaveLength(2);
    expect(screen.getAllByText(FICTICIOS)).toHaveLength(1);
    expect(screen.getAllByText(REAIS)).toHaveLength(1);
  });
});
