import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { TooltipProvider } from "@/shared/ui/tooltip";

import { AUTOR } from "./autor";
import { CreditosDoAutor } from "./CreditosDoAutor";

const CAIXA_DO_SIMBOLO = 'svg[viewBox="0 0 58.66 78.68"]';
const CAIXA_DO_NOME = 'svg[viewBox="105.13 30.86 356.05 34.54"]';

describe("CreditosDoAutor", () => {
  it("completa: 'Desenvolvido por', o nome e o símbolo, num link para o site que abre em nova aba", () => {
    render(<CreditosDoAutor />);
    const link = screen.getByRole("link", { name: /Desenvolvido por Vinícius Ventura/ });
    expect(link).toHaveAttribute("href", "https://viniciusventura.com.br");
    expect(link).toHaveAttribute("href", AUTOR.site);
    expect(link).toHaveAttribute("target", "_blank");
    expect(link).toHaveAttribute("rel", "noopener noreferrer");
    expect(link).toHaveAccessibleName(/viniciusventura\.com\.br/);
    expect(link).toHaveAccessibleName(/abre em nova aba/);
  });

  it("o nome vem antes do símbolo; o chapéu leva o ciano da marca e o resto, a cor do texto", () => {
    render(<CreditosDoAutor />);
    const link = screen.getByRole("link", { name: /Desenvolvido por/ });
    const nome = link.querySelector(CAIXA_DO_NOME);
    const simbolo = link.querySelector(CAIXA_DO_SIMBOLO);
    expect(nome).toHaveAttribute("aria-hidden", "true");
    expect(simbolo).toHaveAttribute("aria-hidden", "true");
    expect((nome as Element).compareDocumentPosition(simbolo as Element) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(nome?.querySelectorAll('path[fill="currentColor"]')).toHaveLength(1);
    expect(simbolo?.querySelectorAll("polygon.fill-autor")).toHaveLength(1);
    expect(simbolo?.querySelectorAll('polygon[fill="currentColor"]')).toHaveLength(1);
  });

  it("compacta: só o símbolo, sem texto na tela, com o nome no aria-label", () => {
    render(
      <TooltipProvider>
        <CreditosDoAutor variante="compacta" />
      </TooltipProvider>,
    );
    const link = screen.getByRole("link", { name: /Desenvolvido por Vinícius Ventura/ });
    expect(link).toHaveAttribute("href", AUTOR.site);
    expect(link).toHaveAttribute("target", "_blank");
    expect(link).toHaveTextContent("");
    expect(link.querySelector(CAIXA_DO_SIMBOLO)).not.toBeNull();
    expect(link.querySelector(CAIXA_DO_NOME)).toBeNull();
  });
});
