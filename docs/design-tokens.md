# Tokens de design

**ORIGEM DA PALETA: PROVISÓRIA.** As fotos das páginas do painel de referência não estavam
disponíveis ao fim de F14, e F15 rodou no modo de contingência previsto na seção ANCORA do plano:
a paleta abaixo foi **derivada** do token herdado `#3262DA` (primária do painel de referência) e
de `#005CA8` (secundária herdada do tema do app legado), mais uma escala neutra. Quando as fotos
chegarem, F15 é reaberta como tarefa de skin isolada e **só** estes arquivos podem mudar:
`frontend/src/shared/tema/tokens.css`, este documento, as classes de `grid-column`/`grid-row` de
`frontend/src/features/painel/PainelPage.tsx` e os SVGs de `frontend/src/shared/ui/icones/`.

## Onde os tokens vivem

`frontend/src/shared/tema/tokens.css` é o **único** arquivo do front com cor literal. Dois portões
garantem isso (seção ANCORA do plano), ambos rodando vazios hoje:

1. hex literal (`#[0-9a-fA-F]{3,8}`) em qualquer `*.ts`, `*.tsx` ou `*.css` fora de `tokens.css`;
2. a paleta utilitária padrão do Tailwind (`bg-slate-800`, `text-zinc-500`, …), que não contém `#`.

**Desvio documentado em relação ao plano (§12/#6):** o plano previa `tailwind.config.ts` com
`theme.colors` sobrescrito por inteiro. O projeto usa Tailwind **v4**, que é configurado em CSS:
o bloco `@theme inline { --color-*: initial; … }` de `tokens.css` apaga a paleta padrão e declara
as cores utilitárias apontando para as variáveis de tema. O efeito é o mesmo que o plano queria —
`bg-slate-800` deixa de existir e toda cor passa pelos tokens — sem um segundo arquivo de
configuração nem PostCSS (`@tailwindcss/vite` faz o trabalho).

## Paleta (tema claro / tema escuro)

| Token | Papel | Claro | Escuro |
|---|---|---|---|
| `--fundo` | fundo da página | `#f3f5f9` | `#0f1626` |
| `--superficie` | cartões, trilho, cabeçalhos sticky | `#ffffff` | `#182238` |
| `--superficie-alta` | hover, zebra da tabela (a 40 %) | `#e9eef7` | `#223050` |
| `--texto` | texto forte | `#14213d` | `#eef2fb` |
| `--texto-fraco` | rótulos, descrições, ticks | `#5b6478` | `#a3adc4` |
| `--borda` | bordas e divisores | `#d6dce8` | `#2c3a58` |
| `--primaria` | barras principais, fatia "Sim" do donut, botão primário | `#3262da` | `#6b8df0` |
| `--primaria-contraste` | texto sobre a primária | `#ffffff` | `#0f1626` |
| `--secundaria` | barra de álcool, série "treino" do monitoramento | `#005ca8` | `#4f9be0` |
| `--rosa` | gênero feminino (regra de cor legítima herdada) | `#d6336c` | `#f06292` |
| `--azul-claro` | gênero masculino; faixa "abaixo do peso" | `#4f8fe6` | `#7fb0ff` |
| `--sucesso` | risco baixo, PSI estável, faixa "peso normal" | `#1f8a4c` | `#4fc27a` |
| `--alerta` | extrapolação, PSI em atenção, faixa "sobrepeso" | `#c77700` | `#f0a63c` |
| `--perigo` | risco alto (> 50 %), PSI significativo, faixa "obesidade" | `#c0392b` | `#ef6b5e` |
| `--foco` | anel de `:focus-visible` (3 px) | `#3262da` | `#8aa6ff` |
| `--grade` / `--eixo` | linhas de grade e eixos dos gráficos | `#e2e7f0` / `#5b6478` | `#2c3a58` / `#a3adc4` |

Escalas dos gráficos (a cor segue a **entidade**, nunca o índice do array):

- `--faixa-abaixo`, `--faixa-normal`, `--faixa-sobrepeso`, `--faixa-obesidade`: a rampa ordinal de
  4 tons da dispersão altura × peso (= azul-claro, sucesso, alerta, perigo). A forma da marca é o
  segundo canal: círculo, quadrado, losango, triângulo.
- `--nivel-1` … `--nivel-7`: uma cor por classe clínica, lida por `useChartTheme().corDoNivel`.

Regras de cor condicional que existem: `Genero = 'Feminino'` → `--rosa`, `Masculino` →
`--azul-claro`; `Consumo_Calorico_Frequente = 'Sim'` → `--primaria`. As regras condicionadas a
`Fumante` do painel original são herança morta e não foram replicadas (§7.3).

## Forma, tipografia e movimento

| Token | Valor |
|---|---|
| `--raio` | 12 px (`rounded-card`) |
| `--sombra` | `0 1px 2px rgb(20 33 61 / .06), 0 4px 14px rgb(20 33 61 / .06)` (`shadow-card`) |
| `--font-sans` | Segoe UI, system-ui, Helvetica Neue, Arial |
| número de KPI | `text-3xl` bold, `tabular-nums` |
| rótulo de KPI | `text-xs` semibold, caixa alta, `tracking-wide`, `--texto-fraco` |
| título de gráfico | `text-base` semibold |
| tick de eixo | 12 px, `--eixo` |
| alvo mínimo de toque | 44 × 44 px (`min-h-11`, `min-w-11`) |
| refetch | o frame anterior em `opacity: .55` (`.refetching`), nunca skeleton |

Os gráficos recebem **valores**, não `var()`: `useChartTheme()` lê os tokens do `<html>` com
`getComputedStyle` e reage à troca de `data-theme` (MutationObserver) e de `prefers-color-scheme`.

## Grid da Visão Geral

12 colunas acima de 1100 px (`min-[1100px]:grid-cols-12`), 1 coluna abaixo;
`grid-auto-rows: minmax(90px, auto)`. Linha de KPIs: 6 células de 2 colunas. Faixa central:
barras por nível (4) · divisão por gênero (3) · IMC por gênero (2) · rosca de calóricos (3).
Faixa inferior: dispersão (5) · IMC por atividade (4) · IMC por álcool (3). Cada célula tem
altura resolvida, porque `<ResponsiveContainer height="100%">` dentro de pai `auto` renderiza
com 0 px.

## Ícones

Todos SVG inline em `frontend/src/shared/ui/icones/index.tsx` (nenhuma biblioteca de ícones no
bundle): início, painel, consulta, simulador, monitoramento, estudos, limpar filtros, sol, lua,
tabela, baixar, imprimir, alerta e a marca decorativa da faixa de KPIs.

## Placeholders da seção ANCORA (a preencher quando as fotos chegarem)

As fotos ficam fora do repositório (`referencia-visual/` do legado) e **nunca** entram no git nem
em pull request. Os três blocos abaixo recebem texto, não imagem.

**FOTO 1 — página "Início"**

```
Recebida em: ____
Resolução / enquadramento: ____
Paleta observada (hex amostrado):
  - fundo da página: ____
  - cartão de navegação: ____
  - texto do cartão: ____
Tipografia:
  - título principal: tamanho ____ peso ____ caixa ____
  - texto do cartão:  tamanho ____ peso ____
Posicionamento: ____
Textos literais visíveis: ____
Ícones / imagens: ____
Divergências em relação a §7.3/§7.4: ____
Decisão tomada (foto manda / §7.3-§7.4 mandam / novo item): ____
```

**FOTO 2 — página "Visão Geral"**

```
Recebida em: ____
Ordem real dos KPIs (esquerda -> direita): ____
Hex amostrado:
  - fundo: ____      superfície do cartão: ____
  - barra principal: ____   donut fatia "Sim": ____   donut fatia "Não": ____
  - cor feminino: ____      cor masculino: ____
  - texto forte: ____       texto fraco: ____   borda: ____
Tipografia:
  - número do KPI: tamanho ____ peso ____
  - rótulo do KPI: tamanho ____ peso ____
  - título de gráfico: tamanho ____ peso ____
  - tick de eixo: tamanho ____
Hierarquia (o que domina): ____
Sombra / raio de canto observados: ____
Títulos literais de cada visual: ____
Posição da marca e do botão "Limpar filtros": ____
Divergências em relação a §7.3/§7.4 (visual por visual): ____
Decisão tomada: ____
```

**FOTO 3 — página "Consulta"**

```
Recebida em: ____
Hex amostrado:
  - header da tabela: ____   zebra: ____   texto da tabela: ____
  - header do slicer: ____
Tipografia da tabela: header ____ / célula ____
Ordem real das colunas da tabela (esquerda -> direita): ____
Larguras relativas notáveis: ____
Ordem e rótulo literal dos 6 slicers: ____
Há totais, paginação ou barra de rolagem visível? ____
Divergências em relação a §7.3/§7.4: ____
Decisão tomada: ____
```
