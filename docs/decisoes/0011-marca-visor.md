# ADR 0011 — Marca Visor: símbolo, paleta, tipografia e ícones

**Data:** 2026-10-18 · **Estado:** aceita · **Fase:** pós-F17

## Contexto

Até aqui o produto tinha uma identidade provisória: um selo com um traço de sinal vital
(`shared/ui/Marca.tsx`), a paleta do redesenho ([ADR 0010](0010-redesenho-do-front.md)) com o azul
herdado `#3463da` como cor primária, a fonte do sistema e nenhum favicon. Em 2026-10-18 o autor
entregou o pacote da **marca Visor** (manual 1.0, outubro de 2026): o símbolo em cinco versões
(principal, monocromática, negativa, ícone de app e reduzida), em SVG e PNG, as cores e a tipografia.

O símbolo é uma balança vista de cima, com os dois apoios para os pés, cujo visor é uma fita métrica
em curva. O traço magenta não marca quilos nem centímetros: marca a probabilidade calculada pelo
modelo. As regras do manual que mudam o app:

- **Cores:** tinta `#201E1D` e papel `#F3F2F2` "fazem quase todo o trabalho"; o magenta `#D6006C` é
  "reservado para o ponteiro e para o resultado da previsão na interface"; grafite `#444141` (apoios)
  e visor `#F8F4F4` (janela) completam o símbolo.
- **Tipografia:** Source Serif 4, "uma família só para nome, títulos e interface" — semibold 600 em
  nome, títulos e no percentual previsto, regular 400 no texto, itálico 400 em notas.
- **Uso:** a principal no claro e a negativa no escuro; versão completa até 24 px e a reduzida até
  16 px; área de proteção de 3 m (grade de 19 × 19 m); não distorcer, girar, trocar as cores nem
  aplicar sombra ou efeito.

## Decisão

| Peça | Como fica |
|---|---|
| **Paleta** | `tokens.css` passa a ser a da marca: papel no fundo, tinta no texto e na ação principal (`--primary`), cinzas quentes derivados nos apoios. No escuro, o inverso: fundo `#1b1a19`, cartão `#252322`, a barra lateral na própria tinta, papel no texto e no botão. As cinco cores do manual ficam em `--marca-*`, iguais nos dois temas, só para o símbolo. Contrastes medidos em `docs/design-tokens.md` (texto ≥ 4,5:1, marcas ≥ 3:1). |
| **Magenta** | Um token próprio, `--previsao`, usado **só** no resultado da previsão: a classe estimada no simulador, a barra dela no gráfico de probabilidades e a classe no relatório HTML. Fora isso, o magenta só aparece no ponteiro — do símbolo e do visor desenhado no Início. No escuro, `--previsao` clareia para `#ff5aa5`: o magenta do manual dá 3,2:1 sobre a tinta, bom para traço e não para texto. |
| **Símbolo** | `shared/ui/Marca.tsx` desenha o Visor com os caminhos do pacote (sem o manifesto C2PA) e as cores por token: `variante="auto"` mostra a principal no claro e a negativa no escuro; a reduzida existe para tamanhos abaixo de 24 px. Aparece no topo da barra lateral, na barra do topo do celular, no esqueleto de carregamento e no herói do Início. |
| **Tipografia** | Source Serif 4 variável (pesos e tamanho óptico), pelo pacote `@fontsource-variable/source-serif-4` com versão fixa: os arquivos `.woff2` saem no build e são servidos pelo próprio site. O Google Fonts, que o manual cita como origem, ficou de fora: a CSP é `font-src 'self'` e a Política de Privacidade promete que o navegador só fala com o nosso servidor. |
| **Gráficos** | Série única em grafite (`--grafico-primaria`), segunda série em cinza quente; a rampa das macro-faixas fica como estava, porque é semântica e não de marca. O par de gênero trocou de rosa e azul para laranja e azul da paleta de referência, validado pelo script de visualização nos dois temas: o rosa herdado era quase o magenta reservado. |
| **Ícones do site** | `frontend/public`: `favicon.svg` (a reduzida, sempre a preta, também com o navegador no escuro — pedido do autor), `favicon.ico` (16, 32 e 48 px), `apple-touch-icon.png` (180 px, o ícone de app com fundo) e `site.webmanifest` com os de 192 e 512 px. O `index.html` ganha `theme-color` claro e escuro, `author` e as tags Open Graph sem imagem (ela exige endereço absoluto, que só existe no deploy). |
| **Relatório HTML** | O relatório da API (`dominio/relatorio.py`) leva o símbolo inline no cabeçalho, tinta sobre papel, Source Serif 4 com Georgia de reserva (o arquivo é autocontido e não baixa fonte) e a classe estimada em magenta. |
| **Início** | O traçado de sinal vital do herói (que era o motivo do selo antigo) vira o visor da balança: uma fita métrica em arco que gira e assenta ao abrir a página, sob o ponteiro magenta fixo, e gira com a rolagem (ao descer, as marcas andam para a esquerda, como o peso aumentando; ao subir, voltam). Os brilhos azuis viram tinta. |

## Consequências

- O magenta tem dono: qualquer uso novo fora do ponteiro e do resultado da previsão contraria o
  manual. Quem precisar de uma cor de destaque usa a tinta (ação) ou as cores de estado (erro, alerta,
  sucesso), que continuam como estavam.
- O portão de cor não muda: as cores da marca vivem em `tokens.css`, e o símbolo as lê por classe
  (`fill-marca-tinta`, `stroke-marca-magenta`). Os arquivos de `public/` (favicon, manifesto) e o
  relatório da API têm hex literal por natureza — o portão só olha `frontend/src`.
- `nginx.conf` passou a servir `/privacidade` com 200 (a lista de rotas do SPA não a tinha) e o
  manifesto com `application/manifest+json`; `scripts/verificar-stack.sh` confere a rota, os dois
  favicons, o ícone de toque e o manifesto.
- As capturas do README (`docs/capturas/`) são anteriores à marca e ficam para ser refeitas.
- O pacote da marca não entra no repositório (o manual em HTML, os PNG de 1024 px): entram só os
  desenhos usados, em código (`Marca.tsx`, o relatório) e nos ícones gerados de `public/`.
