import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it } from "vitest";

import { PageHeader } from "./PageHeader";

function renderizar(caminho: string) {
  return render(
    <MemoryRouter initialEntries={[caminho]}>
      <PageHeader titulo="Uma tela" descricao="O que ela responde." />
    </MemoryRouter>,
  );
}

/** O selo, se houver: o parágrafo que vem antes do h1 no cabeçalho. */
const selo = () => screen.getByRole("heading", { level: 1 }).previousElementSibling;

describe("o selo do projeto no cabeçalho das telas (ADR 0016)", () => {
  it("nas telas e no notebook de um projeto, o selo diz o número e o nome dele, em cima do título", () => {
    for (const [caminho, texto] of [
      ["/simulador", "Projeto 1 · Obesidade"],
      ["/painel", "Projeto 1 · Obesidade"],
      ["/estudos/comparacao-de-modelos", "Projeto 1 · Obesidade"],
      ["/diabetes", "Projeto 2 · Diabetes"],
      ["/diabetes/monitoramento", "Projeto 2 · Diabetes"],
      ["/estudos/triagem-de-diabetes", "Projeto 2 · Diabetes"],
    ] as const) {
      const { unmount } = renderizar(caminho);
      expect(selo()).toHaveTextContent(texto);
      unmount();
    }
  });

  it("nas telas comuns (o Início, a lista de estudos, a Política), nenhum selo", () => {
    for (const caminho of ["/", "/estudos", "/privacidade"]) {
      const { unmount } = renderizar(caminho);
      expect(selo()).toBeNull();
      unmount();
    }
  });

  it("fora de um roteador (o teste de uma tela isolada), o cabeçalho sai sem o selo, e sem erro", () => {
    render(<PageHeader titulo="Uma tela" />);
    expect(screen.getByRole("heading", { level: 1, name: "Uma tela" })).toBeInTheDocument();
    expect(selo()).toBeNull();
  });
});
