import { expect, test } from "@playwright/test";

test("monitoramento: mostra o par (modelo, dados), o n da janela e degrada com faixa de aviso, nunca erro", async ({ page }) => {
  await page.goto("/monitoramento");
  await expect(page.getByRole("heading", { level: 1, name: "Monitoramento de deriva" })).toBeVisible();
  await expect(page.getByText("Snapshot de treino")).toBeVisible({ timeout: 60_000 });
  await expect(page.getByText(/^v[0-9]+\.[0-9]+\.[0-9]+$/)).toBeVisible();
  // a janela é um grupo de rádio (uma escolha sempre marcada)
  await expect(page.getByRole("radio", { name: "30 dias" })).toBeChecked();
  // nunca tela de erro: ou a tabela de features, ou a faixa de aviso (banco fora / amostra insuficiente)
  const faixa = page.getByRole("main").getByRole("status");
  const tabela = page.getByRole("columnheader", { name: "Feature" });
  await expect(faixa.or(tabela).first()).toBeVisible();
  await expect(page.getByRole("alert")).toHaveCount(0);
  // aceite de F14b com `docker compose stop banco`: a faixa de aviso do banco fora, nunca erro
  if (process.env.ESPERAR_BANCO_FORA) await expect(faixa.first()).toContainText("não respondeu");
  await expect(page.getByText("sql/deriva/")).toBeVisible();
  // com amostra insuficiente, a coluna de PSI some e a faixa muda de texto
  if (await faixa.count()) {
    const texto = (await faixa.first().textContent()) ?? "";
    if (texto.includes("Amostra insuficiente")) {
      await expect(page.getByRole("columnheader", { name: "PSI" })).toHaveCount(0);
      await expect(tabela).toBeVisible();
    }
  }
});
