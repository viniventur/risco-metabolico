import { expect, test } from "@playwright/test";

test("consulta: slicers com o domínio global e a contagem do recorte, tabela virtualizada e exportação do recorte", async ({ page }) => {
  await page.goto("/consulta");
  await expect(page.getByText(/^2\.111 registros$/)).toBeVisible({ timeout: 60_000 });

  // abre o slicer de nível: as 7 opções do domínio, cada uma com a contagem
  await page.getByRole("combobox", { name: /^Nível de obesidade/ }).click();
  const lista = page.getByRole("listbox", { name: "Nível de obesidade" });
  await expect(lista.getByRole("option")).toHaveCount(7);
  // as setas movem a opção ativa, anunciada por aria-activedescendant
  const busca = page.getByRole("searchbox", { name: "Buscar em Nível de obesidade" });
  await busca.press("ArrowDown");
  await expect(busca).toHaveAttribute("aria-activedescendant", /-1$/);
  await lista.getByRole("option", { name: /Abaixo do Peso/ }).click();
  await expect(page).toHaveURL(/nivel=Abaixo/);
  await expect(page.getByText(/^272 registros$/)).toBeVisible();
  // o próprio slicer continua com as 7 opções (domínio global), não só a sobrevivente
  await expect(lista.getByRole("option")).toHaveCount(7);

  // Esc com a lista aberta só fecha a lista; o recorte continua
  await page.keyboard.press("Escape");
  await expect(lista).toHaveCount(0);
  await expect(page).toHaveURL(/nivel=Abaixo/);
  // o filtro ativo aparece como chip no cabeçalho
  await expect(page.getByRole("button", { name: "Remover filtro Nível de obesidade: Abaixo do Peso" })).toBeVisible();

  // ~30 linhas no DOM, nunca as 200 da página; ordem inicial por IMC desc
  const linhas = page.locator("tbody tr");
  expect(await linhas.count()).toBeLessThan(45);
  await expect(page.locator("thead th").first()).toHaveAttribute("aria-sort", "none");
  await expect(page.locator("thead th").nth(1)).toHaveAttribute("aria-sort", "descending");
  // as escalas ordinais mostram o rótulo de /metadata, não o código
  await expect(page.getByRole("columnheader", { name: /Tempo em telas/ })).toBeAttached();
  await expect(page.locator("tbody td").filter({ hasText: /horas\/dia$/ }).first()).toBeAttached();

  const href = await page.getByRole("link", { name: "Exportar CSV" }).getAttribute("href");
  expect(href).toContain("/api/v1/registros/exportar?nivel=Abaixo");

  // segundo Esc: o atalho global limpa os 6 filtros
  await page.keyboard.press("Escape");
  await expect(page).not.toHaveURL(/nivel=/);
  await expect(page.getByText(/^2\.111 registros$/)).toBeVisible();
});
