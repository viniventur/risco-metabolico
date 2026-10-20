# ADR 0016 — O front em dois projetos: um bloco para a obesidade, outro para a diabetes

**Data:** 2026-10-20 · **Estado:** aceita · **Fase:** depois da M6 das melhorias do modelo da vertente diabetes · **Cita:** ADR 0010, ADR 0011, ADR 0013

## Contexto

A ADR 0013 pôs a diabetes ao lado da obesidade como uma segunda vertente, com código, base, modelo e telas próprios. No front, porém, só a diabetes ganhou nome:

- no menu, as telas da obesidade ficavam nos grupos "Painel" e "Modelo", sem o nome do projeto, e as da diabetes num grupo "Diabetes", entre eles e os estudos;
- o Início abria com o herói e as métricas da obesidade, sem dizer de qual projeto eram, e punha a seção da diabetes entre o "Modelo servido" e os atalhos da obesidade;
- os cartões "Dados" e "Limitações" do "Sobre o projeto" falavam das duas bases.

Em 2026-10-20, ao ver o sistema rodando local, o autor achou a obesidade e a diabetes muito misturadas e pediu que a diferença entre os dois projetos ficasse explícita: são dois projetos num produto só. Na revisão, pediu ainda a diabetes antes da obesidade e, nos indicadores da diabetes, os velocímetros que os da obesidade têm.

## Decisão

| Tema | Decisão |
|---|---|
| Fonte única | `frontend/src/shared/projetos.ts` descreve os dois projetos (número, nome, natureza da base, ícone, as quatro telas, o simulador, a visão geral e o notebook) e diz de que projeto é cada rota (`projetoDaRota`, `projetoDaTela`, `projetoDoNotebook`). O menu, a trilha da barra do topo, o selo das telas, os estudos e a frase de dados do rodapé (`avisosDaRota`) leem daqui. |
| Ordem | A diabetes primeiro, depois a obesidade, a pedido do autor, em todo lugar onde os dois aparecem juntos: o menu, o herói, os blocos do Início, a lista de estudos e as duas frases de dados do rodapé das telas comuns. O número de cada projeto é a posição dele: Projeto 1, a diabetes; Projeto 2, a obesidade. |
| Menu | O Início em cima; um bloco por projeto, num cartão com o ícone, o nome (o título da lista), "Projeto N" e a natureza da base, sobre as mesmas quatro telas, com os mesmos nomes (Visão Geral, Consulta, Simulador e Monitoramento); os estudos embaixo. O bloco do projeto da tela aberta fica em destaque. Recolhido, o ícone do projeto vai em cima das telas dele, e cada link diz o projeto ("Simulador da diabetes"). Os grupos "Painel" e "Modelo" saem. |
| Telas | Em cima do título de toda tela de um projeto, e do notebook dele, o selo "Projeto N · Nome": o `PageHeader` o tira da rota. A trilha da barra do topo começa pelo projeto, com o ícone dele. O Início, os estudos e a Política, que são dos dois, ficam sem selo. |
| Início | O herói apresenta os dois projetos lado a lado: cada um com o que entra e o que sai do modelo, a base e a versão, e um atalho para o bloco dele. Cada projeto é um bloco com borda e fundo próprios e o mesmo cabeçalho (`CabecalhoDoProjeto`): o ícone e "Projeto N", o título, o que o modelo faz, a base e a versão, os atalhos para o simulador e a visão geral do projeto e, ao lado, o "Como funciona" dele. A diabetes traz as métricas, o limiar, as telas, a base e os limites dela; a obesidade, as métricas, o modelo servido, os atalhos e o "Sobre o projeto". |
| Velocímetros | Os quatro indicadores da diabetes ganham o velocímetro dos da obesidade, com a mesma entrada e o ponteiro que sobe com o número, e uma marca de referência tracejada que dá sentido ao ponteiro: o acaso na ROC-AUC (0,5, numa régua de 0 a 1), o alvo no recall, o acaso na precisão (a prevalência do teste: quem encaminhasse ao acaso acertaria nessa proporção) e o ideal nos encaminhados (a mesma prevalência: encaminhar só os casos). A referência também fica escrita no cartão, e os números vêm de `/diabetes/model/info` (`recall_alvo` e `split.prevalencia_teste`); sem a prevalência no manifest, essas duas marcas não aparecem. São dois cartões por linha, para o velocímetro caber ao lado do texto. O velocímetro da obesidade não muda. É o desenho que o autor escolheu em 2026-10-19 ("com marca de referência"). |
| Estudos | Cada notebook leva o selo do projeto dele. |
| Identidade | Número, nome e ícone (uma gota para a diabetes, um peso para a obesidade), sem cor nova. |

## Alternativas

- **Um seletor de projeto que troca o menu inteiro.** Esconderia as telas do outro projeto e poria dois cliques entre o Simulador de um e o do outro. Com os dois blocos sempre à vista, a diferença se vê, e a navegação fica a mesma.
- **Rotas por projeto (`/obesidade/...`).** Mudariam endereços já publicados por uma diferença que o menu, o selo e a trilha já mostram.
- **Uma cor por projeto.** A marca reserva a cor ao ponteiro e ao resultado da previsão (ADR 0011). As cores livres já têm papel: o par de gênero, os estados e a série "com diabetes" (`--diabetes`). Uma cor nova pediria a validação de contraste e de daltonismo de `docs/design-tokens.md`, por uma identidade que o número, o nome e o ícone já dão.

## O que NÃO muda

As rotas, a API, o conteúdo das telas de cada projeto (elas só ganham o selo), a frase de dados do rodapé de cada tela (nas telas comuns, as duas, agora com a da diabetes primeiro) e as frases com portão. Os testes de antes passam sem edição.

## Consequências

- O "Sobre o projeto" do Início é o da obesidade. O cartão "Dados" dele fala só da base fictícia. O da diabetes fica no bloco dela (`features/diabetes/inicio/SobreADiabetes.tsx`), com as respostas e o % com diabetes do split de `/diabetes/model/info`, e com os limites da base dela.
- Os limites que valem para os dois projetos (triagem, não diagnóstico; sem login) moram em `features/inicio/limites.ts` e aparecem nos dois blocos: cada projeto se lê sozinho.
- Um terceiro projeto entra em `shared/projetos.ts` e ganha, em `navegacao.ts`, um grupo com `projeto`. O menu, a trilha, o selo e o rodapé o reconhecem sem código novo.
- Um projeto novo, ou uma ordem nova, muda em `PROJETOS` e no número de cada projeto; o herói, os blocos do Início e os estudos seguem essa ordem, e o menu segue a dos grupos em `navegacao.ts`.
- `Velocimetro` ganhou `referencia` e `rotulos`; sem eles, desenha como antes.
- Testes novos: `shared/projetos.test.ts`, `shared/layout/Sidebar.test.tsx`, `shared/layout/PageHeader.test.tsx`, `features/inicio/DoisProjetos.test.tsx`, `features/estudos/ListaEstudosPage.test.tsx` e quatro e2e no fim de `e2e/diabetes.spec.ts`.
