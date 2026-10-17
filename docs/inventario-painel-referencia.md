# Inventário do painel de referência

> Cópia adaptada do inventário extraído na auditoria do legado (F1), trazida em F13 e conferida
> contra §7.3/§7.4 do plano (seção final). Os dois JSON de apoio estão nesta mesma pasta.

Extraído programaticamente de `Report/Layout` do arquivo de painel do projeto legado
(JSON em UTF-16 dentro do contêiner ZIP). **36 visuais em 3 páginas.**

Este documento é a especificação de partida para reconstruir o painel em React + Recharts.
As fotos das páginas, quando chegarem, servem para o refinamento estético
(paleta, tipografia, hierarquia, textos, ícones) — não para descobrir o que existe.

Arquivos de apoio nesta mesma pasta (`docs/`): `inventario-painel.json` (esta tabela em JSON)
e `inventario-painel-layout.json` (layout bruto completo, 317 KB).

> O nome do arquivo de painel original não é transcrito aqui: ele contém termos da lista negra.


---

## Página: Início

2 visuais.


### Elementos de layout (sem dado)

- 2x `shape` — Forma


---

## Página: Visão Geral

22 visuais.

### Visuais com dado

| # | Título | Tipo (Power BI) | Tipo (leitura) | Campos / agregação | x | y | larg | alt |
|---|---|---|---|---|---|---|---|---|
| 1 | Idade Média | `card` | Cartão de KPI | `Values:Avg(base.Idade)` | 496 | 52 | 184 | 162 |
| 2 | Nível Predominante | `card` | Cartão de KPI | `Values:Min(base.Nivel_Obesidade)` | 1342 | 66 | 278 | 148 |
| 3 | Altura Média | `card` | Cartão de KPI | `Values:Sum(base.Altura)` | 784 | 64 | 224 | 158 |
| 4 | Qtd Pacientes | `card` | Cartão de KPI | `Values:Min(base.Genero)` | 178 | 52 | 216 | 162 |
| 5 | Peso Médio | `card` | Cartão de KPI | `Values:Sum(base.Peso)` | 1062 | 72 | 246 | 142 |
| 6 | Análise Cruzada - Altura, Peso e o Nível de Obesidade | `scatterChart` | Dispersão | `Series:base.Nivel_Obesidade`<br>`Y:Sum(base.Altura)`<br>`X:Sum(base.Peso)` | 122 | 683 | 862 | 382 |
| 7 | — | `htmlContent443BE3AD55E043BF878BED274D3A6855` | HTML customizado | `content:base.HTML_analise_homens` | 871 | 290 | 276 | 377 |
| 8 | — | `htmlContent443BE3AD55E043BF878BED274D3A6855` | HTML customizado | `content:base.HTML_analise_mulheres` | 598 | 290 | 290 | 364 |
| 9 | — | `card` | Cartão de KPI | `Values:base.percent_homens` | 1060 | 292 | 101 | 103 |
| 10 | — | `card` | Cartão de KPI | `Values:base.percent_mulheres` | 589 | 292 | 100 | 102 |
| 11 | Divisão por Nível de Obesidade | `barChart` | Barras horizontais | `Category:base.Nivel_Obesidade`<br>`Y:CountNonNull(base.Nivel_Obesidade)` | 124 | 242 | 440 | 412 |
| 12 | IMC Médio por Frequência Atividade Física | `columnChart` | Colunas verticais | `Y:Sum(base.IMC)`<br>`Category:base.Atividade_Fisica_Frequencia`<br>`Series:base.Genero` | 1008 | 684 | 612 | 382 |
| 13 | IMC Médio por Consumo de Álcool | `barChart` | Barras horizontais | `Y:Sum(base.IMC)`<br>`Category:base.Consumo_Alcool` | 1636 | 684 | 401 | 382 |
| 14 | Consumo de Alimentos Calóricos | `donutChart` | Rosca | `Category:base.Consumo_Calorico_Frequente`<br>`Y:CountNonNull(base.Nivel_Obesidade)` | 1647 | 241 | 390 | 426 |
| 15 | — | `columnChart` | Colunas verticais | `Category:base.Genero`<br>`Y:Avg(base.IMC)` | 1186 | 246 | 434 | 408 |

### Elementos de layout (sem dado)

- 3x `actionButton` — Botão de ação
- 2x `image` — Imagem
- 2x `textbox` — Caixa de texto


---

## Página: Consulta

12 visuais.

### Visuais com dado

| # | Título | Tipo (Power BI) | Tipo (leitura) | Campos / agregação | x | y | larg | alt |
|---|---|---|---|---|---|---|---|---|
| 1 | — | `tableEx` | Tabela | `Values:base.Nivel_Obesidade`<br>`Values:Sum(base.IMC)`<br>`Values:Sum(base.Altura)`<br>`Values:Sum(base.Peso)`<br>`Values:Sum(base.Idade)`<br>`Values:base.Atividade_Fisica_Frequencia`<br>`Values:base.Consumo_Agua_Diario`<br>`Values:base.Consumo_Alcool`<br>`Values:base.Consumo_Calorico_Frequente`<br>`Values:base.Consumo_Alimentos_Entre_Refeicoes`<br>`Values:base.Consumo_Vegetais`<br>`Values:base.Fumante`<br>`Values:base.Genero`<br>`Values:base.Historico_Familiar_Sobrepeso`<br>`Values:base.Meio_Transporte`<br>`Values:base.Monitoramento_Calorias`<br>`Values:base.Numero_Refeicoes_Principais`<br>`Values:base.Tempo_Dispositivos_Tecnologicos` | 120 | 142 | 1902 | 921 |
| 2 | — | `slicer` | Filtro (slicer) | `Values:base.Consumo_Agua_Diario` | 441 | 22 | 306 | 83 |
| 3 | — | `slicer` | Filtro (slicer) | `Values:base.Consumo_Alcool` | 764 | 22 | 307 | 83 |
| 4 | — | `slicer` | Filtro (slicer) | `Values:base.Consumo_Calorico_Frequente` | 1083 | 22 | 306 | 83 |
| 5 | — | `slicer` | Filtro (slicer) | `Values:base.Genero` | 1401 | 22 | 306 | 83 |
| 6 | — | `slicer` | Filtro (slicer) | `Values:base.Historico_Familiar_Sobrepeso` | 1719 | 27 | 303 | 83 |
| 7 | — | `slicer` | Filtro (slicer) | `Values:base.Nivel_Obesidade` | 120 | 22 | 306 | 94 |

### Elementos de layout (sem dado)

- 3x `actionButton` — Botão de ação
- 1x `textbox` — Caixa de texto
- 1x `image` — Imagem


---

## Observações para a migração

1. **Agregações inconsistentes no original.** Os cartões "Altura Média" e "Peso Médio" usam
   `Sum(...)` e não `Avg(...)`; "Qtd Pacientes" usa `Min(base.Genero)` e "Nível Predominante"
   usa `Min(base.Nivel_Obesidade)`. O rótulo é que está certo — a medida do painel está errada
   ou depende de um contexto de filtro implícito. Na reconstrução, implementar a agregação que
   o **rótulo** promete (média, contagem, moda) e registrar a divergência.
2. **Dois visuais de HTML customizado** (`HTML_analise_homens` / `HTML_analise_mulheres`) são
   blocos de texto analítico gerados por medida. No React viram componentes de narrativa
   alimentados pelo backend, não HTML injetado.
3. **Os 6 slicers da página "Consulta"** (consumo de água, álcool, calórico, gênero, histórico
   familiar, nível de obesidade) definem o estado de filtro compartilhado do painel.
4. **`tableEx` com 18 colunas** precisa de virtualização e scroll horizontal próprio.
5. **`actionButton`/`shape`/`image`** são cromo de navegação do Power BI — no React viram
   rotas, botão de limpar filtros e cabeçalho.


---

## Conferência da Fase F13 — inventário × especificação (§7.3/§7.4 do plano)

Os 14 visuais com dado foram conferidos um a um contra a especificação. Onde o inventário e a
especificação divergem, a especificação manda — a divergência é intencional e fica registrada aqui.

| Visual do inventário (página) | Componente React | Dado servido | Divergência registrada |
|---|---|---|---|
| Qtd Pacientes (Visão Geral, `Min(base.Genero)`) | `FaixaKpis` → KpiCard "Qtd. de registros" | `GET /painel/resumo` → `total_registros` | O original contava uma coluna; passa a ser `COUNT(*)` do recorte |
| Idade Média (`Avg(base.Idade)`) | KpiCard "Idade média" | `resumo.idade_media` | — |
| Altura Média (`Sum(base.Altura)`) | KpiCard "Altura média" | `resumo.altura_media` | O rótulo prometia média; a medida era soma com um `TopN` parasita que restringia o cartão a uma classe. Implementada a média do recorte |
| Peso Médio (`Sum(base.Peso)`) | KpiCard "Peso médio" | `resumo.peso_medio` | Idem |
| Nível Predominante (`Min(base.Nivel_Obesidade)`) | KpiCard "Nível predominante" | `resumo.nivel_predominante`, `n_predominante` | Era `Min`/`Max` + `TopN`; passa a ser a **moda** explícita, com o `n` no cartão |
| Divisão por Nível de Obesidade (`barChart`, `CountNonNull`) | `BarrasPorNivel` | `GET /painel/por-categoria?campo=nivel&metrica=contagem` | Origem de cross-filter: só destaca, não se filtra pelo próprio eixo; domínio do eixo fixo no máximo global |
| `HTML_analise_mulheres` / `HTML_analise_homens` + os dois cartões `percent_*` | `PainelGenero` | `GET /painel/genero` | HTML injetado por medida vira JSON tipado `{genero, n, percentual, imc_medio, nivel_predominante}` formatado por componente — nunca `dangerouslySetInnerHTML` |
| `columnChart` sem título (`Category:Genero`, `Avg(IMC)`) | `ImcPorGenero` | `por-categoria?campo=genero&metrica=imc_medio` | Recebe o título explícito "IMC Médio por Gênero"; eixo começa em zero |
| Consumo de Alimentos Calóricos (`donutChart`, `CountNonNull`) | `DonutCaloricos` | `por-categoria?campo=caloricos&metrica=contagem` | Contagem de registros, não de uma coluna; legenda em HTML fora do SVG; total no centro |
| Análise Cruzada - Altura, Peso e o Nível de Obesidade (`scatterChart`, `Sum(Altura)` × `Sum(Peso)`) | `DispersaoAlturaPeso` | `GET /painel/pontos?amostra=2000` | Eixos em `Altura`/`Peso` crus (o original somava); cor por macro-faixa + forma da marca; amostra determinística |
| IMC Médio por Frequência Atividade Física (`Sum(IMC)` por `Genero`) | `ImcPorAtividade` | `por-categoria?campo=atividade&serie=genero&metrica=imc_medio` | Eixo rotulado "IMC médio", não soma; domínio completo com zeros; eixo pelo inteiro, rótulo pelo texto |
| IMC Médio por Consumo de Álcool (`Sum(IMC)`) | `ImcPorAlcool` | `por-categoria?campo=alcool&metrica=imc_medio` | Média, ordenada desc; `n < 15` suprimido e marcado em vez de exibir uma média de 1 registro |
| `tableEx` de 18 colunas (Consulta) | `TabelaRegistros` (F14) | `GET /registros` paginado e ordenado no servidor | Virtualização + scroll horizontal próprio |
| 6 `slicer` (Consulta) | `MultiSelect` ×4 + `SegmentedControl` ×2 (F14) | `GET /dimensoes` | Rótulo exibido, inteiro enviado (`<1L` → 1); todas as opções do domínio global com a contagem |

Resultado da conferência: **nenhum visual com dado fora da especificação**, e nenhuma linha nova
precisou entrar em §7.3/§7.4. As regras de cor condicionadas a `Fumante` presentes em cinco
visuais do original não são replicadas (herança morta, §7.3): as únicas regras de cor legítimas
são `Genero = 'Feminino'` → rosa e `Consumo_Calorico_Frequente = 'Sim'` → azul. O cromo do
Power BI (`actionButton`, `shape`, `image`, `textbox`) vira o trilho de navegação e um único
botão "Limpar filtros".
