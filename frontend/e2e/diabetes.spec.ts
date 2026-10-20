import { expect, test } from "@playwright/test";

// A vertente diabetes num arquivo só: os testes de um arquivo rodam em série, num worker. Um arquivo
// por tela abriria mais páginas ao mesmo tempo no dev server, e as rotas lazy dos testes atuais
// passariam dos 5 s de espera do h1.

const FICTICIOS = "Os dados exibidos são fictícios";
const REAIS = "Os dados exibidos são respostas reais e anonimizadas";

test("diabetes: clicar numa coluna de idade filtra o painel pela URL; os KPIs comparam com a base; Esc limpa; voltar desfaz", async ({ page }) => {
  await page.goto("/diabetes");
  await expect(page.getByText(/^Recorte: 253\.680 de 253\.680 respostas$/)).toBeVisible({ timeout: 60_000 });
  const idade = page.getByRole("region", { name: "Diabetes por faixa etária" });
  await expect(idade.locator(".recharts-bar-rectangle")).toHaveCount(13);
  // a 11ª coluna = 70 a 74 anos (ordem da escala)
  await idade.locator(".recharts-bar-rectangle").nth(10).click();
  await expect(page).toHaveURL(/faixa_etaria=11/);
  await expect(page.getByText(/^Recorte: 23\.533 de 253\.680 respostas$/)).toBeVisible();
  // o filtro vira chip, com o rótulo da API
  await expect(page.getByRole("button", { name: "Remover filtro Faixa etária: 70 a 74 anos" })).toBeVisible();
  // com filtro, o % com diabetes diz o da base e a diferença em pontos percentuais
  await expect(page.getByText(/na base 13,9% · \+7,9 p\.p\./)).toBeVisible();
  // o dropdown da faixa de filtros mostra o que o clique marcou; o gráfico de origem continua com as 13 colunas
  await expect(page.getByRole("combobox", { name: /^Faixa etária 70 a 74 anos/ })).toBeVisible();
  await expect(idade.locator(".recharts-bar-rectangle")).toHaveCount(13);
  // todo gráfico tem a tabela equivalente
  await idade.getByRole("button", { name: "Ver dados em tabela" }).click();
  await expect(idade.getByRole("row")).toHaveCount(14);
  // a dica do botão é uma camada do Radix: com ela aberta, o primeiro Esc só a fecharia
  await page.mouse.move(0, 0);
  await expect(page.getByRole("tooltip")).toHaveCount(0);
  await page.keyboard.press("Escape");
  await expect(page).not.toHaveURL(/faixa_etaria=/);
  await expect(page.getByText(/^Recorte: 253\.680 de 253\.680 respostas$/)).toBeVisible();
  await page.goBack();
  await expect(page).toHaveURL(/faixa_etaria=11/);
});

test("diabetes: os 6 filtros em dropdown, a pirâmide filtra o sexo e a resposta de pressão alta filtra pelo gráfico de fatores", async ({ page }) => {
  await page.goto("/diabetes");
  await expect(page.getByText(/^Recorte: 253\.680 de 253\.680 respostas$/)).toBeVisible({ timeout: 60_000 });
  await expect(page.getByRole("group", { name: "Filtros do painel" }).getByRole("combobox")).toHaveCount(6);
  await page.getByRole("combobox", { name: /^Faixa de IMC/ }).click();
  await page.getByRole("listbox", { name: "Faixa de IMC" }).getByRole("option", { name: /Obesidade Grau III/ }).click();
  await expect(page).toHaveURL(/faixa_imc=Obesidade/);
  await page.keyboard.press("Escape");
  // a pirâmide marca o sexo pela posição: a barra de um lado filtra aquele sexo
  const piramide = page.getByRole("region", { name: "Idade e sexo" });
  await piramide.getByRole("button", { name: /^80 anos ou mais, Masculino:/ }).click();
  await expect(page).toHaveURL(/sexo=Masculino/);
  // a resposta "Sim" de pressão alta filtra o painel (o fator também é filtro)...
  const fatores = page.getByRole("region", { name: "Fatores associados à diabetes" });
  const pressao = fatores.getByRole("region", { name: "Pressão alta" });
  const sim = pressao.getByRole("button", { name: /^Sim:/ });
  await sim.scrollIntoViewIfNeeded();
  await sim.click();
  await expect(page).toHaveURL(/pressao_alta=Sim/);
  await expect(page.getByRole("button", { name: "Remover filtro Pressão alta: Sim" })).toBeAttached();
  // ...e a pergunta filtrada continua com as duas respostas (vem sem o próprio filtro)
  await expect(pressao.getByRole("button")).toHaveCount(2);
});

test("diabetes, consulta: slicers com o domínio global, tabela com os rótulos da API e a exportação do recorte", async ({ page }) => {
  await page.goto("/diabetes/consulta");
  await expect(page.getByText(/^253\.680 respostas$/)).toBeVisible({ timeout: 60_000 });

  // a faixa etária: as 13 opções do domínio, cada uma com a contagem
  await page.getByRole("combobox", { name: /^Faixa etária/ }).click();
  const lista = page.getByRole("listbox", { name: "Faixa etária" });
  await expect(lista.getByRole("option")).toHaveCount(13);
  await lista.getByRole("option", { name: /18 a 24 anos/ }).click();
  await expect(page).toHaveURL(/faixa_etaria=1(&|$)/);
  await expect(page.getByText(/^5\.700 respostas$/)).toBeVisible();
  // o próprio slicer continua com as 13 opções (domínio global)
  await expect(lista.getByRole("option")).toHaveCount(13);
  // Esc com a lista aberta só fecha a lista; o recorte continua
  await page.keyboard.press("Escape");
  await expect(lista).toHaveCount(0);
  await expect(page).toHaveURL(/faixa_etaria=1/);

  // as respostas de dois valores são alternância
  await page.getByRole("group", { name: "Sexo" }).getByRole("button", { name: /Feminino/ }).click();
  await expect(page).toHaveURL(/sexo=Feminino/);
  await expect(page.getByText(/^2\.745 respostas$/)).toBeVisible();

  // ~30 linhas no DOM, nunca as 200 da página; ordem inicial por IMC decrescente
  expect(await page.locator("tbody tr").count()).toBeLessThan(45);
  await expect(page.getByRole("columnheader", { name: /IMC \(kg\/m²\)/ })).toHaveAttribute("aria-sort", "descending");
  // cabeçalhos e escalas com os rótulos da API, não o nome da coluna nem o código
  await expect(page.getByRole("columnheader", { name: /Renda do domicílio/ })).toBeAttached();
  await expect(page.locator("tbody td").filter({ hasText: /^18 a 24 anos$/ }).first()).toBeAttached();

  const href = (await page.getByRole("link", { name: "Exportar CSV" }).getAttribute("href")) ?? "";
  expect(href).toContain("/api/v1/diabetes/registros/exportar?");
  expect(href).toContain("faixa_etaria=1");
  expect(href).toContain("sexo=Feminino");

  // segundo Esc: o atalho da vertente limpa os 6 filtros
  await page.keyboard.press("Escape");
  await expect(page).not.toHaveURL(/faixa_etaria=|sexo=/);
  await expect(page.getByText(/^253\.680 respostas$/)).toBeVisible();
});

test("diabetes, simulador: formulário de /diabetes/metadata, a calculadora de IMC e as 10 respostas com X-Origem-Cliente", async ({ page }) => {
  await page.goto("/diabetes/simulador");
  // o aviso de registro anônimo é o que descreve o formulário
  const formulario = page.getByRole("form", { name: "Formulário de triagem de diabetes" });
  await expect(formulario).toBeVisible({ timeout: 60_000 });
  await expect(formulario).toHaveAccessibleDescription("As entradas são registradas de forma anônima para monitoramento do modelo.");

  // a calculadora preenche o IMC (81 kg e 1,80 m: 25); o contrato não muda, só o IMC vai à API
  await page.getByLabel("Peso (kg)").fill("81");
  await page.getByLabel("Altura (m)").fill("1.8");
  await expect(page.getByLabel("IMC (kg/m²)")).toHaveValue("25");

  const requisicao = page.waitForRequest((r) => r.url().endsWith("/api/v1/diabetes/predicoes") && r.method() === "POST");
  await page.getByRole("button", { name: "Calcular probabilidade" }).click({ timeout: 60_000 });
  const req = await requisicao;
  expect(req.headers()["x-origem-cliente"]).toBe("painel");
  const corpo = req.postDataJSON() as Record<string, unknown>;
  expect(Object.keys(corpo)).toHaveLength(10);
  expect(corpo.IMC).toBe(25);

  // a classificação pelo limiar, a régua com o limiar e o relatório
  const resultado = page.getByRole("region", { name: "Resultado da triagem de diabetes" });
  await expect(resultado.getByText(/^Risco (elevado|baixo)$/)).toBeVisible();
  await expect(resultado.getByText(/^Limiar de triagem:/)).toBeVisible();
  await expect(page.getByRole("button", { name: "Baixar relatório (HTML)" })).toBeVisible();
});

test("diabetes, monitoramento: o par (modelo, dados) da vertente, o n da janela e a faixa de aviso, nunca erro", async ({ page }) => {
  await page.goto("/diabetes/monitoramento");
  await expect(page.getByRole("heading", { level: 1, name: "Monitoramento de deriva da diabetes" })).toBeVisible();
  await expect(page.getByText("Snapshot de treino")).toBeVisible({ timeout: 60_000 });
  await expect(page.getByText(/^v[0-9]+\.[0-9]+\.[0-9]+$/)).toBeVisible();
  // a janela é um grupo de rádio (uma escolha sempre marcada)
  await expect(page.getByRole("radio", { name: "30 dias" })).toBeChecked();
  // nunca tela de erro: ou a tabela das entradas, ou a faixa de aviso (banco fora / amostra insuficiente)
  const faixa = page.getByRole("main").getByRole("status");
  const tabela = page.getByRole("columnheader", { name: "Feature" });
  await expect(faixa.or(tabela).first()).toBeVisible();
  await expect(page.getByRole("alert")).toHaveCount(0);
  // as consultas são as da vertente
  await expect(page.getByText("sql/diabetes/deriva/")).toBeVisible();
  // com amostra insuficiente, a coluna de PSI some e a faixa muda de texto
  if (await faixa.count()) {
    const texto = (await faixa.first().textContent()) ?? "";
    if (texto.includes("Amostra insuficiente")) {
      await expect(page.getByRole("columnheader", { name: "PSI" })).toHaveCount(0);
      await expect(tabela).toBeVisible();
    }
  }
});

test("o rodapé diz a frase de cada vertente: a de D3 em /diabetes/*, a de dados fictícios na obesidade, as duas no Início", async ({ page }) => {
  await page.goto("/diabetes/consulta");
  await expect(page.getByText(REAIS)).toHaveCount(1);
  await expect(page.getByText(FICTICIOS)).toHaveCount(0);

  await page.goto("/consulta");
  await expect(page.getByText(FICTICIOS)).toHaveCount(1);
  await expect(page.getByText(REAIS)).toHaveCount(0);

  await page.goto("/");
  await expect(page.getByText(FICTICIOS)).toHaveCount(1);
  await expect(page.getByText(REAIS)).toHaveCount(1);
});

test("o Início tem a seção da vertente com os números de /diabetes/model/info, e o grupo Diabetes do menu leva às telas dela", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { level: 2, name: "Triagem de diabetes: o modelo em teste" })).toBeVisible();
  const metricas = page.getByLabel("Desempenho da triagem de diabetes no teste");
  await expect(metricas.locator("[data-numero]")).toHaveCount(4, { timeout: 60_000 });
  await expect(page.getByRole("navigation", { name: "Telas da vertente diabetes" }).getByRole("link")).toHaveCount(5);

  const diabetes = page.getByRole("navigation", { name: "Menu principal" }).getByRole("list", { name: "Diabetes" });
  await expect(diabetes.getByRole("link")).toHaveCount(4);
  await diabetes.getByRole("link", { name: "Simulador" }).click();
  await expect(page).toHaveURL(/\/diabetes\/simulador$/);
  await expect(page.getByRole("heading", { level: 1, name: "Simulador de triagem de diabetes" })).toBeVisible();
});

// O limiar por grupo de idade (modelo 1.1.0): os números vêm de /diabetes/model/info, que as duas telas leem;
// o teste os confere contra a mesma resposta, nunca contra um valor escrito aqui.

/** O percentual como o front o escreve (shared/format/ptBR.ts, fmtPct): uma casa, vírgula decimal. */
const pct = (fracao: number) => `${(fracao * 100).toLocaleString("pt-BR", { minimumFractionDigits: 1, maximumFractionDigits: 1 })}%`;

type PontoForaDaDobra = { recall: number; encaminhados: number };
type GrupoDeIdade = { grupo: string; faixas_etarias: number[]; valor: number; fora_da_dobra: PontoForaDaDobra };
type InfoComGrupos = { limiar: { valor: number; fora_da_dobra: PontoForaDaDobra }; limiares_por_idade: { grupos: GrupoDeIdade[]; fora_da_dobra: PontoForaDaDobra } };

test("diabetes, simulador: o limiar é o do grupo de idade da pessoa, a tela diz o grupo e o porquê, e outra idade dá outro limiar", async ({ page }) => {
  const lerInfo = page.waitForResponse((r) => r.url().endsWith("/api/v1/diabetes/model/info") && r.ok());
  await page.goto("/diabetes/simulador");
  const info = (await (await lerInfo).json()) as InfoComGrupos;
  await expect(page.getByText(/o limiar do grupo de idade da pessoa a classifica em risco elevado ou baixo/)).toBeVisible();
  await expect(page.getByRole("form", { name: "Formulário de triagem de diabetes" })).toBeVisible({ timeout: 60_000 });
  const resultado = page.getByRole("region", { name: "Resultado da triagem de diabetes" });

  const limiares = new Set<number>();
  for (const [faixa, rotulo] of [
    [10, "65 a 69 anos"],
    [1, "18 a 24 anos"],
  ] as const) {
    await page.getByLabel("Faixa etária", { exact: true }).selectOption({ label: rotulo });
    const resposta = page.waitForResponse((r) => r.url().endsWith("/api/v1/diabetes/predicoes") && r.request().method() === "POST");
    await page.getByRole("button", { name: "Calcular probabilidade" }).click();
    const corpo = (await (await resposta).json()) as { limiar: number; grupo_de_idade: string };
    // a API classificou pelo limiar do grupo que contém a faixa escolhida...
    const grupo = info.limiares_por_idade.grupos.find((g) => g.faixas_etarias.includes(faixa));
    expect(grupo).toBeDefined();
    expect(corpo.grupo_de_idade).toBe(grupo?.grupo);
    expect(corpo.limiar).toBe(grupo?.valor);
    limiares.add(corpo.limiar);
    // ...e a tela diz qual, com o limiar dele no traço, a leitura do grupo e por que o limiar depende da idade
    await expect(resultado.getByText(/^Limiar de triagem:/)).toContainText(`Limiar de triagem: ${pct(corpo.limiar)} (o traço), o do grupo de ${corpo.grupo_de_idade}.`);
    await expect(resultado.getByText(/^(No limiar do seu grupo de idade ou acima dele|Abaixo do limiar do seu grupo de idade)/)).toBeVisible();
    await expect(resultado.getByText(/^O limiar depende da idade/)).toBeVisible();
  }
  expect(limiares.size).toBe(2);
});

test("o Início: a tabela com o limiar de cada grupo de idade e o limiar único como referência, de /diabetes/model/info", async ({ page }) => {
  const lerInfo = page.waitForResponse((r) => r.url().endsWith("/api/v1/diabetes/model/info") && r.ok());
  await page.goto("/");
  const info = (await (await lerInfo).json()) as InfoComGrupos;
  const tabela = page.getByRole("table", { name: "Limiar de cada grupo de idade" });
  await expect(tabela).toBeVisible({ timeout: 60_000 });
  const linhas = tabela.locator("tbody tr");
  await expect(linhas).toHaveCount(info.limiares_por_idade.grupos.length);
  for (const [i, g] of info.limiares_por_idade.grupos.entries()) {
    await expect(linhas.nth(i).locator("th, td")).toHaveText([g.grupo, pct(g.valor), pct(g.fora_da_dobra.recall), pct(g.fora_da_dobra.encaminhados)]);
  }
  const total = info.limiares_por_idade.fora_da_dobra;
  await expect(tabela.locator("tfoot tr").locator("th, td")).toHaveText(["Todas as idades", pct(total.recall), pct(total.encaminhados)]);
  await expect(page.getByText(/^Um limiar só, para todas as idades, seria/)).toContainText(
    `seria ${pct(info.limiar.valor)}: no total, recall de ${pct(info.limiar.fora_da_dobra.recall)} e ${pct(info.limiar.fora_da_dobra.encaminhados)} das respostas encaminhadas.`,
  );
  await expect(page.getByText(/o limiar do grupo de idade encaminha quem fica nele ou acima dele/)).toBeVisible();
});

// Os dois projetos (ADR 0016): o menu com um bloco para cada um, a diabetes primeiro, o selo e a trilha de cada tela,
// o Início em dois blocos, os velocímetros da diabetes e os estudos. Os números do Início vêm do /model/info de cada
// projeto, lidos da mesma resposta que a tela usa.

/** O selo do projeto, em cima do título da tela. */
const seloDaTela = (page: import("@playwright/test").Page) => page.getByRole("main").locator("header").getByText(/^Projeto \d · \S+$/);

test("os dois projetos no menu: um bloco para cada um, a diabetes primeiro, com as mesmas quatro telas; o selo e a trilha dizem o projeto da tela", async ({ page }) => {
  await page.goto("/");
  const menu = page.getByRole("navigation", { name: "Menu principal" });
  for (const nome of ["Diabetes", "Obesidade"]) {
    await expect(menu.getByRole("list", { name: nome, exact: true }).getByRole("link")).toHaveText(["Visão Geral", "Consulta", "Simulador", "Monitoramento"]);
  }
  await expect(menu.getByRole("list").filter({ has: page.getByRole("link", { name: "Simulador" }) })).toHaveCount(2);
  await expect(menu.getByRole("link", { name: "Simulador" }).first()).toHaveAttribute("href", "/diabetes/simulador");
  // o Início e os estudos são dos dois: sem selo
  await expect(seloDaTela(page)).toHaveCount(0);

  for (const [projeto, numero, url] of [
    ["Diabetes", 1, /\/diabetes\/simulador$/],
    ["Obesidade", 2, /\/simulador$/],
  ] as const) {
    await menu.getByRole("list", { name: projeto, exact: true }).getByRole("link", { name: "Simulador" }).click();
    await expect(page).toHaveURL(url);
    await expect(seloDaTela(page)).toHaveText(`Projeto ${numero} · ${projeto}`);
    // a trilha da barra do topo começa pelo projeto
    await expect(page.getByRole("banner").locator("p").filter({ hasText: "Simulador" })).toHaveText(`${projeto}Simulador`);
  }
});

test("o Início em dois projetos, a diabetes primeiro: o herói leva a cada um, e cada bloco tem o que é dele", async ({ page }) => {
  const lerObesidade = page.waitForResponse((r) => r.url().endsWith("/api/v1/model/info") && r.ok());
  const lerDiabetes = page.waitForResponse((r) => r.url().endsWith("/api/v1/diabetes/model/info") && r.ok());
  await page.goto("/");
  const obesidade = (await (await lerObesidade).json()) as { n_features_entrada: number; ordem_clinica: string[]; versao: string };
  const diabetes = (await (await lerDiabetes).json()) as { n_features_entrada: number; versao: string };

  const projetos = page.getByRole("list", { name: "Os dois projetos" }).getByRole("link");
  await expect(projetos).toHaveCount(2);
  await expect(projetos.nth(0)).toContainText(`${diabetes.n_features_entrada} respostas → a chance de já ter recebido o diagnóstico de diabetes`);
  await expect(projetos.nth(0)).toContainText(`modelo v${diabetes.versao}`);
  await expect(projetos.nth(1)).toContainText(`${obesidade.n_features_entrada} respostas → ${obesidade.ordem_clinica.length} faixas de composição corporal`);
  await expect(projetos.nth(1)).toContainText(`modelo v${obesidade.versao}`);

  const blocoDiabetes = page.getByRole("region", { name: "Projeto 1: Diabetes" });
  await expect(blocoDiabetes.getByRole("table", { name: "Limiar de cada grupo de idade" })).toBeAttached({ timeout: 60_000 });
  await expect(blocoDiabetes.getByRole("list", { name: "Dados e limites da triagem de diabetes" })).toContainText("BRFSS 2015");
  const blocoObesidade = page.getByRole("region", { name: "Projeto 2: Obesidade" });
  await expect(blocoObesidade.getByLabel("Métricas do modelo em teste").locator("[data-numero]")).toHaveCount(3, { timeout: 60_000 });
  await expect(blocoObesidade.getByRole("heading", { level: 2, name: "Objetivo, dados e métodos" })).toBeAttached();
  await expect(blocoObesidade.getByText(/BRFSS/)).toHaveCount(0);
  // o bloco da diabetes vem antes do da obesidade
  const topo = async (bloco: typeof blocoDiabetes) => (await bloco.boundingBox())?.y ?? 0;
  expect(await topo(blocoDiabetes)).toBeLessThan(await topo(blocoObesidade));

  // o cartão do herói leva ao bloco do projeto
  await projetos.nth(1).click();
  await expect(page).toHaveURL(/#projeto-obesidade$/);
  await expect(blocoObesidade.getByRole("heading", { level: 2, name: "Triagem de obesidade: o modelo em teste" })).toBeInViewport();
});

type InfoComReferencias = { limiares_por_idade: { recall_alvo: number }; split: { prevalencia_teste: number } };

test("o Início: as quatro métricas da diabetes com o velocímetro e a marca de referência, de /diabetes/model/info", async ({ page }) => {
  const lerInfo = page.waitForResponse((r) => r.url().endsWith("/api/v1/diabetes/model/info") && r.ok());
  await page.goto("/");
  const info = (await (await lerInfo).json()) as InfoComReferencias;
  const metricas = page.getByRole("list", { name: "Desempenho da triagem de diabetes no teste" });
  const cartoes = metricas.getByRole("listitem");
  await expect(cartoes).toHaveCount(4);
  await expect(metricas.locator("svg[data-velocimetro]")).toHaveCount(4);
  await expect(metricas.locator("line[data-referencia]")).toHaveCount(4);
  await expect(cartoes.nth(0)).toContainText("acaso: 0,5");
  await expect(cartoes.nth(0).locator("svg[data-velocimetro] text")).toHaveText(["0", "1"]);
  await expect(cartoes.nth(1)).toContainText(`alvo: ${pct(info.limiares_por_idade.recall_alvo)}`);
  await expect(cartoes.nth(2)).toContainText(`acaso: ${pct(info.split.prevalencia_teste)} (a base)`);
  await expect(cartoes.nth(3)).toContainText(`ideal: ${pct(info.split.prevalencia_teste)} (só os casos)`);
  // o ponteiro aparece quando o cartão chega à tela, como nos da obesidade
  await cartoes.nth(3).scrollIntoViewIfNeeded();
  await expect(cartoes.nth(3).locator("svg[data-velocimetro] g[opacity='1']")).toHaveCount(1);
});

test("os estudos: cada notebook leva o selo do projeto dele, a diabetes primeiro, e o notebook aberto também", async ({ page }) => {
  await page.goto("/estudos");
  const notebooks = page.getByRole("main").getByRole("list").first().getByRole("link");
  await expect(notebooks.first()).toContainText("Projeto 1 · Diabetes", { timeout: 60_000 });
  await expect(page.getByRole("link", { name: /Comparação de modelos/ })).toContainText("Projeto 2 · Obesidade");
  const diabetes = page.getByRole("link", { name: /Triagem de diabetes/ });
  await diabetes.click();
  await expect(page).toHaveURL(/\/estudos\/triagem-de-diabetes$/);
  await expect(seloDaTela(page)).toHaveText("Projeto 1 · Diabetes", { timeout: 60_000 });
});
