import { expect, test } from "@playwright/test";

test("início mostra as métricas vivas do modelo e a frase de dados fictícios, uma vez", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { level: 1, name: "Triagem Metabólica" })).toBeVisible();
  await expect(page.getByText("Os dados exibidos são fictícios")).toHaveCount(1);
  await expect(page.getByText("Os dados exibidos são fictícios")).toBeVisible();
  const kpis = page.getByLabel("Métricas do modelo em teste");
  // Os três KPIs vêm de GET /model/info: nenhum número está escrito no código do front. Cada número
  // conta até o valor; o FINAL fica em [data-numero] (o que o leitor de tela ouve) desde o começo.
  const finais = kpis.locator("[data-numero]");
  await expect(finais).toHaveCount(3, { timeout: 60_000 });
  for (const valor of await finais.allTextContents()) expect(valor).toMatch(/^[0-9]{1,3},[0-9]%$/);
  await expect(page.getByText("Modelo servido")).toBeVisible();
  // A visão geral do projeto e os créditos do autor, com o link para o site.
  await expect(page.getByRole("heading", { level: 2, name: "Objetivo, dados e métodos" })).toBeVisible();
  await expect(page.getByRole("link", { name: /Desenvolvido por Vinícius Ventura/ }).first()).toHaveAttribute("href", "https://viniciusventura.com.br");
  // o tema escrito antes da hidratação (public/tema-inicial.js) e o botão concordam com a tela
  const tema = await page.evaluate(() => document.documentElement.getAttribute("data-theme"));
  expect(tema === "light" || tema === "dark").toBeTruthy();
  await page.getByRole("button", { name: tema === "dark" ? "Mudar para tema claro" : "Mudar para tema escuro" }).click();
  await expect(page.locator("html")).toHaveAttribute("data-theme", tema === "dark" ? "light" : "dark");
});
