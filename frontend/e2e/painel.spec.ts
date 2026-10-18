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
  // o filtro vira chip no cabeçalho, e "Limpar filtros" fica disponível
  await expect(page.getByRole("button", { name: "Remover filtro Nível de obesidade: Abaixo do Peso" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Limpar filtros" })).toBeEnabled();
  // o gráfico de origem continua com as 7 barras (só destaca); os demais refletem o recorte:
  // abaixo do peso, 173 mulheres e 99 homens no cartão de gênero
  await expect(barras.locator(".recharts-bar-rectangle")).toHaveCount(7);
  await expect(page.getByRole("region", { name: "Gênero e Nível de Obesidade" }).getByText(/^173 registros/)).toBeVisible();
  // o dropdown do nível, na faixa de filtros, mostra o que o clique marcou
  await expect(page.getByRole("combobox", { name: /^Nível de obesidade Abaixo do Peso/ })).toBeVisible();
  // todo gráfico tem a tabela equivalente
  await barras.getByRole("button", { name: "Ver dados em tabela" }).click();
  await expect(barras.getByRole("table")).toBeVisible();
  await expect(barras.getByRole("row")).toHaveCount(8);
  // a dica do botão é uma camada do Radix: com ela aberta, o primeiro Esc só a fecharia
  await page.mouse.move(0, 0);
  await expect(page.getByRole("tooltip")).toHaveCount(0);
  await page.keyboard.press("Escape");
  await expect(page).not.toHaveURL(/nivel=/);
  await expect(page.getByText(/^Recorte: 2\.111 de 2\.111 registros$/)).toBeVisible();
  await page.goBack();
  await expect(page).toHaveURL(/nivel=Abaixo/);
});

test("a faixa de filtros filtra por dropdown, e o gráfico de fatores filtra pela resposta clicada", async ({ page }) => {
  await page.goto("/painel");
  await expect(page.getByText(/^Recorte: 2\.111 de 2\.111 registros$/)).toBeVisible({ timeout: 60_000 });
  // os 6 filtros do painel em dropdown, numa faixa só
  await expect(page.getByRole("group", { name: "Filtros do painel" }).getByRole("combobox")).toHaveCount(6);
  await page.getByRole("combobox", { name: /^Gênero/ }).click();
  await page.getByRole("listbox", { name: "Gênero" }).getByRole("option", { name: /Feminino/ }).click();
  await expect(page).toHaveURL(/genero=Feminino/);
  await expect(page.getByText(/^Recorte: 1\.043 de 2\.111 registros$/)).toBeVisible();
  await page.keyboard.press("Escape");
  // com filtro, os KPIs clínicos comparam o recorte com a base
  await expect(page.getByText(/^na base 46,0%/)).toBeVisible();
  // a linha "Sim" do histórico familiar filtra o painel (o fator também é filtro)
  const fatores = page.getByRole("region", { name: "Fatores associados à obesidade" });
  const sim = fatores.getByRole("region", { name: "Histórico familiar de excesso de peso?" }).getByRole("button", { name: /^Sim:/ });
  await sim.scrollIntoViewIfNeeded();
  const rolagemAntes = await page.evaluate(() => window.scrollY);
  await sim.click();
  await expect(page).toHaveURL(/historico_familiar=Sim/);
  await expect(page.getByRole("button", { name: "Remover filtro Histórico familiar: Sim" })).toBeAttached();
  // filtrar não leva a página de volta ao topo (o nuqs navega sem reiniciar a rolagem)
  expect(await page.evaluate(() => window.scrollY)).toBeGreaterThan(rolagemAntes / 2);
});
