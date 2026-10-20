# Redesenho do front

Documento de especificação do redesenho geral de `frontend/src` (ADR 0010). Ele não contém código
de produção: contém o diagnóstico medido, os valores, as regras e as classes que a implementação
usa. Toda cor citada é um trio HSL cru no formato dos tokens de `frontend/src/shared/tema/tokens.css`
(sem `hsl()` em volta); o hex ao lado é só para conferência.

**Base medida.** Stack local do `docker compose` (a mesma imagem `web` de produção: nginx com a CSP
de `frontend/seguranca.conf`), commit `df85de5`, Chromium do Playwright 1.64, viewports
**1440×900** e **390×844**, temas claro e escuro, em 2026-10-18. As sete telas: `/`, `/painel`,
`/consulta`, `/simulador`, `/monitoramento`, `/estudos`, `/estudos/comparacao-de-modelos`.
Cada número abaixo vem de `getBoundingClientRect`/`getComputedStyle` na página viva; as capturas
ficaram fora do repositório.

**Largura útil hoje** (`app.tsx:71-97`): trilho de **96 px** + `main` com `sm:px-6`. Em 1440 sobram
**1.296 px**; o grid de 12 colunas com `gap-3` dá colunas de **97 px**. Os cartões da Visão Geral
medem: nível **424**, gênero **315**, IMC por gênero **206**, calóricos **315** (faixa central);
dispersão **533**, atividade **424**, álcool **315** (faixa inferior). Esses números mandam em quase
todo defeito do painel.

---

## 1. Diagnóstico, item a item

### 1.1 Divisão por Gênero: as duas colunas se sobrepõem — CONFIRMADO

**`features/painel/PainelPage.tsx:35`** dá ao painel de gênero `col-span-3` = **315 px**, e
**`features/painel/PainelGenero.tsx:53`** divide isso em `sm:grid-cols-2`. O `sm:` é da **viewport**
(640 px), não do cartão: em 1440 ele sempre dispara. Cada `<article>` fica com **135 px**, mas o
conteúdo pede **178 px** (`scrollWidth`): o selo de percentual (`text-xl`, `PainelGenero.tsx:15`) e a
`<dl>` de duas colunas não cabem.

Medido: oito elementos vazam do próprio pai (`dd` "1.043", "30,1", "Obesidade III (n = 323)" vazam
**55 px**; o selo "49,4%" vaza **46 px**) e três pares de texto se sobrepõem: "49,4%" × "Masculino"
(10×24 px), "1.043" × "Registros" (19×20 px), "30,1" × "IMC médio" (19×20 px). Na captura, "Nível
predominante" da coluna masculina é escrito por cima de "Obesidade III" da feminina.

### 1.2 IMC Médio por Gênero numa coluna de 206 px — CONFIRMADO

**`PainelPage.tsx:38`** (`col-span-2`). O título "IMC Médio por Gênero" quebra em **4 linhas**, a
descrição em 5 ("Média do / IMC no / recorte; o / eixo começa / em zero."), e os rótulos "Feminino" e
"Masculino" do eixo X encostam um no outro. Sobra um gráfico de ~150 px de largura para duas
colunas — o visual mais estreito da tela é o que tem o título mais comprido.

### 1.3 Rótulos de eixo a 16 px e cortados — CONFIRMADO, com número

`docs/design-tokens.md` diz "tick de eixo: 12 px". **Todos** os ticks medem **16 px**. A regra que
deveria valer, **`shared/tema/tokens.css:142-145`** (`.recharts-cartesian-axis-tick text`), não casa
com o DOM do Recharts 3: o `<g class="recharts-cartesian-axis-tick">` contém só a linha do tick, e o
texto vive em `.recharts-cartesian-axis-tick-value`, noutro grupo. A regra é código morto, e os
gráficos foram dimensionados (larguras de `YAxis` fixas) como se a fonte tivesse 12 px.

Consequências medidas em 1440 e iguais em 390:

| gráfico | o que acontece | onde |
|---|---|---|
| IMC por álcool | "Frequentemente" cortado **10 px** à esquerda (aparece "requentemente") | `ImcPorAlcool.tsx:58`, `width={110}` |
| Barras por nível | "Abaixo do Peso" cortado 2 px | `BarrasPorNivel.tsx:56`, `width={112}` |
| Dispersão | "109 kg", "144 kg" e "175 kg" quebram em **duas linhas** (`<tspan>`); "175 kg" sai 7 px acima do SVG; "39 kg" e "74 kg" cortados 3 px à esquerda; "39 kg" encosta em "1,40 m" no canto | `DispersaoAlturaPeso.tsx:87-96`, `width={44}` + `unit=" kg"` em cada tick |

### 1.4 Eixos da dispersão com escala que não é redonda — CONFIRMADO

**`DispersaoAlturaPeso.tsx:33-41`** usa como domínio o mínimo e o máximo de `/metadata` (39 e
175 kg; 1,45 e 1,98 m arredondados para o padrão 1,4–2,0). O Recharts divide em partes iguais e os
ticks saem **39 / 74 / 109 / 144 / 175 kg**: nenhum múltiplo de 10, impossível de ler de cabeça. A
marca mede **9 px**, são 2.000 pontos opacos em quatro formas diferentes (círculo, quadrado,
losango, triângulo): a faixa de obesidade é uma mancha sólida, e a forma — o "segundo canal" — vira
textura. Nada no gráfico diz por que as classes aparecem em faixas diagonais.

### 1.5 A categoria suprimida some do gráfico de álcool — CONFIRMADO

**`ImcPorAlcool.tsx:29-32`**: com `n < 15`, `valor` vira 0 e o rótulo vira "n < 15". Mas uma barra de
largura 0 não desenha rótulo: o gráfico tem **4 categorias e 3 rótulos** ("31,0", "27,1", "27,0").
"Sempre" aparece no eixo com nada ao lado — indistinguível de um IMC zero ou de um erro. A tabela
"Ver dados" diz "n < 15"; o gráfico, não.

### 1.6 Hierarquia plana e um cartão decorativo no lugar de um KPI — CONFIRMADO

**`FaixaKpis.tsx:21-49`**: seis cartões idênticos (`text-3xl`, 30 px), e o sexto é a `<Marca>` — um
logotipo ocupando uma vaga de indicador. Nada é maior, nada é primeiro. O recorte, que é o número
que muda com cada clique, está no canto direito do cabeçalho em `text-sm` (`PainelPage.tsx:26-28`).

Em 390 os seis cartões empilham em largura total: o **primeiro gráfico começa em 769 px** e a página
tem **4.016 px** de altura.

### 1.7 Linhas com cartões de alturas diferentes — CONFIRMADO

`ChartFrame` fixa a altura do gráfico (`shared/ui/ChartFrame.tsx:47`) e o grid cresce com o maior
item, então cada linha termina num degrau:

| cartão | altura do cartão | altura da linha | buraco embaixo |
|---|---|---|---|
| Divisão por nível | 398 | 518 | **120 px** |
| Calóricos | 438 | 518 | 80 px |
| Dispersão | 438 | 478 | 40 px |
| Atividade física | 462 | 478 | 16 px |

O título de "Calóricos" quebra em 2 linhas e o de "IMC por gênero" em 4: a altura do cabeçalho de
cada cartão é diferente, e o gráfico começa numa altura diferente em cada um.

### 1.8 Trilho lateral tosco, e "Limpar filtros" fora da tela — CONFIRMADO

**`app.tsx:71-94`**: coluna fixa de **96 px**, rótulos de **11 px**, item ativo como bloco sólido de
`--primaria`, sem marca, sem agrupamento, sem recolher. O `<nav>` não é *sticky*: ele tem a altura da
página (1.243 px no painel), e "Limpar filtros" e o botão de tema ficam **no pé** dele. Em 1440×900,
"Limpar filtros" está em **y = 1.135 px — fora da dobra**: no painel, o controle que desfaz o
filtro só aparece depois de rolar até o fim, longe dos gráficos que ele comanda. O rótulo quebra em
duas linhas ("Limpar / filtros").

Em 390 o trilho vira uma barra de **8 ícones sem rótulo** (só `aria-label`) e a tela não diz em
que página se está até o `<h1>`.

### 1.9 Defeito funcional: o tema não sobrevive em produção — CONFIRMADO

**`frontend/index.html:10-19`** aplica o tema com um `<script>` **em linha**. A CSP de
**`frontend/seguranca.conf:7`** é `script-src 'self'`: o navegador bloqueia o script em **toda** tela
(erro no console: *"Executing inline script violates the following Content Security Policy
directive 'script-src 'self''"*). O `data-theme` nunca é escrito na carga. Dois efeitos, medidos:

1. **Sistema escuro, nenhuma escolha salva:** a página fica escura pela `@media`, mas
   **`shared/tema/BotaoTema.tsx:7-9`** lê `data-theme` (nulo) e conclui "claro". O botão anuncia
   "Mudar para tema escuro" com a tela já escura, e o **primeiro clique não muda nada** (fundo
   `rgb(15, 22, 38)` antes e depois).
2. **Escolha salva "claro", sistema escuro:** a escolha é ignorada a cada recarga — a página abre
   **escura** (`rgb(15, 22, 38)`) com `localStorage.tema = "light"`.

Em desenvolvimento (Vite, sem CSP) nada disso aparece; é por isso que passou.

### 1.10 A frase de dados fictícios é lida 2 a 4 vezes — CONFIRMADO

**`shared/ui/RodapeAviso.tsx:7-9`** escreve a frase visível **e** a mesma frase num `<span
class="sr-only">`: o leitor de tela lê duas vezes cada instância. Início (`InicioPage.tsx:19`) e
Simulador (`SimuladorPage.tsx:29`) ainda renderizam o `RodapeAviso` no cabeçalho, além do rodapé.

| tela | ocorrências no texto da página |
|---|---|
| `/` e `/simulador` | **4** |
| `/estudos/comparacao-de-modelos` | 3 (o notebook cita a frase) |
| demais | 2 |

No Simulador, o aviso de registro anônimo vai colado no fim dessa frase repetida, em 14 px cinza.

### 1.11 "Acordando o modelo" empurra a página a cada carga — CONFIRMADO

**`app.tsx:49-66`**: enquanto `GET /health` está pendente, a faixa aparece no topo — mesmo que a
API responda em 20 ms. Medido no painel: a faixa aparece no primeiro quadro e empurra o `<main>`
**36 px** para baixo, e some no quadro seguinte (deslocamento de layout em toda primeira visita).

### 1.12 Simulador: formulário sem ritmo e botão fora da dobra — CONFIRMADO

- **Botão "Calcular probabilidade" em y = 1.127 px** com viewport de 900 (**`FormularioTriagem.tsx:151-161`**):
  para enviar é preciso rolar além dos 16 campos; o resultado aparece no topo da coluna da direita,
  e é preciso rolar de volta para vê-lo.
- Três `<fieldset class="cartao">` (**`:98-99`**) com a `<legend>` cortando a borda superior
  (o centro da legenda está a 12 px do topo do cartão): três cartões do mesmo peso do resultado,
  sem numeração de etapa nem sequência visual.
- O campo "Nome" fica fora de qualquer grupo, solto entre o cabeçalho e o primeiro cartão.

### 1.13 O formulário é descrito por "Modelo 2.0.0" — CONFIRMADO

**`FormularioTriagem.tsx:82`** liga o `<form>` a `aria-describedby="aviso-formulario"`, e o
`id` está no `<span>` "Modelo 2.0.0" (**`:159-161`**). O leitor de tela anuncia a versão do
modelo como descrição do formulário; o aviso de registro anônimo, que é o que deveria descrevê-lo,
não está associado a nada.

### 1.14 Barras de probabilidade em duas cores, contra a especificação — CONFIRMADO

O plano (§7.5) pede **cor única**. **`BarrasProbabilidade.tsx:47`** pinta as classes de risco de
`--primaria` e as outras de `--secundaria` — dois azuis (L\* 45,3 e 38,9, contraste entre eles
1,27:1) sem legenda: uma segunda codificação sem chave de leitura. Em 390, o botão "Ver dados" do
cartão quebra em duas linhas.

### 1.15 Consulta: tabela sem polimento — CONFIRMADO

**`features/consulta/TabelaRegistros.tsx`**

- **13 de 18 colunas** visíveis em 1440 sem rolar; a 14ª ("Hist. familiar") é cortada no meio. Não há
  coluna fixa: ao rolar para a direita, a linha perde o "Nível" que a identifica. Em 390, **3 colunas**.
- **`:121`**: altura fixa de **560 px** em qualquer viewport.
- **`:141`**: botões de ordenação com **36 px** de altura (18 alvos abaixo de 44 px); indicador
  "▲/▼" em caractere de texto (`:144`) só na coluna ordenada — as outras não dizem que ordenam.
- Cabeçalho *sticky* sem fundo próprio distinguível (`bg-superficie` igual ao das linhas ímpares).
- **Defeito de dado:** três colunas ordinais mostram o **código** e não o rótulo, alinhadas à direita
  como número: "Vegetais 3", "Refeições/dia 3", "Tempo em telas 1" (`:33,39,40`). "Tempo em telas 1"
  significa "3 a 5 horas/dia" — os rótulos existem em `GET /metadata` e não são usados. O plano
  (§7.3) manda exibir o rótulo e ordenar pelo inteiro.
- Carregando: o texto "Carregando…" **substitui** a tabela inteira (`QueryState.tsx:17-22`) e o
  bloco pula; vazio: a frase "Nenhum registro no recorte." sem ação para sair dele.

### 1.16 Consulta: filtros que empilham e que o teclado não anuncia — CONFIRMADO

- Os 6 filtros ocupam **140 px** em 1440 (3×2) e, em 390, empilham: **a tabela começa em 687 px**.
- **`shared/ui/MultiSelect.tsx:113-133`**: as setas movem um "foco" que é só cor de fundo — as
  opções não são focáveis e não há `aria-activedescendant`. Quem usa leitor de tela navega sem ouvir
  a opção destacada. As caixas de seleção são caracteres "☑/☐" (`:127`).
- O resumo do gatilho diz "2 selecionado(s)", não quais.
- "Exportar CSV" no canto superior direito e "Limpar filtros" no pé do trilho (1.8): as duas ações
  sobre o recorte em extremos opostos da tela.

### 1.17 Monitoramento: um painel vazio de 512×851 px — CONFIRMADO

**`MonitoramentoPage.tsx:95-98`** + **`BarrasTreinoLog.tsx:45-51`**: sem feature escolhida, a
coluna da direita estica até a altura da tabela (**512×851 px**) para mostrar uma frase centralizada.
Na tabela (**`TabelaDeriva.tsx`**), a classificação quebra em **2 linhas nas 16 linhas**
("amostra / insuficiente"), os nomes de feature são os identificadores crus em monoespaçada de 12 px
("Consumo_Alimentos_Entre_Refeicoes"), os cabeçalhos quebram ("MÉDIA NO / LOG") e os botões de
feature têm 36 px.

### 1.18 Monitoramento: o texto da faixa ficou falso depois da ADR 0009 — CONFIRMADO

**`FaixaIndisponivel.tsx:13-14`** diz "o banco do plano gratuito hiberna por inatividade". Desde a
ADR 0009 o banco roda na VPS e **não hiberna**: se ele não responde, é reinício, deploy ou falha. A
página explica uma indisponibilidade com uma causa que não existe mais.

### 1.19 Início: hiperparâmetros na coluna errada — CONFIRMADO

**`InicioPage.tsx:57-76`**: `<dl>` de 4 colunas em que o `<dd>` dos hiperparâmetros pede
`col-span-3`. O `<dt>` cai na 3ª coluna (x = 776) e não sobra espaço: o `<dd>` desce para a linha de
baixo e começa na **1ª coluna** (x = 137), embaixo de "Features". A página não tem nenhuma chamada
para ação além de três cartões e um link sublinhado de 16 px de altura.

### 1.20 Estudos: código ilegível no tema escuro — CONFIRMADO, consequência de 1.9

`public/study/pygments.css` (gerado no build) traz **os dois** temas: o claro em `.hl` (fundo
`#f8f8f8`, identificadores simples `.n` sem cor própria) e o escuro (monokai) em
`[data-theme="dark"] .hl`. Com o script de tema bloqueado pela CSP (1.9), `data-theme` nunca é
escrito: a página fica escura pela `@media`, mas o bloco de código cai no tema **claro**, e os
identificadores herdam `--texto`, que no escuro é `#eef2fb`. **Contraste de ~1,04:1** — `Path`,
`SMOTE`, `pd`, os nomes de variável somem dentro do bloco claro. Corrigido 1.9, o tema escuro do
realce volta a valer; nada no CSS gerado precisa mudar.

Mais:

- **`outputs/HtmlOutput.tsx:7`** tira o `<style>` dos DataFrames e nada repõe: `td` com
  **padding 0** — "GenderAgeHeightWeightfamily_history" vira uma palavra só.
- **`CellCode.tsx:36-42`**: "Ocultar saída" é um texto sublinhado de **11 px** numa coluna de 64 px,
  quebrado em duas linhas.
- Sumário com links de 24 px de altura; o item ativo é só negrito.

### 1.21 Estados: "Carregando…" em texto e erro sem saída — CONFIRMADO

**`shared/ui/QueryState.tsx:17-31`**: carregar é a palavra "Carregando…" centralizada (e "…" nos
KPIs, `KpiCard.tsx:20`); erro é uma linha vermelha **sem "Tentar novamente"**. Como o
`QueryClient` tem `retry: 0` (`main.tsx:14`, de propósito: 429 nunca vira laço), uma consulta que
falhou fica falhada até trocar de página. O *fallback* das rotas *lazy* é um `<p>` sem estilo
(`routes.tsx:11`) e a troca de rota não tem indicador.

### 1.22 Cor: rampa das faixas sem degrau de luminância no escuro — CONFIRMADO, com número

A dispersão pinta por macro-faixa (`--faixa-*`). L\* medido:

| faixa | claro (hex, L\*) | escuro (hex, L\*) | contraste com a anterior (escuro) |
|---|---|---|---|
| abaixo | `#4f8fe6` 59,0 | `#7fb0ff` 71,4 | — |
| normal | `#1f8a4c` 50,7 | `#4fc27a` 70,6 | **1,02:1** |
| sobrepeso | `#c77700` 57,4 | `#f0a63c` 73,6 | **1,10:1** |
| obesidade | `#c0392b` 44,7 | `#ef6b5e` 61,4 | 1,47:1 |

No escuro, as três primeiras faixas têm **a mesma luminância** (ΔL\* de 0,8 e 3,0): só a matiz as
separa, e verde × âmbar é exatamente o par que some na deuteranopia. No claro a ordem de L\* nem é
monótona (59 → 51 → 57 → 45): não é uma rampa ordinal, é uma paleta categórica.

Os sete tokens `--nivel-1…7` são **código morto** (`useChartTheme.ts:37-40` monta `corDoNivel` e
nenhum componente o lê), e `--nivel-3` (`#e0a200`) teria **2,25:1** contra o branco — abaixo do
3:1 que marcas gráficas pedem.

### 1.23 Alvos de toque abaixo de 44 px — CONFIRMADO

Medidos em 1440: "Ver dados" **91×36** (6 no painel, 1 no simulador); botões da legenda com **16 px**
de altura (11 no painel); ordenação da tabela 36 px (18); botões de feature do monitoramento 36 px
(16); "Ocultar saída" 37 px; links do sumário 24 px.

---

## 2. Grade e hierarquia propostas

Princípio: **cada tela responde uma pergunta na dobra, e cada controle fica ao lado do que comanda.**

### 2.1 Casca (`AppShell`)

| peça | desktop (≥ 1024) | celular (< 1024) |
|---|---|---|
| navegação | barra lateral **15rem**, recolhível para **3.5rem** (trilho de ícones com dica); escolha no `localStorage` em try/catch, padrão expandido | gaveta modal (Radix Dialog) aberta por um botão na barra do topo |
| marca | símbolo + "Triagem Metabólica" no topo da barra lateral | na barra do topo |
| grupos | o **Início** · um bloco por projeto, **Obesidade** e **Diabetes**, cada um com Visão Geral, Consulta, Simulador e Monitoramento · **Estudos** ([ADR 0016](decisoes/0016-dois-projetos-no-front.md); antes, Painel, Modelo e Estudos) | idem |
| barra do topo | *sticky*, `h-14`: estado da API (selo) e tema | + botão do menu e marca |
| cabeçalho da tela | `PageHeader` dentro do conteúdo: o selo do projeto da tela (ADR 0016), título, descrição, ações à direita | ações quebram abaixo do título |
| rodapé | `RodapeAviso` (a frase, **uma** vez por tela) | idem |

Largura útil em 1440: 1440 − 240 − 2×32 = **1.136 px** (expandido) ou 1440 − 56 − 64 = **1.320 px**
(recolhido). O conteúdo não tem `max-width`: o painel usa a largura toda.

O estado da API sai da faixa que empurra a página (1.11) e vira um **selo na barra do topo**:
"Modelo pronto" (ponto `--success`), "Acordando o modelo…" (ponto `--warning` pulsando) ou "API
indisponível" (`--destructive`). Mesmo texto, nenhum deslocamento de layout; o aviso de reinício
ou deploy da ADR 0009 continua visível.

"Limpar filtros" sai do trilho e vai para o **cabeçalho das duas telas que filtram** (painel e
consulta), ao lado de uma linha de *chips* com os filtros ativos (cada um removível). O atalho Esc
continua valendo nas duas telas.

### 2.2 Visão Geral

**Linha 1 — um titular e quatro apoios** (substitui os seis cartões iguais):

```
grid grid-cols-2 gap-4 lg:grid-cols-4 xl:grid-cols-[1.5fr_1fr_1fr_1fr_1.25fr]
```

- **Titular** "Registros no recorte" (`col-span-2` até `lg`): número em `text-4xl font-semibold
  tabular-nums`, linha de contexto "de 2.111 na base · 100,0%" e uma barra fina da fração do
  recorte. Fundo `bg-gradient-to-br from-primary/10 via-card to-card` com `ring-1 ring-primary/20`.
- **Apoios**: idade, altura, peso (número `text-2xl`) e nível predominante (texto `text-lg`, com
  "n = 351" embaixo).
- A `<Marca>` sai da faixa de KPIs e vira a marca da barra lateral (2.1): continua na tela, fora de
  uma vaga de indicador.

Em 390: titular na largura toda e apoios em 2×2 — o primeiro gráfico sobe de 769 px para ~470 px.

**Linhas 2 a 4 — gráficos em 12 colunas** (`grid gap-4 md:grid-cols-2 xl:grid-cols-12`):

| linha | cartão | `xl:col-span` | largura em 1440 (expandido) | altura mínima do gráfico |
|---|---|---|---|---|
| 2 | Divisão por Nível de Obesidade | 7 | 656 px | 300 |
| 2 | Consumo de Alimentos Calóricos | 5 | 464 px | 240 + legenda |
| 3 | Divisão por Gênero | 5 | 464 px | (sem gráfico) |
| 3 | IMC Médio por Gênero | 3 | 272 px | 240 |
| 3 | IMC Médio por Consumo de Álcool | 4 | 368 px | 240 |
| 4 | Altura, Peso e o Nível de Obesidade | 7 | 656 px | 340 + legenda |
| 4 | IMC Médio por Frequência de Atividade Física | 5 | 464 px | 300 + legenda |

Entre 768 e 1279 px, duas colunas (`md:col-span-2` para nível, dispersão e atividade); abaixo de
768, uma. Todo cartão é `h-full flex flex-col` e a área do gráfico é `flex-1` com altura mínima: os
cartões de uma linha têm a mesma altura e os gráficos crescem até o fundo, sem degrau embaixo (1.7).
Título e descrição vão em até duas linhas (`line-clamp-2`), e o "Ver dados" vira um botão só de
ícone, com o nome no `aria-label` e numa dica, para o título caber no cartão de 272 px (1.2).

**Divisão por Gênero** fica na linha 3, ao lado de "IMC por gênero": o conteúdo dela (≈ 250 px) tem a
altura dos gráficos dessa linha, e não sobra o vazio que sobraria ao lado das barras por nível.

**Divisão por Gênero** deixa de ser duas colunas espremidas (1.1): uma barra 100% (Feminino |
Masculino, nas cores da entidade) com os percentuais grandes em cima, e embaixo uma **tabela** de
três linhas (Registros, IMC médio, Nível predominante) × duas colunas (Feminino, Masculino). A
tabela distribui a largura pelo conteúdo e o nível quebra dentro da própria célula.

### 2.3 Consulta

1. `PageHeader` com "Limpar filtros" e "Exportar CSV" (botão com ícone) nas ações.
2. Cartão **Filtros**: `grid gap-4 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-6`. Abaixo de 768 px
   o cartão abre recolhido ("Filtros · 2 ativos"), e a tabela sobe de 687 px para ~330 px.
3. Cartão **Registros**: barra de ferramentas (total, página x de y, anterior/próxima com ícone) e a
   tabela no padrão `ui/table` — cabeçalho `bg-muted` *sticky* com 44 px, ícone de ordenação em
   todas as colunas (`ArrowUpDown` neutro, `ArrowUp`/`ArrowDown` na ativa), zebra `bg-muted/40`,
   *hover* de linha, **primeira coluna fixa** à esquerda, nível com o ponto da cor da faixa, e altura
   `clamp(360px, 100vh − 300px, 680px)`. Continua virtualizada (TanStack Virtual) e com ordenação e
   paginação no servidor.

### 2.4 Simulador

`xl:grid-cols-[minmax(0,7fr)_minmax(0,5fr)]`, resultado **sticky** (`xl:sticky xl:top-20`).

- O formulário é **um** cartão com três seções numeradas (1 · Dados iniciais, 2 · Dieta, 3 ·
  Hábitos), separadas por `Separator`, campos em `sm:grid-cols-2 gap-x-4 gap-y-5`.
- O aviso de registro anônimo vira um `Alert` no topo do cartão, e é **ele** o `aria-describedby` do
  formulário (1.13). O nome opcional entra como primeiro campo da seção 1.
- O botão de enviar fica numa barra **sticky no pé do cartão**: visível em qualquer ponto da rolagem.
- Resultado: estado vazio com ícone e instrução; *skeleton* enquanto a predição está em voo; depois,
  classe estimada (titular), risco acumulado com cor condicional e barra de progresso, IMC com a
  faixa. Barras de probabilidade em **cor única** (`--primary`), com a classe prevista em opacidade
  cheia e as demais a 50% — a mesma cor, só ênfase.

### 2.5 Monitoramento

`PageHeader` com a janela (7/30/90 dias) num *segmented control* (rádio do Radix) nas ações; uma
faixa de 5 fatos (modelo, snapshot, janela, predições/mínimo, atualizado em); tabela
`xl:col-span-7` e detalhe `xl:col-span-5 self-start`, com estado vazio compacto (1.17). A feature
aparece pelo **rótulo de `/metadata`** ("Atividade física semanal"), com o nome da coluna em
monoespaçada pequena embaixo; a classificação vira `Badge` de uma linha.

### 2.6 Início

Herói com título, parágrafo e duas ações ("Abrir o simulador", "Explorar a visão geral"); três KPIs
de `/model/info`; cartão do modelo com pares rótulo/valor **empilhados** (o rótulo em cima do valor,
em 2 ou 4 colunas: nenhuma coluna sobra para o `col-span` errar, 1.19) e os hiperparâmetros como
*chips*; três cartões de navegação e o cartão do notebook.

### 2.7 Estudos

Lista em cartões; no notebook, sumário *sticky* com rolagem própria, item ativo com barra lateral
`border-l-2 border-primary`, links de 44 px; o realce do código volta ao tema certo (1.20, 3.5);
DataFrames com o estilo de `ui/table`; o alternador de saída vira botão `ghost` com ícone.

---

## 3. Escala de cor

### 3.1 Tokens de tema (trios HSL, claro / escuro)

Mesmos nomes do padrão shadcn/ui da referência, porque os componentes de `ui/` os pressupõem.
Contraste medido contra o cartão (`--card`) de cada tema:

| token | claro | escuro | contraste (claro / escuro) |
|---|---|---|---|
| `--background` | `220 25% 97%` | `222 40% 8%` | — |
| `--foreground` | `222 47% 16%` | `220 40% 96%` | 15,9 / 16,0 |
| `--card`, `--popover` | `0 0% 100%` | `222 35% 11%` / `222 33% 13%` | — |
| `--muted` | `220 25% 95%` | `222 25% 17%` | — |
| `--muted-foreground` | `222 14% 40%` | `220 16% 68%` | 6,3 / 7,5 |
| `--primary` | `223 69% 53%` | `225 85% 70%` | 5,3 / 6,0 |
| `--primary-foreground` | `0 0% 100%` | `222 47% 10%` | 5,3 / 6,2 sobre a primária |
| `--accent` | `223 80% 96%` | `225 40% 20%` | — |
| `--destructive` | `5 65% 45%` | `5 85% 66%` | 5,7 / 5,9 |
| `--success` | `145 63% 30%` | `145 55% 52%` | 5,2 / 8,2 |
| `--warning` | `32 95% 36%` | `36 92% 58%` | 4,5 / 8,9 |
| `--border` | `220 22% 88%` | `222 22% 22%` | — |
| `--input` | `220 20% 80%` | `222 20% 30%` | — |
| `--ring` | = `--primary` | `225 90% 75%` | — |
| `--sidebar-*` | fundo `0 0% 100%`, ativo `223 80% 96%` | fundo `222 40% 10%`, ativo `225 40% 20%` | — |

`--primary` claro é `#3463da`: o mesmo azul herdado (`#3262DA`) da paleta provisória de F15, que
fica como âncora da marca. A paleta deixa de ser "derivada à espera das fotos" e passa a ser a
paleta do produto (ADR 0010); `design-tokens.md` perde o PROVISÓRIO.

### 3.2 Rampa ordinal das macro-faixas — tema claro

Alvo: **ΔL\* ≈ 10** entre degraus, ordem monótona de luminância (mais IMC = mais escuro), e toda
marca com **≥ 3:1** contra o cartão. A matiz caminha do frio ao quente, então a ordem também se lê
pela matiz, e a forma da marca continua como segundo canal (§7.3).

| faixa | HSL | hex | L\* | contraste c/ o cartão | contraste c/ a anterior |
|---|---|---|---|---|---|
| abaixo do peso | `200 85% 47%` | `#129ade` | 60,3 | 3,14:1 | — |
| peso normal | `165 75% 30%` | `#138669` | 49,7 | 4,53:1 | 1,44:1 |
| sobrepeso | `30 92% 30%` | `#934c06` | 40,3 | 6,39:1 | 1,41:1 |
| obesidade | `350 72% 32%` | `#8c172a` | 30,4 | 9,22:1 | 1,44:1 |

Hoje os pares adjacentes ficam entre 1,26 e 1,57:1 e a luminância sobe e desce; com a rampa, todos
ficam entre **1,41 e 1,44:1**, na ordem.

### 3.3 Rampa das macro-faixas — tema escuro

Corre na **direção oposta** (mais IMC = mais luminoso): sobre um cartão de L\* 8,4, o mais saliente
é o mais claro, e a faixa de maior risco continua sendo a que mais aparece nos dois temas.

| faixa | HSL | hex | L\* | contraste c/ o cartão | contraste c/ a anterior |
|---|---|---|---|---|---|
| abaixo do peso | `205 80% 41%` | `#1576bc` | 48,1 | 3,69:1 | — |
| peso normal | `162 62% 39%` | `#26a17c` | 59,3 | 5,46:1 | 1,48:1 |
| sobrepeso | `36 92% 50%` | `#f5970a` | 70,5 | 7,85:1 | 1,44:1 |
| obesidade | `352 100% 86%` | `#ffb8c1` | 81,4 | 10,83:1 | 1,38:1 |

Contra os ΔL\* de 0,8 e 3,0 de hoje (1.22), os degraus passam a valer **~11 L\*** cada.

A mesma rampa vale para **toda** representação de faixa: a dispersão, o ponto do nível na tabela da
consulta e o cartão de IMC do simulador (Abaixo → abaixo; Peso Ideal → normal; Sobrepeso →
sobrepeso; Obesidade I–III → obesidade). A cor segue a entidade, não o componente.

### 3.4 Pares categóricos e cor única

| uso | claro | escuro | observação |
|---|---|---|---|
| `--feminino` | `338 66% 52%` (4,6:1) | `338 85% 70%` (6,5:1) | regra legítima herdada (§7.3) |
| `--masculino` | `215 75% 55%` (4,0:1) | `213 90% 70%` (7,5:1) | idem |
| barras de uma série (nível, probabilidade, log) | `--primary` | `--primary` | cor única |
| segunda série (álcool, treino × log) | `--secundaria` `207 100% 33%` (6,7:1) | `207 75% 60%` (6,3:1) | |
| "Sim" do donut | `--primary` | `--primary` | regra herdada |
| "Não" do donut | `--muted-foreground` | `--muted-foreground` | |
| grade / eixo | `--border` / `--muted-foreground` | idem | ticks a 12 px por *prop* |

`--nivel-1…7` saem (código morto, 1.22).

### 3.5 Código e figuras dos Estudos

O realce do código **não** ganha token: `pygments.css` já é gerado com o tema claro (`default`) e o
escuro (`monokai`, preso a `[data-theme="dark"]`), e a correção de 1.9 basta para o escuro valer.
As figuras PNG dos notebooks (fundo branco do matplotlib) ficam sobre uma folha clara nos dois temas
— `--papel: 220 20% 97%` —, para não virarem um retângulo aceso solto no cartão escuro.

---

## 4. Componentes

shadcn/ui portado para o **Tailwind v4** do projeto: sem `tailwind.config.ts`; os tokens são trios HSL
em `:root`/`[data-theme="dark"]` e o `@theme inline` de `tokens.css` declara
`--color-<nome>: hsl(var(--<nome>))`, o que faz `bg-primary/10` funcionar (o v4 resolve a opacidade
com `color-mix`). `--color-*: initial` continua apagando a paleta padrão.

| pasta | componentes |
|---|---|
| `shared/ui/` (padrão shadcn) | `button`, `card`, `badge`, `alert`, `skeleton`, `separator`, `tooltip`, `sheet` (gaveta, Radix Dialog), `popover`, `segmented-control` (rádio do Radix), `table`, `input`, `label`, `native-select`, `sonner`; e os do produto: `KpiCard`, `MultiSelect`, `GrupoDeAlternancia`, `Marca`, `RodapeAviso` |
| `shared/layout/` | `AppShell`, `Sidebar`, `Topbar`, `PageHeader`, `navegacao.ts`, `menuLateral.ts`, `SeletorDeTema` |
| `shared/estados/` | `EstadoVazio`, `ErroInline` (com "Tentar novamente"), `QueryState` (skeleton na primeira carga, opacidade no *refetch*) |
| `shared/graficos/` | `ChartFrame`, `TooltipGrafico`, `LegendaHtml`, `TabelaEquivalente`, `eixos.ts` (props de eixo com 12 px) |

Ícones: `lucide-react` (o mesmo da referência), importados um a um. A marca continua um SVG próprio.
Toasts: `sonner`, montado uma vez, com o tema do app.

**Toasts usados** — só para o que não tem lugar fixo na tela:

| evento | toast |
|---|---|
| filtros limpos (botão ou Esc) | "Filtros limpos" + ação **Desfazer** (volta uma entrada do histórico: os filtros moram na URL) |
| link do recorte copiado | "Link do recorte copiado" |
| relatório baixado / falhou | sucesso com o nome do arquivo / erro com a mensagem do envelope da API |
| 429 do simulador | aviso com os segundos — **além** da faixa fixa do formulário, que continua (§6.8.3) |

## 5. Gráficos

1. **Tipografia por *prop*, não por CSS**: todo eixo recebe `tick={{ fontSize: 12, fill }}` de
   `eixos.ts`; a regra morta de `tokens.css` sai (1.3).
2. **Largura do eixo de categorias medida pelo rótulo**: `larguraDoRotulo(rotulos)` estima a largura
   em 12 px (7 px por caractere + 12 de folga) — "Frequentemente" deixa de ser cortado.
3. **Domínios redondos**: a dispersão usa `[30, 180]` kg em passos de 30 e `[1,4; 2,0]` m em passos
   de 0,1, derivados de `/metadata` por arredondamento (nunca escritos à mão); a unidade sai dos
   ticks e vai para o rótulo do eixo ("Peso (kg)", "Altura (m)").
4. **Supressão visível**: categoria com `n < 15` desenha o texto "amostra < 15" no início da barra,
   em `--muted-foreground` (1.5).
5. **Dispersão**: pontos de área 16, `fillOpacity` 0,5–0,62, sempre círculo. O segundo canal deixa
   de ser a forma da marca (textura a 9 px, 1.4) e passa a ser as **linhas de IMC**
   18,5 · 25 · 30 · 35 · 40 (`peso = IMC × altura²`, tracejadas, rotuladas na borda direita): elas
   mostram de onde vêm as faixas diagonais — o nível é, quase todo, o IMC — e separam Obesidade
   I, II e III, que dividem a mesma cor da macro-faixa. A legenda traz as 4 macro-faixas e a linha.
6. **Tooltip HTML** comum (`TooltipGrafico`): título, uma linha por série com amostra da cor,
   `bg-popover` com borda e sombra — legível nos dois temas; continua declarado fora do render.
7. **Legenda HTML** em *chips* com alvo de 44 px (pseudo-elemento), `aria-pressed` quando filtra.
8. Mantido: cor pela entidade, *cross-highlight* por `fillOpacity` em `<Cell>`, domínio sem
   *cross-filter*, `interval={0}`, `isAnimationActive={false}`, "Ver dados" com a
   `<TabelaEquivalente>` em todo gráfico.

## 6. Estados

| estado | como fica |
|---|---|
| primeira carga | `Skeleton` com a forma do conteúdo (barras, rosca, linhas de tabela, KPIs) |
| *refetch* | o quadro anterior em `opacity: .55` — nunca *skeleton* (§7.3) |
| erro | `ErroInline` (Alert destrutivo) com a mensagem do envelope e **Tentar novamente** (`refetch`), dentro do cartão que falhou |
| vazio | `EstadoVazio` com ícone, título, o que fazer e uma ação ("Limpar filtros" no painel e na consulta) |
| monitoramento indisponível | faixa de aviso (`role="status"`, nunca erro), com texto correto para a VPS (1.18) |
| rota *lazy* | barra de progresso fina no topo do conteúdo enquanto `useNavigation()` carrega; *fallback* com o esqueleto da casca |

## 7. Responsivo

| largura | casca | Visão Geral | Consulta | Simulador |
|---|---|---|---|---|
| 390 | gaveta + barra do topo | titular + apoios 2×2; gráficos em 1 coluna | filtros recolhidos; tabela com 1ª coluna fixa | 1 coluna; botão no pé do cartão |
| 768 | idem | 2 colunas | filtros em 2 colunas | 1 coluna |
| 1024 | barra lateral | 2 colunas | 3 colunas | 1 coluna |
| 1280+ | barra lateral | 12 colunas (2.2) | 3 colunas; 6 em 1536 | 2 colunas, resultado *sticky* |

## 8. O que continua igual (portões)

- Camada de dados intocada: `shared/api/endpoints/*`, `http.ts` (`X-Origem-Cliente: painel`,
  `VITE_API_URL` relativo em produção), `schema.d.ts` gerado, `useFiltros` (nuqs), `useAgregado`,
  `useCrossFilter`, ordem clínica, zod + react-hook-form, métricas de `/model/info`.
- Acessibilidade de F13/F14: tabela equivalente em todo gráfico, legenda em HTML, foco visível
  (`ring-2 ring-ring ring-offset-2`), `aria-live` do recorte, Esc limpa filtros, 44 px.
- A frase de dados fictícios literal e contígua em `RodapeAviso.tsx`, no rodapé de toda tela — agora
  **uma** vez por tela (1.10) — e o aviso de registro anônimo no simulador.
- Cor literal só em `tokens.css`; os dois *greps* da seção ANCORA vazios.
- Rotas iguais: `nginx.conf` e `verificar-stack.sh` não mudam.

---

## Apêndice — mudanças por arquivo

| arquivo | o que muda |
|---|---|
| `index.html` + `public/tema-inicial.js` | o script de tema sai de linha para um arquivo do próprio site (`script-src 'self'`): 1.9 |
| `shared/tema/tokens.css` | tokens HSL claro/escuro (3.1), rampas (3.2–3.3), papel das figuras (3.5), `@theme inline` com `--color-*: hsl(var(--*))`, estilos de DataFrame, sem a regra morta de tick |
| `shared/tema/useTema.ts` (novo) | fonte única do tema (substitui `BotaoTema.tsx`), lida do `data-theme` que o script já escreveu |
| `shared/tema/useChartTheme.ts` | lê os trios e devolve `hsl(...)`; sai `corDoNivel` |
| `shared/ui/*` | componentes shadcn (seção 4); saem `KpiCard`, `ChartFrame`, `MultiSelect` e `SegmentedControl` antigos (reescritos) e `icones/` (lucide + `Marca`) |
| `shared/ui/RodapeAviso.tsx` | a frase uma vez, sem a cópia `sr-only` (1.10) |
| `app.tsx` | `AppShell` (2.1); o selo de estado da API substitui a faixa (1.11) |
| `features/painel/*` | grade de 2.2, `FaixaKpis` com titular, `PainelGenero` em barra + tabela, eixos de 5, supressão visível |
| `features/consulta/*` | 2.3; rótulos de `/metadata` nas colunas ordinais (1.15); `MultiSelect` com `aria-activedescendant` (1.16) |
| `features/simulador/*` | 2.4; `aria-describedby` no aviso anônimo; barras em cor única |
| `features/monitoramento/*` | 2.5; texto da faixa (1.18) |
| `features/inicio/*` | 2.6 |
| `features/estudos/*` | 2.7; DataFrames, papel das figuras |
| `e2e/*.spec.ts` | os 6 *smokes* acompanham os papéis e nomes novos |

### Ordem

1. Os defeitos funcionais: tema bloqueado pela CSP (1.9), frase repetida (1.10), descrição do
   formulário (1.13), rótulos da tabela (1.15), texto da faixa de deriva (1.18).
2. Tokens e componentes base (3, 4).
3. Casca (2.1).
4. Visão Geral (2.2) e gráficos (5).
5. Consulta, Simulador, Monitoramento, Início, Estudos.
6. Estados (6) e responsivo (7), conferidos com as mesmas medidas deste documento.
