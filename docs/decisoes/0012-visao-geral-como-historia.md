# ADR 0012 — Visão Geral contada como história: filtros em dropdown, cores por nível e fatores

**Data:** 2026-10-18 · **Estado:** aceita · **Fase:** pós-F17 · **Cita:** ADR 0010, ADR 0011

## Contexto

A ADR 0010 deixou a aparência com o redesenho e manteve com o plano (§7.3) o dado, a agregação, o tipo
de gráfico e a interação de cada visual do painel de referência. Em 2026-10-18 o autor pediu três
coisas que esse limite não comporta: filtros em dropdown na Visão Geral (antes só se filtrava
clicando nos visuais), cores por nível com degradê dentro de cada família (obesidade numa cor, os
graus I, II e III em tons dela) e um levantamento de storytelling e de novas análises. O levantamento,
com os números, está em [`docs/visao-geral-storytelling.md`](../visao-geral-storytelling.md).

## Decisão

| Tema | Decisão |
|---|---|
| Filtros | Os 6 filtros do painel também em dropdowns, numa faixa acima dos KPIs (`FiltrosDoPainel`), presa ao topo no desktop. O slicer da Consulta virou `shared/filtros/Slicer.tsx`, usado pelas duas telas; o `MultiSelect` ganhou a variante compacta. Dropdown e clique escrevem a mesma URL (`useFiltros`). |
| Cores | Sete tokens `--nivel-*`: a matiz da macro-faixa e um degradê do grau. As macro-faixas `--faixa-*` continuam onde a classe aparece sozinha (consulta, simulador, Início). Valores e validação em `design-tokens.md`. |
| KPIs | Excesso de peso e obesidade entram; com filtro, cada indicador mostra a base e a diferença em pontos percentuais. Idade, altura e peso médios dividem um cartão. |
| Tipos de gráfico | A rosca de calóricos (duas fatias) vira um grupo do gráfico novo de **fatores associados**; a tabela de gênero vira uma **pirâmide** de níveis; o gráfico de IMC por gênero (duas colunas) vira número no cabeçalho dela; o IMC por álcool passa à ordem de frequência. Os cross-filters de calóricos e de gênero continuam, na linha do fator e na barra da pirâmide. |
| Dados | Nenhum endpoint novo: tudo sai de `/painel/por-categoria` (inclusive com `serie=nivel`), `/painel/genero` e `/painel/resumo`. As frações de excesso de peso e obesidade são somas das contagens do servidor; a composição de uma resposta com n < 15 não é desenhada, o mesmo corte das médias. |

## O que NÃO muda

A camada de dados (ADR 0005/0006), o cross-filter pela URL com a origem que não se filtra pelo próprio
eixo, o domínio dos eixos fixo na base, a tabela equivalente em todo gráfico, o alvo de 44 px, o
magenta só na previsão e no ponteiro (ADR 0011) e o portão de cor (`tokens.css` é o único arquivo com
cor literal).

## Consequências

- `DonutCaloricos.tsx` e `ImcPorGenero.tsx` saíram; `e2e/painel.spec.ts` confere o recorte no cartão
  de gênero e cobre os dropdowns e o filtro pela linha do gráfico de fatores.
- Novas dimensões em `CAMPOS_CATEGORIA` (faixa etária, lanches, vegetais, refeições, telas,
  monitoramento de calorias) entram no gráfico de fatores somando uma linha a `FATORES`
  (`features/painel/fatores.ts`) — é o próximo passo do levantamento.
- O design system do painel a partir do arquivo de dashboards do autor no Figma fica pendente da
  autorização do conector; quando vier, as cores entram por `tokens.css`, sem tocar nos componentes.
