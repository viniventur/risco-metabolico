import { render, screen, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it } from "vitest";

import { TooltipProvider } from "@/shared/ui/tooltip";

import { Sidebar } from "./Sidebar";

function renderizar(caminho: string, recolhido = false) {
  return render(
    <MemoryRouter initialEntries={[caminho]}>
      <TooltipProvider>
        <Sidebar recolhido={recolhido} />
      </TooltipProvider>
    </MemoryRouter>,
  );
}

const hrefs = (lista: HTMLElement) => within(lista).getAllByRole("link").map((a) => a.getAttribute("href"));

describe("o menu em dois projetos (ADR 0016)", () => {
  it("um bloco por projeto, com o nome como título da lista, o número, a natureza da base e as quatro telas", () => {
    renderizar("/");
    const menu = screen.getByRole("navigation", { name: "Menu principal" });
    expect(hrefs(within(menu).getByRole("list", { name: "Obesidade" }))).toEqual(["/painel", "/consulta", "/simulador", "/monitoramento"]);
    expect(hrefs(within(menu).getByRole("list", { name: "Diabetes" }))).toEqual(["/diabetes", "/diabetes/consulta", "/diabetes/simulador", "/diabetes/monitoramento"]);
    expect(within(menu).getByText("Projeto 1 · dados fictícios")).toBeInTheDocument();
    expect(within(menu).getByText("Projeto 2 · dados reais")).toBeInTheDocument();
    // o Início e os estudos continuam no menu, fora dos blocos
    expect(within(menu).getByRole("link", { name: "Início" })).toHaveAttribute("href", "/");
    expect(within(menu).getByRole("link", { name: "Estudos" })).toHaveAttribute("href", "/estudos");
  });

  it("a tela aberta acende no bloco do projeto dela, e só nele", () => {
    renderizar("/diabetes/simulador");
    const menu = screen.getByRole("navigation", { name: "Menu principal" });
    expect(within(within(menu).getByRole("list", { name: "Diabetes" })).getByRole("link", { name: "Simulador" })).toHaveAttribute("aria-current", "page");
    expect(within(within(menu).getByRole("list", { name: "Obesidade" })).getByRole("link", { name: "Simulador" })).not.toHaveAttribute("aria-current");
  });

  it("recolhido, as telas dos dois projetos têm o mesmo ícone, e o nome diz de qual projeto é cada uma", () => {
    renderizar("/", true);
    const menu = screen.getByRole("navigation", { name: "Menu principal" });
    expect(within(within(menu).getByRole("list", { name: "Obesidade" })).getByRole("link", { name: "Simulador da obesidade" })).toHaveAttribute("href", "/simulador");
    expect(within(within(menu).getByRole("list", { name: "Diabetes" })).getByRole("link", { name: "Simulador da diabetes" })).toHaveAttribute(
      "href",
      "/diabetes/simulador",
    );
  });
});
