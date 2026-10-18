import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { FaixaIndisponivel } from "./FaixaIndisponivel";

describe("FaixaIndisponivel", () => {
  it("com o banco fora, mostra a faixa de aviso (nunca erro) com o motivo da API, uma vez só", () => {
    render(<FaixaIndisponivel disponivel={false} motivo="o banco não respondeu (estado: frio)" nAmostra={0} nMinimo={200} />);
    const faixa = screen.getByRole("status");
    expect(faixa).toHaveTextContent("Histórico de predições indisponível");
    expect(faixa).toHaveTextContent("o banco não respondeu (estado: frio)");
    expect(faixa.textContent?.split("não respondeu")).toHaveLength(2);
    expect(screen.queryByRole("alert")).toBeNull();
  });

  it("sem motivo, usa a frase padrão — sem citar hibernação, que não existe na VPS (ADR 0009)", () => {
    render(<FaixaIndisponivel disponivel={false} motivo={null} nAmostra={0} nMinimo={200} />);
    expect(screen.getByRole("status")).toHaveTextContent("o banco não respondeu");
    expect(screen.getByRole("status")).not.toHaveTextContent("hiberna");
  });

  it("abaixo do n mínimo, muda o texto e explica que é resultado, não falha", () => {
    render(<FaixaIndisponivel disponivel motivo={null} nAmostra={37} nMinimo={200} />);
    expect(screen.getByRole("status")).toHaveTextContent("Amostra insuficiente: 37 predições na janela, abaixo do mínimo de 200");
    expect(screen.getByRole("status")).toHaveTextContent("É um resultado, não uma falha");
  });

  it("com amostra suficiente, não renderiza nada", () => {
    const { container } = render(<FaixaIndisponivel disponivel motivo={null} nAmostra={250} nMinimo={200} />);
    expect(container).toBeEmptyDOMElement();
  });
});
