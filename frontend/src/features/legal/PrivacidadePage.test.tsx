import { render, screen, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it } from "vitest";

import { TooltipProvider } from "@/shared/ui/tooltip";

import politica from "./politica-privacidade.md?raw";
import { PrivacidadePage } from "./PrivacidadePage";
import { preencher, RESPONSAVEL } from "./responsavel";

function renderizar() {
  return render(
    <MemoryRouter>
      <TooltipProvider>
        <PrivacidadePage />
      </TooltipProvider>
    </MemoryRouter>,
  );
}

describe("Política de Privacidade", () => {
  it("todo {{CAMPO}} do texto tem valor: nenhum chega à página sem preencher", () => {
    const texto = preencher(politica, RESPONSAVEL, "https://exemplo.test");
    expect(texto).not.toMatch(/\{\{[A-Z_]+\}\}/);
    expect(texto).toContain("https://exemplo.test");
    // Os asteriscos do CPF mascarado vão escapados: sem isso viravam negrito e itálico.
    expect(texto).toContain("\\*\\*\\*.\\*\\*\\*.\\*\\*\\*-85");
  });

  it("o título, a data, o sumário apontando para cada seção e o canal de privacidade", () => {
    renderizar();
    expect(screen.getByRole("heading", { level: 1, name: "Política de Privacidade" })).toBeInTheDocument();
    expect(screen.getByText(/Última atualização: 19 de outubro de 2026 · Versão 1\.1/)).toBeInTheDocument();
    const sumario = screen.getByRole("navigation", { name: "Nesta página" });
    const itens = within(sumario).getAllByRole("link");
    expect(itens.length).toBeGreaterThanOrEqual(14);
    for (const item of itens) {
      const alvo = item.getAttribute("href")?.slice(1) ?? "";
      expect(document.getElementById(alvo)?.tagName).toBe("H2");
    }
    expect(screen.getAllByRole("link", { name: "vvprivacidade@gmail.com" })[0]).toHaveAttribute("href", "mailto:vvprivacidade@gmail.com");
    expect(screen.getByText("***.***.***-85")).toBeInTheDocument();
  });

  it("diz o que este projeto faz: sem cookies, sem IP gravado, registro anônimo do simulador e as chaves do aparelho", () => {
    renderizar();
    const texto = document.body.textContent ?? "";
    expect(texto).toContain("Não usamos cookies.");
    expect(texto).toContain("Nunca é gravado");
    expect(texto).toContain(RESPONSAVEL.retencaoLog);
    expect(screen.getByText("tema", { selector: "code" })).toBeInTheDocument();
    expect(screen.getByText("menu-lateral", { selector: "code" })).toBeInTheDocument();
  });

  it("cada célula das tabelas leva o título da coluna (os cartões do celular), e a do responsável vira campo e valor", () => {
    const { container } = renderizar();
    const celulas = container.querySelectorAll("tbody td");
    expect(celulas.length).toBeGreaterThan(0);
    const semRotulo = [...celulas].filter((td) => !td.hasAttribute("data-rotulo") && !td.closest("table.tabela-campos"));
    expect(semRotulo).toHaveLength(0);
    expect(container.querySelectorAll("table.tabela-campos")).toHaveLength(1);
    expect(container.querySelector('td[data-rotulo="Por quanto tempo"]')).not.toBeNull();
  });

  it("nenhuma linha de tabela perdeu um separador: toda linha tem tantas células quanto o cabeçalho", () => {
    const { container } = renderizar();
    for (const tabela of container.querySelectorAll("table")) {
      const colunas = tabela.querySelectorAll("thead th").length;
      for (const linha of tabela.querySelectorAll("tbody tr")) {
        // O GFM completa a linha curta com células vazias: uma célula vazia é o sintoma do "|" perdido.
        const celulas = [...linha.querySelectorAll("td")];
        expect(celulas).toHaveLength(colunas);
        expect(celulas.every((td) => (td.textContent ?? "").trim() !== "")).toBe(true);
      }
    }
  });

  it("links para fora abrem em nova aba; os créditos levam ao site do autor", () => {
    renderizar();
    const anpd = screen.getByRole("link", { name: "atendimento ao titular de dados da ANPD" });
    expect(anpd).toHaveAttribute("target", "_blank");
    expect(anpd).toHaveAttribute("rel", "noopener noreferrer");
    expect(screen.getByRole("link", { name: /Desenvolvido por Vinícius Ventura/ })).toHaveAttribute("href", "https://viniciusventura.com.br");
  });
});
