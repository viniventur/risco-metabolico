import { expect, test } from "@playwright/test";

test("início mostra as métricas vivas do modelo e a frase de dados fictícios", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { level: 1, name: "Triagem Metabólica" })).toBeVisible();
  await expect(page.getByText("Os dados exibidos são fictícios").first()).toBeVisible();
  const kpis = page.getByLabel("Métricas do modelo em teste");
  // Os três KPIs vêm de GET /model/info: nenhum número está escrito no código do front.
  await expect(kpis.getByText(/^[0-9]{1,3},[0-9]%$/).first()).toBeVisible({ timeout: 60_000 });
  await expect(kpis.getByText(/^[0-9]{1,3},[0-9]%$/)).toHaveCount(3);
  await expect(page.getByText("Modelo servido")).toBeVisible();
});
