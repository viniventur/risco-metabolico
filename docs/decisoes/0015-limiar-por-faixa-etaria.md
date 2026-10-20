# ADR 0015 — Vertente diabetes: um limiar de triagem por grupo de idade

**Data:** 2026-10-19 · **Estado:** aceita · **Fases:** M0 a M4 das melhorias do modelo da vertente diabetes · **Cita:** ADR 0013, ADR 0014

## Contexto

A ADR 0014 (decisão 1) fixou um limiar só, para todas as idades: o maior com recall ≥ 0,80 nas predições fora da dobra do treino. Ela já mostrava o efeito disso em cada idade e deixou o limiar por faixa etária registrado como limitação.

O recall de 0,80 vale na base inteira, mas não em cada idade. A probabilidade do modelo é calibrada também dentro de cada grupo de idade: fora da dobra, a média prevista de cada grupo acompanha a prevalência dele. Com um corte só, quem tem menos de 45 anos quase nunca passa dele, e a maioria de quem tem 65 ou mais passa.

Os números abaixo são do limiar único, grupo a grupo. Eles estão em `artifacts/diabetes/metricas/limiares-por-idade.json`, que guarda o limiar único ao lado da regra nova (`fora_da_dobra_limiar_unico` e `teste_limiar_unico`):

| Grupo | Prevalência (treino) | Recall fora da dobra | Encaminhados fora da dobra | Recall no teste | Encaminhados no teste |
|---|---|---|---|---|---|
| 18 a 44 anos | 4,0 % | 0,402 | 7,4 % | 0,416 | 7,4 % |
| 45 a 64 anos | 13,5 % | 0,760 | 37,9 % | 0,754 | 37,9 % |
| 65 anos ou mais | 20,6 % | 0,880 | 65,9 % | 0,874 | 66,0 % |
| **Todas as idades** | 13,9 % | 0,800 | 41,2 % | 0,795 | 41,2 % |

Entre 18 e 44 anos, o limiar único achava 0,402 dos casos de diabetes fora da dobra. A triagem quer achar quatro em cada cinco pessoas com diabetes em cada idade, e não só na média. O notebook 02 (seção "Limiar por faixa etária", células 39 a 49) aplicou o mesmo critério dentro de cada grupo de idade e mediu as alternativas antes da escolha.

## Decisão

Cinco decisões, propostas na M0 com a recomendação de cada uma e aceitas pelo autor ("sim para tudo").

**D1 — Três grupos de idade.** São os mesmos da avaliação por grupo (célula 34) e de `por-grupo.json`:

- 18 a 44 anos: as faixas 1 a 5 do BRFSS;
- 45 a 64 anos: as faixas 6 a 9;
- 65 anos ou mais: as faixas 10 a 13.

O código tem uma definição só dos grupos: `backend/app/diabetes/treino/avaliacao.py::FAIXAS_POR_GRUPO`, que sai de `CORTES_IDADE` e `GRUPOS_IDADE`.

**D2 — O mesmo critério, dentro de cada grupo.** Em cada grupo, o maior limiar com recall ≥ 0,80 nas predições fora da dobra do treino. O código guarda o critério literal em `avaliacao.py::CRITERIO_LIMIAR_POR_IDADE`: "em cada grupo de idade, o maior limiar com recall >= 0.8 nas predições fora da dobra do treino". As predições fora da dobra são as mesmas do limiar único, e o teste continua tocado uma vez, para medir.

O limiar de cada grupo e o ponto de operação dele, fora da dobra (`limiares_por_idade` do manifest). A última linha é o limiar único, que fica como referência (`limiar`):

| Grupo | Faixas do BRFSS | Limiar | Recall | Precisão | Especificidade | Encaminhados |
|---|---|---|---|---|---|---|
| 18 a 44 anos | 1 a 5 | 0,0297 | 0,800 | 0,098 | 0,690 | 32,9 % |
| 45 a 64 anos | 6 a 9 | 0,1084 | 0,800 | 0,254 | 0,635 | 42,3 % |
| 65 anos ou mais | 10 a 13 | 0,1616 | 0,800 | 0,300 | 0,517 | 54,8 % |
| **Todas as idades** | 1 a 13 | o do grupo | 0,800 | 0,249 | 0,610 | 44,7 % |
| limiar único (referência) | 1 a 13 | 0,1255 | 0,800 | 0,271 | 0,651 | 41,2 % |

**A estabilidade** de cada limiar entre as dobras do treino (`limiares-por-idade.json`, `estabilidade`). São duas medidas: o limiar escolhido em cada dobra sozinha, e o recall que o limiar escolhido em quatro dobras entrega na quinta. O grupo mais jovem, com menos casos, é o que mais varia, e o recall dele continua perto do alvo:

| Grupo | Casos no treino | Limiar de cada dobra sozinha | Recall cruzado (limiar de 4 dobras na 5ª) |
|---|---|---|---|
| 18 a 44 anos | 1.750 | 0,0247 a 0,0336 | 0,772 a 0,836 |
| 45 a 64 anos | 11.886 | 0,1054 a 0,1114 | 0,790 a 0,808 |
| 65 anos ou mais | 14.641 | 0,1582 a 0,1665 | 0,789 a 0,815 |

**No teste, uma vez.** A regra escolhida e, entre parênteses, o limiar único (`limiares-por-idade.json`, `teste` e `teste_limiar_unico`):

| Grupo | Recall | Precisão | Encaminhados |
|---|---|---|---|
| 18 a 44 anos | 0,778 (0,416) | 0,101 (0,237) | 32,4 % (7,4 %) |
| 45 a 64 anos | 0,798 (0,754) | 0,253 (0,268) | 42,4 % (37,9 %) |
| 65 anos ou mais | 0,804 (0,874) | 0,300 (0,271) | 55,0 % (66,0 %) |
| **Todas as idades** | 0,800 (0,795) | 0,250 (0,269) | 44,7 % (41,2 %) |

No teste, o recall de cada grupo fica perto do alvo, dentro da faixa que o recall cruzado previa.

**D3 — Versão 1.1.0, com release próprio.** O pipeline não muda. A 1.1.0 foi treinada no Windows com a mesma semente, e as probabilidades saem bit a bit iguais às da 1.0.0. Mudam a regra de decisão e o contrato, que só cresce.

O release `diabetes-v1.1.0` leva o `.pkl` e o mesmo snapshot (`dee1f27e9777`), com `--latest=false`: o release da obesidade continua como o mais recente. O `diabetes-v1.0.0` e o `.pkl` dele ficam como estavam.

**D4 — O contrato, só com acréscimos.**

- **A resposta.** Nas três rotas de predição (individual, lote e relatório), `limiar` continua um número: agora, o do grupo de idade da pessoa. O campo novo e opcional `grupo_de_idade` diz qual, e `risco_elevado` continua `probabilidade >= limiar`.
- **O modelo.** `/diabetes/model/info` ganha `limiares_por_idade`, com o critério, o alvo, os grupos e o total fora da dobra. Cada grupo traz o rótulo, as faixas, o valor e o ponto fora da dobra. O bloco `limiar` mantém a forma e passa a ser a referência: o limiar único na base inteira.
- **O manifest e as métricas.** O manifest ganha o mesmo bloco. Os `*_no_limiar` de `metricas_teste`, `matriz-confusao.json` e `por-grupo.json` medem a regra que classifica. A métrica nova, `limiares-por-idade.json`, guarda:
  - a escolha;
  - cada grupo fora da dobra e no teste, com o limiar único ao lado;
  - a estabilidade;
  - o preço de cada alvo de recall.
- **O artefato.** O `.pkl` leva a tabela, e a carga a confere contra o manifest: as 13 faixas, cada uma uma vez, com valores em [0, 1] iguais aos do manifest. Um `.pkl` sem a tabela, como o da 1.0.0, continua carregável. Nele, o limiar único vale para todas as idades, com um aviso no log, e `grupo_de_idade` sai nulo.
- **O OpenAPI** só ganha acréscimos, além do texto de seis descrições.

**D5 — O front, com os textos de antes como reserva.**

- **Simulador.** A régua marca o limiar do grupo, e o texto diz qual: "Limiar de triagem: 3,0% (o traço), o do grupo de 18 a 44 anos". A leitura fala no limiar do seu grupo de idade, e uma nota diz por que o limiar depende da idade.
- **Início.** A seção da vertente mostra a tabela por grupo (limiar, recall e encaminhados fora da dobra, com o total) e o limiar único como referência.
- **Relatório HTML.** O cartão do limiar diz o grupo. A leitura de antes continua e ganha, logo depois, "O limiar de triagem aplicado é o do seu grupo de idade" com o grupo, e a mesma linha da tela sobre por que o limiar depende da idade.
- **Sem os campos novos** (um modelo de limiar único), as telas mostram os textos e o cartão de antes. Por isso os testes do front da F5 passam sem edição.

## O preço: mais encaminhados com o mesmo recall total

Com a probabilidade calibrada, cortar todas as idades no mesmo ponto é o que encaminha menos gente para um recall total dado. Levar o alvo a cada grupo custa encaminhamentos:

- **Fora da dobra,** o recall total é o mesmo, 0,800. Os encaminhados passam de 41,2 % para 44,7 % (+3,5 p.p.), e a precisão cai de 0,271 para 0,249.
- **No teste,** os encaminhados passam de 41,2 % para 44,7 %, e o recall total vai de 0,795 para 0,800.
- **Quem muda de classificação** (célula 46, no teste): 7,35 % das respostas passam a ser encaminhadas, todas de pessoas com menos de 65 anos (25,05 % do grupo de 18 a 44 e 4,51 % do de 45 a 64). Outros 3,88 % deixam de ser encaminhados, todos de 65 anos ou mais (11,00 % desse grupo).

O preço de cada alvo de recall, fora da dobra (`pontos-de-operacao.json` para o limiar único, e `limiares-por-idade.json`, `pontos`, para o limiar por grupo). "Encaminhamentos por caso a mais" é quanto cada caso de diabetes a mais custa em encaminhamentos, de um alvo para o seguinte:

| Recall alvo | Único: limiar | Único: encaminhados | Único: encaminhamentos por caso a mais | Por grupo: limiares (18 a 44 / 45 a 64 / 65 ou mais) | Por grupo: encaminhados | Por grupo: precisão | Por grupo: encaminhamentos por caso a mais |
|---|---|---|---|---|---|---|---|
| 0,70 | 0,1707 | 31,9 % | — | 0,0458 / 0,1544 / 0,2022 | 34,0 % | 0,287 | — |
| 0,75 | 0,1481 | 36,2 % | 6,2 | 0,0367 / 0,1304 / 0,1819 | 39,1 % | 0,267 | 7,3 |
| 0,80 | 0,1255 | 41,2 % | 7,1 | 0,0297 / 0,1084 / 0,1616 | 44,7 % | 0,249 | 8,1 |
| 0,85 | 0,1022 | 46,8 % | 8,1 | 0,0217 / 0,0870 / 0,1397 | 51,8 % | 0,229 | 10,2 |
| 0,90 | 0,0762 | 54,6 % | 11,1 | 0,0154 / 0,0657 / 0,1152 | 60,8 % | 0,206 | 12,9 |

Com o mesmo alvo, o limiar por grupo sempre encaminha mais. Nas duas regras, cada caso a mais custa mais encaminhamentos que o anterior.

## As alternativas medidas

Todas foram medidas nas predições fora da dobra do treino, no alvo de 0,80 (notebook 02, células 40 e 44). São os números daquela execução, registrados aqui como evidência. Os servidos vêm do manifest.

**As divisões das 13 faixas.** As três colunas de recall por idade são o recall que cada um dos três grupos desta ADR recebe sob cada divisão. "Recall cruzado" é o menor e o maior recall que o limiar de cada grupo da divisão, escolhido em quatro dobras, entrega na quinta, entre os grupos e as dobras:

| Divisão | Encaminhados | Precisão | Recall 18 a 44 | Recall 45 a 64 | Recall 65 ou mais | Casos no menor grupo | Recall cruzado |
|---|---|---|---|---|---|---|---|
| limiar único | 41,2 % | 0,271 | 0,402 | 0,760 | 0,880 | 28.277 | 0,798 a 0,802 |
| 2 grupos: até 44, 45 ou mais | 44,1 % | 0,253 | 0,800 | 0,733 | 0,854 | 1.750 | 0,772 a 0,836 |
| 3 grupos: até 44, 45 a 64, 65 ou mais | 44,7 % | 0,249 | 0,800 | 0,800 | 0,800 | 1.750 | 0,772 a 0,836 |
| 3 grupos: até 34, 35 a 69, 70 ou mais | 44,8 % | 0,249 | 0,587 | 0,786 | 0,837 | 429 | 0,718 a 0,884 |
| 4 grupos: até 34, 35 a 44, 45 a 64, 65 ou mais | 46,0 % | 0,242 | 0,801 | 0,800 | 0,800 | 429 | 0,718 a 0,884 |
| 6 grupos: décadas | 46,7 % | 0,239 | 0,786 | 0,790 | 0,810 | 175 | 0,713 a 0,854 |
| 13 faixas | 46,9 % | 0,237 | 0,801 | 0,800 | 0,800 | 64 | 0,600 a 0,957 |

- **Mais grupos, mais caro e menos estável.** Toda divisão leva ao alvo o recall de cada grupo dela e encaminha mais que o limiar único. Abaixo dos 35 anos há poucos casos (429 no grupo de 18 a 34), e o recall cruzado oscila mais. Nas 13 faixas, o menor grupo tem 64 casos, e o recall cruzado vai de 0,600 a 0,957.
- **Cortar em 35 e 70 anos** põe os de 35 a 44 num grupo de risco maior, e o recall entre 18 e 44 anos volta a ficar longe do alvo (0,587).
- **Dois grupos** é a divisão mais barata depois do limiar único. Ela deixa 45 a 64 anos abaixo do alvo (0,733) e 65 ou mais acima (0,854): a distorção do limiar único, dentro do grupo de cima.

**Os critérios,** com os três grupos:

| Critério | Encaminhados | Recall total | Precisão | Recall 18 a 44 | Recall 45 a 64 | Recall 65 ou mais |
|---|---|---|---|---|---|---|
| limiar único | 41,2 % | 0,800 | 0,271 | 0,402 | 0,760 | 0,880 |
| recall ≥ 0,80 em cada grupo | 44,7 % | 0,800 | 0,249 | 0,800 | 0,800 | 0,800 |
| piso: nenhum grupo perde recall | 48,6 % | 0,842 | 0,241 | 0,800 | 0,800 | 0,880 |
| mesmo orçamento: recall 0,770 em cada grupo | 41,2 % | 0,770 | 0,261 | 0,771 | 0,770 | 0,770 |

- **O piso** deixa o limiar de cada grupo no máximo igual ao único, para nenhum grupo perder recall. Ele protege o recall dos mais velhos e encaminha bem mais.
- **O mesmo orçamento** é o recall comum a todos os grupos que encaminha a mesma fração que o limiar único, achado por bisseção. Ele deixa todos os grupos abaixo do alvo.

**Os outros alvos** estão na tabela do preço. A 0,85, o limiar por grupo encaminharia 51,8 %; a 0,90, 60,8 %. Ficou o alvo da ADR 0014, 0,80, agora dentro de cada grupo.

## A tolerância dos limiares entre plataformas

O `verificar` (ADR 0014, decisão 4) passa a conferir o critério, os grupos e cada limiar do manifest, e classifica cada caso de ouro pelo limiar do grupo dele.

- **Na plataforma do treino,** os limiares são conferidos a `1e-6`, como as métricas.
- **Noutra plataforma,** eles têm tolerância própria: `TOLERANCIA_LIMIARES_ENTRE_PLATAFORMAS = 0,005`, em `backend/app/diabetes/treino/__main__.py`. É mais estreita que a das métricas (0,01), porque o limiar de 18 a 44 anos fica perto de 0,03, e 0,01 deixaria passar um terço dele.

A reprodutibilidade foi remedida com a 1.1.0 (`reprodutibilidade.json`, medido em 2026-10-20), no Windows nas sementes 42 a 47 e no Linux na semente 42. O desvio de cada limiar:

| Limiar | Valor | Windows × Linux, semente 42 | Sementes 43 a 47 × 42, Windows |
|---|---|---|---|
| limiar único | 0,1255 | 0,0001 | 0,0008 |
| 18 a 44 anos | 0,0297 | 0,0002 | 0,0004 |
| 45 a 64 anos | 0,1084 | 0,0007 | 0,0013 |
| 65 anos ou mais | 0,1616 | 0,0009 | 0,0008 |

O maior desvio, 0,0013, cabe na tolerância. `test_a_tolerancia_dos_limiares_cobre_a_medicao_registrada` confere isso contra o JSON.

As probabilidades são as mesmas da 1.0.0, e os desvios delas também: 0,0604 entre plataformas e 0,0799 entre sementes, os da ADR 0014. Entre as métricas novas, a que mais varia entre plataformas é a especificidade de 18 a 44 anos fora da dobra (0,0042). Entre sementes, o maior desvio continua sendo o do recall na precisão fixa (0,0064). Os dois cabem na tolerância das métricas.

## O ouro trocado

Os casos de ouro (`backend/tests/diabetes/dados_ouro/entradas.json`) amarram o modelo servido às predições esperadas. Noutra plataforma, o `verificar` exige a mesma classificação em todos (ADR 0014). Com os limiares novos, quatro casos de 18 a 44 anos foram trocados, cada um por uma mudança só (os índices contam do zero, como os testes):

| Caso | Mudança | Classificação na 1.1.0 |
|---|---|---|
| 1 | pressão alta: "Não" → "Sim" | Risco elevado |
| 6 | IMC: 18,2 → 27,9 | Risco elevado |
| 14 | IMC: 36,1 → 24,6 | Risco baixo |
| 16 | pressão alta: "Não" → "Sim" | Risco elevado |

Os casos 6, 14 e 16 ficavam perto do limiar novo de 18 a 44 anos.

**A regra da M0 não bastou.** A M0 propôs uma margem: cada caso pelo menos tão longe do limiar do seu grupo, em log da chance, quanto o caso mais próximo da 1.0.0 ficava do limiar único, 0,33. Ela foi medida só na semente 42. Na remedição da reprodutibilidade, o caso 1 (18 a 24 anos, IMC 40,9), que a regra não apontava, mudava de classe na semente 44. Um perfil raro varia mais entre treinos do que a margem na semente do modelo publicado deixa ver.

**O portão real é o registro.** `classificacao_estavel`, em `reprodutibilidade.json`, é a classificação de cada caso pelo limiar do grupo dele em cada um dos 7 treinos medidos. Com os quatro casos trocados, ela é verdadeira, com margem mínima de 0,0166 de probabilidade, e `test_treino_cli` a confere. A regra de 0,33 ficou como teste (`test_os_casos_de_ouro_ficam_longe_do_limiar_do_grupo`): uma condição necessária, não suficiente.

## Testes existentes alterados

Na M2, com o ok do autor:

- `test_predicao_api.py::test_predicao_e_deterministica_e_traz_o_contrato`: o limiar do grupo do caso e a chave `grupo_de_idade`;
- a lista de métricas de `test_treino_cli.py::test_treinar_e_verificar_em_pasta_temporaria`, que ganha `limiares-por-idade.json`;
- os quatro casos de ouro acima;
- o snapshot do OpenAPI, que só ganha acréscimos.

Na M3, nenhum: os testes novos do front entram como acréscimo. Na leitura do relatório com o grupo, que entrou depois da M4, também nenhum: as frases de antes continuam no HTML, e os testes novos estão em `test_relatorio_por_grupo.py`.

## Onde está

| Peça | Onde |
|---|---|
| O estudo | notebook 02, células 39 a 49; `CONGELADO_POR_IDADE` na 49 |
| O critério e os grupos | `backend/app/diabetes/treino/avaliacao.py`: `CRITERIO_LIMIAR_POR_IDADE`, `FAIXAS_POR_GRUPO`, `limiares_por_grupo`, `limiar_por_linha`, `tabela_por_idade`, `estabilidade_por_idade` e `pontos_por_idade` |
| O treino e a verificação | `backend/app/diabetes/treino/__main__.py`: `treinar`, `verificar` e `registro_por_idade` |
| Os registros | `artifacts/diabetes/manifest.json` (`limiares_por_idade`) e `artifacts/diabetes/metricas/limiares-por-idade.json` |
| A carga do artefato | `backend/app/diabetes/nucleo/artefato.py`: a tabela conferida e `limiar_de` |
| O contrato | `backend/app/diabetes/esquemas/saida.py` e [`docs/contrato-api.md`](../contrato-api.md#vertente-diabetes) |
| As telas | `frontend/src/features/diabetes/simulador/ResultadoDiabetes.tsx`, `SimuladorDiabetesPage.tsx` e `inicio/SecaoDiabetes.tsx` |
| O relatório | `backend/app/diabetes/dominio/relatorio.py`: `LIMIAR_DO_GRUPO` e `POR_QUE_A_IDADE` |

## Consequências

- **A mesma probabilidade classifica diferente conforme a idade.** "Risco elevado" quer dizer risco elevado para o grupo de idade da pessoa. Uma probabilidade entre 0,0297 e 0,1084 é "Risco elevado" de 18 a 44 anos e "Risco baixo" de 45 a 64. Entre 0,1084 e 0,1616, é elevada de 45 a 64 e baixa a partir dos 65. A resposta, a tela e o relatório dizem o grupo.
- **A precisão cai entre os mais jovens.** Fora da dobra, 0,098 dos encaminhados de 18 a 44 anos têm diabetes, contra 0,300 dos de 65 ou mais. É o preço de achar a mesma parcela dos casos em cada idade.
- **Entre os sexos, o recall continua próximo.** No teste, ele fica em 0,786 (feminino) e 0,815 (masculino) (`por-grupo.json`), contra 0,784 e 0,806 com o limiar único (ADR 0014).
- **Um `.pkl` sem a tabela,** como o da 1.0.0, continua carregável e aplica o limiar único a todas as idades, com aviso no log. A resposta sai com `grupo_de_idade` nulo, e o front e o relatório mostram os textos de antes. Voltar para a 1.0.0 é voltar para o limiar único.
- **A deriva conta só as linhas da versão servida.** As consultas filtram pela versão do modelo e dos dados (ADR 0014, decisão 3). As respostas da 1.0.0 não entram na janela da 1.1.0, e a tela mostra "amostra insuficiente" até chegarem as respostas mínimas da 1.1.0 (`N_MINIMO_DERIVA_DIABETES`).
- **Mudar os grupos ou o critério** é mudar `CORTES_IDADE` e `GRUPOS_IDADE`, ou `CRITERIO_LIMIAR_POR_IDADE`, e treinar uma versão nova. O `verificar` compara o critério e os grupos do manifest com os do código.
- **Um artefato novo** pede a remedição da reprodutibilidade. `test_a_tolerancia_dos_limiares_cobre_a_medicao_registrada` diz se 0,005 ainda cobre o registro.
