import { expect, test } from "@playwright/test";

test("início mostra as métricas vivas do modelo e a frase de dados fictícios, uma vez", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { level: 1, name: "Triagem Metabólica" })).toBeVisible();
  await expect(page.getByText("Os dados exibidos são fictícios")).toHaveCount(1);
  await expect(page.getByText("Os dados exibidos são fictícios")).toBeVisible();
  const kpis = page.getByLabel("Métricas do modelo em teste");
  // Os três KPIs vêm de GET /model/info: nenhum número está escrito no código do front.
  await expect(kpis.getByText(/^[0-9]{1,3},[0-9]%$/).first()).toBeVisible({ timeout: 60_000 });
  await expect(kpis.getByText(/^[0-9]{1,3},[0-9]%$/)).toHaveCount(3);
  await expect(page.getByText("Modelo servido")).toBeVisible();
  // o tema escrito antes da hidratação (public/tema-inicial.js) e o botão concordam com a tela
  const tema = await page.evaluate(() => document.documentElement.getAttribute("data-theme"));
  expect(tema === "light" || tema === "dark").toBeTruthy();
  await page.getByRole("button", { name: tema === "dark" ? "Mudar para tema claro" : "Mudar para tema escuro" }).click();
  await expect(page.locator("html")).toHaveAttribute("data-theme", tema === "dark" ? "light" : "dark");
});
