# Tokens de design

**Origem da paleta: do produto** ([ADR 0010](decisoes/0010-redesenho-do-front.md)). A paleta
provisória de F15 era derivada do azul herdado `#3262DA` à espera das fotos do painel de referência;
o redesenho geral do front a substituiu por tokens claro/escuro medidos
([`redesenho-front.md`](redesenho-front.md) §3), e o mesmo azul (`#3463da`) continua como
`--primary` do tema claro. As fotos de referência, se um dia forem usadas, entram como referência
visual de um novo ajuste — e continuam fora do git e de pull request (plano, §3.1).

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

Contraste medido contra `--card` de cada tema.

| Token | Papel | Claro | Escuro | Contraste |
|---|---|---|---|---|
| `--background` | fundo da página | `220 25% 97%` `#f5f7f9` | `222 40% 8%` `#0c111d` | — |
| `--foreground` | texto | `222 47% 16%` `#16213c` | `220 40% 96%` `#f1f3f9` | 15,9 / 16,0 |
| `--card` / `--popover` | cartões, menus, balões | `0 0% 100%` | `222 35% 11%` `#121826` / `222 33% 13%` | — |
| `--muted` | fundos de apoio, cabeçalho de tabela, esqueleto | `220 25% 95%` `#eff1f5` | `222 25% 17%` `#212736` | — |
| `--muted-foreground` | rótulos, descrições, ticks | `222 14% 40%` `#586074` | `220 16% 68%` `#a0a9ba` | 6,3 / 7,5 |
| `--primary` | ação principal, barras de uma série, "Sim" do donut | `223 69% 53%` `#3463da` | `225 85% 70%` `#7192f4` | 5,3 / 6,0 |
| `--primary-foreground` | texto sobre a primária | `0 0% 100%` | `222 47% 10%` | 5,3 / 6,2 |
| `--accent` / `--accent-foreground` | hover, item ativo, chips de filtro | `223 80% 96%` / `223 60% 36%` | `225 40% 20%` / `225 100% 90%` | — |
| `--destructive` | erro, risco > 50% | `5 65% 45%` `#bd3528` | `5 85% 66%` `#f26b5f` | 5,7 / 5,9 |
| `--success` | risco baixo, PSI estável, API pronta | `145 63% 30%` `#1c7d44` | `145 55% 52%` `#41c879` | 5,2 / 8,2 |
| `--warning` | extrapolação, PSI em atenção, banco fora | `32 95% 36%` `#b36205` | `36 92% 58%` `#f6a831` | 4,5 / 8,9 |
| `--border` / `--input` | bordas / borda de campo | `220 22% 88%` / `220 20% 80%` | `222 22% 22%` / `222 20% 30%` | — |
| `--control` | preenchimento de campo (não some no cartão escuro) | `0 0% 100%` | `222 33% 14%` | — |
| `--ring` | anel de foco (2 px, `:focus-visible`) | `223 69% 53%` | `225 90% 75%` | — |
| `--zebra` | linha alternada OPACA da tabela (1ª coluna fixa) | `220 25% 97.5%` | `222 30% 13%` | — |
| `--overlay` | fundo da gaveta modal (a 60 %) | `222 47% 8%` | `222 47% 3%` | — |
| `--sidebar-*` | barra lateral | fundo `0 0% 100%`, ativo `223 80% 96%` | fundo `222 40% 10%`, ativo `225 40% 20%` | — |
| `--papel` | folha das figuras PNG dos notebooks | `220 20% 97%` | igual | — |

## Escalas dos gráficos

A cor segue a **entidade**, nunca o índice do array.

**Macro-faixas** (dispersão, ponto do nível na tabela da consulta, classe estimada e cartão de IMC do
simulador): rampa ordinal com ΔL\* ≈ 10 por degrau e toda marca ≥ 3:1 contra o cartão. No escuro a
rampa corre ao contrário — mais IMC = mais luminoso —, e a faixa de maior risco é a mais saliente
nos dois temas.

| Token | Claro | L\* | Escuro | L\* |
|---|---|---|---|---|
| `--faixa-abaixo` | `200 85% 47%` `#129ade` | 60,3 | `205 80% 41%` `#1576bc` | 48,1 |
| `--faixa-normal` | `165 75% 30%` `#138669` | 49,7 | `162 62% 39%` `#26a17c` | 59,3 |
| `--faixa-sobrepeso` | `30 92% 30%` `#934c06` | 40,3 | `36 92% 50%` `#f5970a` | 70,5 |
| `--faixa-obesidade` | `350 72% 32%` `#8c172a` | 30,4 | `352 100% 86%` `#ffb8c1` | 81,4 |

Na dispersão, o segundo canal são as **linhas de IMC** 18,5 · 25 · 30 · 35 · 40 (`LIMITES_IMC` em
`shared/dominio.ts`), e não mais a forma da marca.

**Categóricas e cor única:**

| Uso | Token | Claro | Escuro |
|---|---|---|---|
| Feminino (regra herdada) | `--feminino` | `338 66% 52%` | `338 85% 70%` |
| Masculino (regra herdada) | `--masculino` | `215 75% 55%` | `213 90% 70%` |
| Série única (nível, probabilidade, log) e "Sim" do donut | `--primary` | | |
| Segunda série (álcool, treino × log) | `--grafico-secundaria` | `207 100% 33%` | `207 75% 60%` |
| "Não" do donut, ticks, rótulos de eixo | `--muted-foreground` | | |
| Grade e linha de eixo | `--border` | | |

As regras de cor condicional que existem: `Genero = 'Feminino'` → `--feminino`, `Masculino` →
`--masculino`; `Consumo_Calorico_Frequente = 'Sim'` → `--primary`. As regras condicionadas a
`Fumante` do painel original são herança morta e não foram replicadas (§7.3). Os antigos
`--nivel-1…7` saíram: nenhum componente os lia.

## Forma, tipografia e movimento

| Token / regra | Valor |
|---|---|
| `--radius` | 0,625 rem (`rounded-lg`); `rounded-md` = −2 px, `rounded-sm` = −4 px |
| sombra | `shadow-sm` nos cartões, `shadow-lg` em balões e toasts (as do Tailwind) |
| fonte | `--font-sans`: Segoe UI Variable/Segoe UI, system-ui; `--font-mono`: Cascadia Code, Consolas |
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
| movimento | entrada da gaveta (200 ms), surgimento do fundo (160 ms), barra de progresso de rota; tudo desligado com `prefers-reduced-motion` |

## Grade da Visão Geral

KPIs: `grid-cols-2 lg:grid-cols-4 xl:grid-cols-[1.5fr_1fr_1fr_1fr_1.25fr]` — o titular ("Registros
no recorte") ocupa a linha toda até 1279 px. Gráficos: 12 colunas a partir de 1280 px, 2 entre 768 e
1279 px, 1 abaixo disso.

| Linha | Cartões (`xl:col-span`) |
|---|---|
| 2 | Divisão por Nível de Obesidade (7) · Consumo de Alimentos Calóricos (5) |
| 3 | Divisão por Gênero (5) · IMC Médio por Gênero (3) · IMC Médio por Consumo de Álcool (4) |
| 4 | Altura, Peso e o Nível de Obesidade (7) · IMC Médio por Frequência de Atividade Física (5) |

Todo cartão de gráfico é `h-full flex flex-col` e a área do gráfico é `flex-1` com altura mínima
(o conteúdo num bloco absoluto de tamanho resolvido, porque `<ResponsiveContainer height="100%">`
em pai `auto` desenha 0 px): os cartões de uma linha têm a mesma altura e terminam alinhados.

## Ícones e componentes

Ícones de `lucide-react`, importados um a um (só os usados entram no bundle). A marca do produto é um
SVG próprio (`shared/ui/Marca.tsx`), no topo da barra lateral. Os componentes seguem o padrão
shadcn/ui sobre Radix (`shared/ui/`), com `class-variance-authority` e `tailwind-merge`; a casca, os
estados e os gráficos estão em `shared/layout/`, `shared/estados/` e `shared/graficos/`
(lista em [`redesenho-front.md`](redesenho-front.md) §4).
