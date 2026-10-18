# Visão Geral: storytelling, novas análises e filtros

Levantamento feito sobre a Visão Geral (`frontend/src/features/painel/`) em 2026-10-18, com os números
lidos da própria API (`/painel/por-categoria`, `/painel/genero`, `/painel/resumo`) e, para o que a API
ainda não serve, de `data/processado/base_painel.parquet`. A seção 1 diz o que já mudou; as seções 2 e
3 são o levantamento pedido (o que melhorar nos visuais que existiam e o que acrescentar); a 4 traz os
cuidados de leitura que valem para tudo.

## 1. O que já está implementado

| Peça | Arquivo | O que faz |
|---|---|---|
| Filtros em dropdown | `FiltrosDoPainel.tsx`, `shared/filtros/Slicer.tsx` | Os 6 filtros numa faixa só, acima dos KPIs, em multisseleção com busca e a contagem do recorte em cada opção. No desktop a faixa fica presa logo abaixo da barra do topo; abaixo de 768 px abre recolhida, com a contagem de filtros ativos. Escreve a MESMA URL do clique nos visuais: o dropdown mostra o que o clique marcou, e vice-versa. |
| Cores dos 7 níveis | `tokens.css` (`--nivel-*`), `useChartTheme` (`corDoNivel`) | A matiz da família (as cores das 7 faixas do Início: azul, verde, âmbar, carmim) e um degradê do grau dentro dela: Sobrepeso I → II e Obesidade I → II → III. Validado pelo script do dataviz (seção 4 de `design-tokens.md`). |
| KPIs | `FaixaKpis.tsx`, `BarraDeNiveis.tsx`, `niveis.ts` | Entram **Excesso de peso** (73,5% na base) e **Obesidade** (46,0%), cada um com a barra das 7 classes no degradê; com filtro ativo, cada um diz o valor da base e a diferença em pontos percentuais. Idade, altura e peso médios dividem um cartão de **perfil médio** (com a diferença para a base). O nível predominante ganha a cor do nível. |
| Divisão por nível | `BarrasPorNivel.tsx` | Barras na cor do nível, rótulo "351 · 16,6%" e, com filtro fora do nível, a **marca da base**: onde a barra estaria se o recorte tivesse a composição da base. |
| Gênero e nível | `PainelGenero.tsx` | A tabela vira uma **pirâmide** dos 7 níveis (feminino à esquerda, masculino à direita); o IMC médio por gênero, que era um gráfico de duas colunas quase iguais, vira número no cabeçalho. |
| Fatores associados (novo) | `FatoresAssociados.tsx`, `fatores.ts` | Para histórico familiar, alimentos calóricos, atividade física, transporte, água e álcool: a composição dos níveis em cada resposta (barra 100%) e o % em obesidade, com a média do grupo como traço de referência. Absorve a rosca de alimentos calóricos. |
| Narrativa | `PainelPage.tsx` | O painel em três partes com título e frase: **Quem está no recorte**, **O que anda junto com a obesidade**, **O corpo: altura, peso e IMC**. |
| IMC por atividade e por álcool | `ImcPorAtividade.tsx`, `ImcPorAlcool.tsx` | Linhas de IMC 25 (sobrepeso) e 30 (obesidade); o álcool passa à ordem de frequência; barras finas (≤ 32 px). |
| Dispersão | `DispersaoAlturaPeso.tsx` | As 7 cores de nível no lugar das 4 macro-faixas, a mesma chave do gráfico de níveis. |

Saíram `DonutCaloricos.tsx` (o conteúdo está no grupo "Come alimentos calóricos com frequência?" dos
fatores, que também filtra) e `ImcPorGenero.tsx` (o número está no cabeçalho do cartão de gênero, e a
pirâmide filtra o gênero).

## 2. Storytelling dos visuais que já existiam

| Visual | O problema de leitura | O que mudou | O que ainda dá para fazer |
|---|---|---|---|
| KPIs | Altura e peso médios ocupavam dois cartões e não dizem nada clínico; nenhum número dizia "quanto do recorte está em excesso de peso"; o filtro mudava os números sem dizer em relação a quê. | Excesso de peso e obesidade em destaque, com a barra das classes; comparação com a base sob filtro. | Um *sparkline* por idade (o IMC sobe até os 25–30 anos e cai depois) quando a idade virar dimensão na API. |
| Divisão por Nível de Obesidade | Sete barras iguais em grafite: o leitor não via as famílias nem o grau, e a base quase equilibrada (é balanceada sinteticamente) parecia um achado. | Família pela matiz, grau pelo tom; "n · %"; a marca da base mostra o que o recorte tem de diferente (com "Feminino", Obesidade III vai a 323 contra ~160 esperados; Obesidade II cai a 2). | Chaves de família ao lado do eixo ("Sobrepeso", "Obesidade") agrupando as barras. |
| Consumo de Alimentos Calóricos (rosca) | Rosca de duas fatias (88,4% × 11,6%): só dizia quantos consomem, não o que muda entre eles. | Virou um grupo do gráfico de fatores: quem consome tem **51,1%** em obesidade; quem não consome, **7,8%**. | — |
| Divisão por Gênero (tabela) | Números soltos; o "nível predominante" (Obesidade III × Obesidade II) era o maior achado e passava como texto. | Pirâmide de níveis por gênero: Obesidade III é **323 de 324** feminina; Obesidade II, **295 de 297** masculina. | Uma nota fixa no cartão sobre a origem sintética desse padrão (seção 4). |
| IMC Médio por Gênero | Duas colunas de 30,1 e 29,3 começando no zero: a diferença não se vê e não importa. | Número no cabeçalho do cartão de gênero. | — |
| IMC Médio por Consumo de Álcool | Ordenado do maior para o menor, numa escala ordinal; sem referência do que é um IMC alto. | Ordem de frequência (mostra que "às vezes", 31,0, passa "não", 27,1, e "frequentemente", 27,0); linhas 25 e 30. | Barra por gênero (como na atividade) — o álcool também se divide por gênero. |
| IMC Médio por Atividade Física | Colunas parecidas sem referência; a queda de 31,0 → 25,2 com mais atividade não saltava. | Linhas 25 e 30: mulheres inativas ficam na faixa de obesidade (31,5) e homens inativos no limite (30,0); com 5+×/semana, mulheres em 23,3 (normal) e homens em 26,1 (sobrepeso). | Linhas com marcador no lugar das colunas, com o eixo de 15 a 40 (coluna precisa começar no zero e achata a diferença). |
| Análise Cruzada — Altura × Peso | Quatro cores para sete classes; o leitor não ligava a nuvem ao gráfico de níveis. | As mesmas 7 cores do gráfico de níveis. | Nomes das faixas entre as linhas de IMC ("normal", "sobrepeso", "obesidade I"…); clique na legenda para filtrar o nível. |

## 3. Novas análises — levantamento

Prioridade: **A** = forte e barata, **B** = forte e pede trabalho, **C** = complemento.

| # | Análise | A pergunta | O que a base mostra | Forma sugerida | Precisa de | Prioridade |
|---|---|---|---|---|---|---|
| 1 | Fatores associados | O que anda junto com a obesidade? | Histórico familiar: 55,9% × 2,1%; calóricos: 51,1% × 7,8%; atividade: 53,8% (nenhuma) → 21,0% (5+×/sem); caminhada 5,4% × transporte público 48,0% | Barras 100% por resposta | — (**implementada**) | A |
| 2 | Excesso de peso e obesidade × base | Este recorte é pior ou melhor que a base? | 73,5% e 46,0% na base | KPI + diferença em p.p. | — (**implementada**) | A |
| 3 | Pirâmide de gênero | Os níveis se dividem igual entre os gêneros? | Obesidade III quase só feminina; Obesidade II quase só masculina | Pirâmide | — (**implementada**) | A |
| 4 | Idade × nível | Em que idade a obesidade se concentra? | 13–17 anos: 7,1% em obesidade; **25–29: 76,9%**; 30–39: 53,8% | Barras 100% por faixa etária (entra no gráfico de fatores) | API: faixa etária como dimensão de `/painel/por-categoria` (`CAMPOS_CATEGORIA` em `dominio/agregados.py`) | A |
| 5 | Os hábitos que a API ainda não serve | Lanches, vegetais, refeições, telas, monitoramento de calorias, fumo | Monitora calorias: 3,1% × 48,1%; 4+ refeições: 6,0% × 52,9% com 3; lanches "às vezes": 54,1% × "frequentemente" 3,3%; fumo: 50,0% × 46,0% (n = 44, sem diferença) | Novos grupos do gráfico de fatores — basta somar à lista `FATORES` | API: as 6 colunas em `CAMPOS_CATEGORIA` (o parquet já as tem) | A |
| 6 | Distribuição do IMC | Como os níveis se espalham no eixo do IMC? | As classes se sobrepõem: Sobrepeso I vai de 22,8 a 28,8; Obesidade III começa em 36,8 | Histograma de IMC empilhado por nível, com as linhas 18,5 · 25 · 30 · 35 · 40 | Só front: `/painel/pontos?amostra=2500` já traz todos os registros | B |
| 7 | Ranking de fatores | Qual fator mais afasta da média? | Histórico familiar (−43,9 p.p. no "não"), calóricos, monitoramento, transporte | Barras divergentes em p.p. em relação à média do recorte | Só front (mesmos dados do gráfico de fatores) | B |
| 8 | Leitura do recorte | O que este recorte tem de diferente, em uma frase? | — | 2 ou 3 frases geradas dos agregados, sob os KPIs (o painel de referência tinha os blocos `HTML_analise_*`) | Só front; regras fixas, nunca texto livre | B |
| 9 | Fator × gênero | O efeito da atividade é igual nos dois gêneros? | 5+×/sem: mulheres 23,3, homens 26,1 (n = 37 e 82) | Pequenos múltiplos (fator em cima, gênero ao lado) | Só front (`serie=genero`) | C |
| 10 | O que o modelo usa × o que a base mostra | Os fatores fortes na base são os que o modelo pesa? | — | Importância das features (`/model/info`) ao lado do ranking de fatores | Só front | C |

## 4. Cuidados de leitura

- **A base é majoritariamente sintética** (77%, `data/bruto/FONTE.md`). Padrões como "Obesidade III
  quase só feminina" e "mais água, mais obesidade" (57,6% com mais de 2 L contra 43,5% com menos de 1 L)
  são efeitos da geração, não achados clínicos. Por isso a descrição do gráfico de fatores diz
  "associação na base, não causa", e os títulos são descritivos, não conclusões.
- **Paradoxos que pedem nota, não manchete:** mais vegetais (54,2% em obesidade com "sempre"), lanches
  "frequentemente" (3,3%) e mais de 5 h de telas (33,6%) andam com MENOS obesidade. Causalidade reversa
  (quem já tem obesidade muda o hábito) e o desenho da base explicam melhor do que o hábito.
- **n mínimo.** Abaixo de 15 registros, a composição não é desenhada (bicicleta, moto, álcool "sempre")
  — o mesmo corte das médias de IMC no servidor.
- **A cor é do nível, sempre:** os 7 tokens `--nivel-*` valem para todo gráfico de nível da Visão Geral;
  gênero continua laranja e azul; o magenta continua só da previsão e do ponteiro.

## 5. Design system a partir do Figma — pendente

O arquivo `backup-dashs` do Figma foi indicado como base do design system do painel, mas a leitura
depende da autorização do conector do Figma, que ainda não foi concluída. Quando ela existir, o que
sai do arquivo vai para os lugares de sempre: as cores em `tokens.css` (trios HSL, claro e escuro), os
valores e as regras em `docs/design-tokens.md` e, se mudar a marca, uma ADR ao lado da 0011.
