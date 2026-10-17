import { expect, test } from "@playwright/test";

test("clicar numa barra de nível filtra o painel pela URL; Esc limpa; voltar desfaz", async ({ page }) => {
  await page.goto("/painel");
  await expect(page.getByText(/^Recorte: 2\.111 de 2\.111 registros$/)).toBeVisible({ timeout: 60_000 });
  const barras = page.getByRole("region", { name: "Divisão por Nível de Obesidade" });
  await expect(barras.locator(".recharts-bar-rectangle")).toHaveCount(7);
  // primeira barra = "Abaixo do Peso" (ordem clínica)
  await barras.locator(".recharts-bar-rectangle").first().click();
  await expect(page).toHaveURL(/nivel=Abaixo/);
  await expect(page.getByText(/^Recorte: 272 de 2\.111 registros$/)).toBeVisible();
  // o gráfico de origem continua com as 7 barras (só destaca); os demais refletem o recorte
  await expect(barras.locator(".recharts-bar-rectangle")).toHaveCount(7);
  await expect(page.getByRole("region", { name: "Consumo de Alimentos Calóricos" }).getByText("272")).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page).not.toHaveURL(/nivel=/);
  await expect(page.getByText(/^Recorte: 2\.111 de 2\.111 registros$/)).toBeVisible();
  await page.goBack();
  await expect(page).toHaveURL(/nivel=Abaixo/);
});
