# Tokens de design

**Origem da paleta: a marca Visor** ([ADR 0011](decisoes/0011-marca-visor.md)), manual 1.0 de
outubro de 2026. Tinta (`#201E1D`) e papel (`#F3F2F2`) fazem quase todo o trabalho; o magenta
(`#D6006C`) é reservado ao ponteiro do símbolo e ao **resultado da previsão**; grafite (`#444141`) e
visor (`#F8F4F4`) completam o símbolo. Antes disso a paleta era a do produto
([ADR 0010](decisoes/0010-redesenho-do-front.md)), com o azul herdado `#3463da` como `--primary`.

## Onde os tokens vivem

`frontend/src/shared/tema/tokens.css` é o **único** arquivo do front com cor literal. Dois portões
garantem isso (seção ANCORA do plano), ambos rodando vazios:

1. hex literal (`#[0-9a-fA-F]{3,8}`) em qualquer `*.ts`, `*.tsx` ou `*.css` fora de `tokens.css`;
2. a paleta utilitária padrão do Tailwind (`bg-slate-800`, `text-zinc-500`, …), que não contém `#`.

**Tailwind v4, configurado em CSS.** Não há `tailwind.config.ts`: os tokens são **trios HSL** sem
`hsl()` em volta, no padrão do shadcn/ui (`--primary: 223 69% 53%`), em `:root` (claro) e
`:root[data-theme="dark"]` (escuro). O bloco `@theme inline` apaga a paleta padrão
(`--color-*: initial` — `bg-slate-800` deixa de existir) e declara cada utilidade apontando para o
token, `--color-primary: hsl(var(--primary))`. O v4 resolve a opacidade (`bg-primary/10`) com
`color-mix`. A variante `dark:` é `[data-theme="dark"]` (`@custom-variant`).

**O tema** mora em `data-theme` no `<html>`, escrito antes da hidratação por
`frontend/public/tema-inicial.js` — um arquivo do próprio site, e não um `<script>` em linha, porque
a CSP de produção é `script-src 'self'`. `useTema()` lê o tema vigente do DOM (fonte única) e
`useChartTheme()` entrega os tokens como valores `hsl(...)` para o Recharts e o Plotly, que escrevem
a cor em atributo de SVG, onde `var()` não resolve de forma confiável.

## Paleta (tema claro / tema escuro)

Contraste medido contra `--card` de cada tema (`#fdfcfc` no claro, `#252322` no escuro).

| Token | Papel | Claro | Escuro | Contraste |
|---|---|---|---|---|
| `--marca-*` | as cinco cores do manual, **iguais nos dois temas** (o símbolo e o favicon) | tinta `20 4.9% 12%` · papel `0 4% 95.1%` · magenta `329.7 100% 42%` · grafite `0 2.3% 26.1%` · visor `0 22.2% 96.5%` | iguais | — |
| `--background` | fundo da página: o papel | `0 4% 95.1%` `#f3f2f2` | `30 3.8% 10.2%` `#1b1a19` | — |
| `--foreground` | texto: a tinta | `20 4.9% 12%` `#201e1d` | `0 4% 95.1%` `#f3f2f2` | 16,2 / 14,0 |
| `--card` / `--popover` | cartões, menus, balões | `0 20% 99%` `#fdfcfc` | `20 4.2% 13.9%` `#252322` / `20 3.6% 16.3%` | — |
| `--muted` | fundos de apoio, cabeçalho de tabela, esqueleto | `20 6.4% 90.8%` `#e9e7e6` | `15 4.1% 19.2%` `#33302f` | — |
| `--muted-foreground` | rótulos, descrições, ticks | `17.1 3.7% 36.7%` `#615c5a` | `15 4.8% 67.5%` `#b0aaa8` | 6,4 / 6,8 |
| `--primary` | ação principal: **tinta** sobre papel (no escuro, papel sobre tinta) | `20 4.9% 12%` | `0 4% 95.1%` | 16,2 / 14,0 |
| `--primary-foreground` | texto sobre a primária | `0 4% 95.1%` | `20 4.9% 12%` | 14,9 / 14,9 |
| `--previsao` | **o resultado da previsão** (classe estimada e a barra dela no simulador, no relatório): o único uso do magenta fora do símbolo | `329.7 100% 42%` `#d6006c` | `332.7 100% 67.6%` `#ff5aa5` | 5,0 / 5,4 |
| `--accent` / `--accent-foreground` | hover, item ativo, chips de filtro | `15 7.4% 89.4%` / tinta | `24 4.5% 21.8%` / papel | — |
| `--destructive` | erro, risco > 50% | `5 65% 45%` `#bd3528` | `5 85% 66%` `#f26b5f` | 5,5 / 5,2 |
| `--success` | risco baixo, PSI estável, API pronta | `145 63% 30%` `#1c7d44` | `145 55% 52%` `#41c879` | 5,0 / 7,3 |
| `--warning` | extrapolação, PSI em atenção, banco fora | `32 95% 34%` `#a95c04` | `36 92% 58%` `#f6a831` | 4,9 / 7,9 |
| `--border` / `--input` | bordas / borda de campo | `12 6.7% 85.3%` / `17.1 5.6% 75.5%` | `24 4.4% 22.2%` / `20 4.2% 28.2%` | — |
| `--control` | preenchimento de campo (não some no cartão escuro) | `0 20% 99%` | `20 4.8% 12.4%` | — |
| `--ring` | anel de foco (2 px, `:focus-visible`) | tinta | papel | — |
| `--zebra` | linha alternada OPACA da tabela (1ª coluna fixa) | `30 12.5% 96.9%` | `20 3.7% 15.9%` | — |
| `--overlay` | fundo da gaveta modal (a 60 %) | `20 4.9% 8%` | `20 4.9% 4%` | — |
| `--sidebar-*` | barra lateral | fundo `0 9.1% 97.8%`, ativo `15 9.1% 91.4%` | fundo tinta `20 4.9% 12%`, ativo `25.7 6.9% 19.8%` | — |
| `--papel` | folha das figuras PNG dos notebooks | `0 4% 97%` | igual | — |
| `--autor-ciano` | o chapéu do símbolo do AUTOR nos créditos (`shared/autor`), nunca cor do produto | `193.6 100% 34.5%` `#0088b0` | igual, de propósito: o manual da marca do autor pede o mesmo ciano em qualquer fundo | — |

**Por que o magenta clareia no escuro:** o `#D6006C` dá 3,2:1 sobre a tinta — serve para o traço do
símbolo (gráfico, ≥ 3:1), não para texto. No escuro, `--previsao` sobe para `#ff5aa5` (5,4:1); o
símbolo continua com o magenta do manual (`--marca-magenta`).

## Escalas dos gráficos

A cor segue a **entidade**, nunca o índice do array.

**Macro-faixas** (dispersão, ponto do nível na tabela da consulta, classe estimada e cartão de IMC do
simulador): rampa ordinal com ΔL\* ≈ 10 por degrau e toda marca ≥ 3:1 contra o cartão. No escuro a
rampa corre ao contrário — mais IMC = mais luminoso —, e a faixa de maior risco é a mais saliente
nos dois temas. Ficou como estava: é semântica (abaixo, normal, sobrepeso, obesidade), não marca.

| Token | Claro | Contraste | Escuro | Contraste |
|---|---|---|---|---|
| `--faixa-abaixo` | `200 85% 47%` `#129ade` | 3,1 | `205 80% 41%` `#1576bc` | 3,2 |
| `--faixa-normal` | `165 75% 30%` `#138669` | 4,4 | `162 62% 39%` `#26a17c` | 4,8 |
| `--faixa-sobrepeso` | `30 92% 30%` `#934c06` | 6,3 | `36 92% 50%` `#f5970a` | 6,9 |
| `--faixa-obesidade` | `350 72% 32%` `#8c172a` | 9,0 | `352 100% 86%` `#ffb8c1` | 9,6 |

Na dispersão, o segundo canal são as **linhas de IMC** 18,5 · 25 · 30 · 35 · 40 (`LIMITES_IMC` em
`shared/dominio.ts`), e não mais a forma da marca.

**Os 7 níveis** (Visão Geral: barras por nível, dispersão, KPIs de excesso de peso e obesidade,
pirâmide e fatores associados): a **família** dá a matiz — a mesma das macro-faixas, as cores das 7
faixas do Início — e o **grau** dá o passo do degradê dentro dela. No claro, mais grave = mais escuro;
no escuro, mais luminoso. Abaixo do peso e peso normal têm um grau só e repetem a macro-faixa.

| Token | Claro | Contraste | Escuro | Contraste |
|---|---|---|---|---|
| `--nivel-abaixo` | `200 85% 47%` `#129ade` | 3,1 | `205 80% 41%` `#1576bc` | 3,2 |
| `--nivel-normal` | `165 75% 30%` `#138669` | 4,4 | `162 62% 39%` `#26a17c` | 4,8 |
| `--nivel-sobrepeso-1` | `32.4 73.1% 46.7%` `#ce7e20` | 3,1 | `28.6 65.4% 45.3%` `#bf7028` | 4,2 |
| `--nivel-sobrepeso-2` | `30.2 96% 29.6%` `#944c03` | 6,2 | `35.4 99% 59%` `#fea92f` | 8,1 |
| `--nivel-obesidade-1` | `358.2 64% 58.6%` `#d95256` | 3,9 | `0 57.3% 54.1%` `#cd4747` | 3,4 |
| `--nivel-obesidade-2` | `351.4 66.3% 37.3%` `#9e2032` | 7,6 | `354.3 93.5% 75.9%` `#fb8893` | 6,7 |
| `--nivel-obesidade-3` | `345.6 76.7% 20.2%` `#5b0c1f` | 13,5 | `351.4 100% 90.4%` `#ffced5` | 11,2 |

Validação pelo script do dataviz (`validate_palette.js`, pares vizinhos, contra o cartão): ΔE de CVD
**9,9** no claro e **9,9** no escuro (alvo 8), ΔE de visão normal **15,7** e **16,4** (piso 15), todas
as marcas ≥ 3:1. Cada família (sobrepeso I–II, obesidade I–III) passa como rampa ordinal (`--ordinal`:
uma matiz, luminosidade monótona, degraus ≥ 0,06). O script ainda acusa a faixa de luminosidade na ponta
de cada rampa (obesidade III no claro; sobrepeso II e obesidade II–III no escuro) e o croma baixo do
rosa de obesidade III no escuro: é o esperado de uma rampa — a ponta grave é a mais saliente de
propósito —, e a regra da faixa é para paleta categórica. A dispersão pinta 7 séries, acima do teto de
3 do teste de todos os pares: lá, as linhas de IMC são o segundo canal que separa as faixas.

**Categóricas e cor única:**

| Uso | Token | Claro | Escuro |
|---|---|---|---|
| Série única (log do monitoramento, barras do simulador) | `--grafico-primaria` | grafite `0 2.3% 26.1%` (9,9:1) | `20 7.1% 83.5%` (10,6:1) |
| Segunda série (IMC por álcool, treino × log) | `--grafico-secundaria` | `10 2.5% 53.7%` (3,5:1) | `17.1 3% 54.7%` (4,6:1) |
| Classe estimada nas barras de probabilidade (as demais em grafite a 40 %) | `--previsao` | magenta | magenta claro |
| Feminino | `--feminino` | `17 82% 56%` `#eb6733` (3,1:1) | `17 70% 50%` `#d95926` (4,0:1) |
| Masculino | `--masculino` | `213 68% 50%` `#2977d6` (4,4:1) | `213 76% 56%` `#3a86e4` (4,3:1) |
| Ticks, rótulos de eixo | `--muted-foreground` | | |
| Grade e linha de eixo | `--border` | | |

O par de gênero é o laranja e o azul da paleta de referência do método de visualização, validado
pelo script dele nos dois temas (ΔE de CVD 24,7 no claro e 26,8 no escuro; o piso é 8). O rosa
herdado saiu: era quase o magenta, que a marca reserva à previsão.

As regras de cor condicional que existem: `Genero = 'Feminino'` → `--feminino`, `Masculino` →
`--masculino`; `Nivel_Obesidade` → o `--nivel-*` da classe. A regra herdada `Consumo_Calorico_Frequente
= 'Sim'` → `--grafico-primaria` saiu com a rosca de calóricos (o consumo virou um grupo do gráfico de
fatores, pintado pelos níveis). As regras condicionadas a `Fumante` do painel original são herança
morta e não foram replicadas (§7.3).

## Forma, tipografia e movimento

| Token / regra | Valor |
|---|---|
| `--radius` | 0,625 rem (`rounded-lg`); `rounded-md` = −2 px, `rounded-sm` = −4 px |
| sombra | `shadow-sm` nos cartões, `shadow-lg` em balões e toasts (as do Tailwind) |
| fonte | `--font-sans`: **Source Serif 4** (a da marca: "uma família só para nome, títulos e interface"), variável com tamanho óptico, servida do próprio site por `@fontsource-variable/source-serif-4` (a CSP é `font-src 'self'`); semibold 600 em nome, títulos e no percentual previsto, regular 400 no texto, itálico em notas. `--font-mono`: Cascadia Code, Consolas |
| título da tela (`<h1>`, um por página) | `text-[1.75rem]` semibold, `tracking-tight` |
| título de cartão | 15 px semibold, até 2 linhas |
| descrição de cartão | 13 px, `--muted-foreground`, até 2 linhas |
| número do KPI titular / de apoio | `text-[2.75rem]` / `text-2xl`, semibold, `tabular-nums` |
| rótulo de KPI e de campo de fato | `text-xs` medium, caixa alta, `tracking-wide` |
| tick e rótulo de eixo | 12 px por *prop* (`shared/graficos/eixos.ts`): o CSS não alcança o texto do tick do Recharts 3 |
| alvo mínimo de toque | 44 px: `h-11` nos controles; os compactos (36 px) usam `.alvo-toque`, que estende a área clicável a 44 px sem mudar o desenho |
| foco | `outline` de 2 px em `--ring`, deslocado 2 px, em todo `:focus-visible` |
| refetch | o quadro anterior em `opacity: .55` (`.refetching`) — nunca *skeleton* |
| primeira carga | `Skeleton` com a forma do conteúdo |
| movimento | troca de tema por revelação radial a partir do clique (View Transitions API, 550 ms, `useTema`); entrada da gaveta (200 ms), surgimento do fundo (160 ms), barra de progresso de rota; tudo desligado com `prefers-reduced-motion` (a troca de tema fica seca, sem a animação) |
| movimento do Início | `features/inicio/inicio.css` (em `@layer components`, para os utilitários continuarem vencendo) e `shared/movimento`: números que contam até o valor (o final vai para o leitor de tela, uma vez), revelação ao rolar, holofote que segue o ponteiro, feixe na borda, texto com brilho e o visor da balança no pé do herói (a régua em arco gira e assenta sob o ponteiro magenta e, depois, gira com a rolagem: ao descer, as marcas andam para a esquerda, como o peso aumentando); com `prefers-reduced-motion`, o conteúdo nasce no lugar e os números no valor final |

## Grade da Visão Geral

Acima de tudo, a **faixa de filtros** (`FiltrosDoPainel`): os 6 filtros em dropdowns compactos
(rótulo curto dentro do gatilho, 40 px desenhados e 44 px de alvo), `md:grid-cols-3 xl:grid-cols-6`,
presa em `lg:top-[4.25rem]` (abaixo da barra do topo); o filtro ligado ganha borda e fundo de destaque.

KPIs: `grid-cols-2 lg:grid-cols-4 xl:grid-cols-[1.4fr_1fr_1fr_1.1fr_1.25fr]` — o titular ("Registros
no recorte") ocupa a linha toda até 1279 px; depois, excesso de peso, obesidade, nível predominante e o
perfil médio. Gráficos: 12 colunas a partir de 1280 px, 2 entre 768 e 1279 px, 1 abaixo disso, em três
partes com título de seção (`text-lg` semibold e uma frase em `--muted-foreground`).

| Parte | Cartões (`xl:col-span`) |
|---|---|
| Quem está no recorte | Divisão por Nível de Obesidade (7) · Gênero e Nível de Obesidade (5) |
| O que anda junto com a obesidade | Fatores associados à obesidade (12) |
| O corpo: altura, peso e IMC | Altura, Peso e o Nível de Obesidade (12) · IMC Médio por Atividade Física (6) · IMC Médio por Consumo de Álcool (6) |

Todo cartão de gráfico é `h-full flex flex-col` e a área do gráfico é `flex-1` com altura mínima
(o conteúdo num bloco absoluto de tamanho resolvido, porque `<ResponsiveContainer height="100%">`
em pai `auto` desenha 0 px): os cartões de uma linha têm a mesma altura e terminam alinhados.

## Ícones e componentes

Ícones de `lucide-react`, importados um a um (só os usados entram no bundle). O símbolo Visor está
em `shared/ui/Marca.tsx` (versões principal, negativa e reduzida, com as cores `--marca-*`), no topo
da barra lateral, na barra do topo do celular e no herói do Início; o favicon, o ícone de toque e o
manifesto estão em `frontend/public` (ADR 0011). Os componentes seguem o padrão
shadcn/ui sobre Radix (`shared/ui/`), com `class-variance-authority` e `tailwind-merge`; a casca, os
estados e os gráficos estão em `shared/layout/`, `shared/estados/` e `shared/graficos/`
(lista em [`redesenho-front.md`](redesenho-front.md) §4).
