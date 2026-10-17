import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { FaixaIndisponivel } from "./FaixaIndisponivel";

describe("FaixaIndisponivel", () => {
  it("com o banco fora, mostra a faixa de aviso (nunca erro) com o motivo", () => {
    render(<FaixaIndisponivel disponivel={false} motivo="banco frio" nAmostra={0} nMinimo={200} />);
    const faixa = screen.getByRole("status");
    expect(faixa).toHaveTextContent("hiberna por inatividade");
    expect(faixa).toHaveTextContent("banco frio");
    expect(screen.queryByRole("alert")).toBeNull();
  });

  it("abaixo do n mínimo, muda o texto e explica que é resultado, não falha", () => {
    render(<FaixaIndisponivel disponivel motivo={null} nAmostra={37} nMinimo={200} />);
    expect(screen.getByRole("status")).toHaveTextContent("Amostra insuficiente: 37 predições na janela, abaixo do mínimo de 200");
  });

  it("com amostra suficiente, não renderiza nada", () => {
    const { container } = render(<FaixaIndisponivel disponivel motivo={null} nAmostra={250} nMinimo={200} />);
    expect(container).toBeEmptyDOMElement();
  });
});
