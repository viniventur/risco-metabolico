import { expect, test } from "@playwright/test";

test("simulador envia os 16 campos com X-Origem-Cliente e desenha 7 barras", async ({ page }) => {
  await page.goto("/simulador");
  // o aviso de registro anônimo é o que descreve o formulário
  const formulario = page.getByRole("form", { name: "Formulário de triagem" });
  await expect(formulario).toBeVisible({ timeout: 60_000 });
  await expect(formulario).toHaveAccessibleDescription("As entradas são registradas de forma anônima para monitoramento do modelo.");
  const requisicao = page.waitForRequest((r) => r.url().endsWith("/api/v1/predicoes") && r.method() === "POST");
  await page.getByRole("button", { name: "Calcular probabilidade" }).click({ timeout: 60_000 });
  const req = await requisicao;
  expect(req.headers()["x-origem-cliente"]).toBe("painel");
  const corpo = req.postDataJSON() as Record<string, unknown>;
  expect(Object.keys(corpo)).toHaveLength(16);
  await expect(page.getByText("Risco acumulado", { exact: true })).toBeVisible();
  await expect(page.locator(".recharts-bar-rectangle")).toHaveCount(7);
  await expect(page.getByRole("button", { name: "Baixar relatório (HTML)" })).toBeVisible();
});
