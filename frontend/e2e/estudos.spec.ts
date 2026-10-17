import { expect, test } from "@playwright/test";

test("estudos: lista o notebook, renderiza as células com sumário e o gráfico Plotly fica vivo", async ({ page, request }) => {
  await page.goto("/estudos");
  const cartao = page.getByRole("link", { name: /Comparação de modelos/ });
  await expect(cartao).toBeVisible({ timeout: 60_000 });
  await cartao.click();
  await expect(page).toHaveURL(/\/estudos\/comparacao-de-modelos$/);
  // um único h1 na página (o do cabeçalho); os títulos do notebook entram um nível abaixo
  await expect(page.getByRole("heading", { level: 1 })).toHaveCount(1);
  await expect(page.getByRole("heading", { level: 1, name: /Comparação de modelos/ })).toBeVisible();

  // sumário com numeração hierárquica e âncoras que existem na página
  const sumario = page.getByRole("navigation", { name: "Sumário" });
  const itens = sumario.getByRole("link");
  expect(await itens.count()).toBeGreaterThan(8);
  const primeiroHref = (await itens.first().getAttribute("href")) ?? "";
  await expect(page.locator(`[id="${primeiroHref.slice(1)}"]`)).toHaveCount(1);

  // código realçado no build e o CSS do Pygments carregado uma vez
  await expect(page.locator("pre.hl").first()).toBeVisible();
  await expect(page.locator("link#pygments-css")).toHaveCount(1);

  // a figura Plotly inicializa ao chegar perto da viewport (import dinâmico) e desenha as traces
  await page.locator("div[role=img]").first().scrollIntoViewIfNeeded();
  await expect(page.locator(".js-plotly-plot").first()).toBeVisible({ timeout: 60_000 });
  await expect(page.locator(".js-plotly-plot .scatterlayer").first()).toBeAttached();

  // o notebook de origem é baixável e o JSON não passou pelo backend
  const href = (await page.getByRole("link", { name: "Baixar notebook" }).getAttribute("href")) ?? "";
  expect(href).toBe("/study/notebooks/comparacao-de-modelos.ipynb");
  const resposta = await request.get(href);
  expect(resposta.ok()).toBeTruthy();
});
