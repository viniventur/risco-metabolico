# Dicionário de dados — vertente diabetes

Base pública da segunda vertente: **253.680 registros × 22 colunas** (mais o `ID` do arquivo), versionada em `data/bruto/diabetes/cdc_diabetes_health_indicators.csv` e semeada em `dados.registros_diabetes` no Postgres. São **respostas reais e anonimizadas** do BRFSS 2015, a pesquisa telefônica anual de fatores de risco do CDC dos Estados Unidos; a proveniência completa (repositório público, DOI, conjunto de origem, licença e as quatro divergências entre a página e o arquivo) está em [`../data/bruto/diabetes/FONTE.md`](../data/bruto/diabetes/FONTE.md). Este arquivo **não repete** a citação nem o nome do autor: ele referencia.

O dicionário da vertente de obesidade continua em [`dicionario-de-dados.md`](dicionario-de-dados.md); as duas bases não compartilham coluna nem nome de coluna.

Os mesmos três nomes por coluna da vertente de obesidade, mais um quarto, a variável do BRFSS 2015 de onde a coluna nasceu:

| Camada | Convenção | Exemplo |
|---|---|---|
| CSV público | nome original em inglês | `HighBP` |
| BRFSS 2015 (codebook) | variável da pesquisa, antes da limpeza | `_RFHYPE5` |
| Modelo, API e notebook (`COLUNAS_MAP` em `backend/app/diabetes/dominio/features.py`) | português, `Snake_Case` com inicial maiúscula | `Pressao_Alta` |
| Banco (`dados.registros_diabetes`) | português, `snake_case` minúsculo, sem aspas | `pressao_alta` |

A coluna `ID` do arquivo (0 a 253.679) é a posição da linha: o seed confere isso e a grava como `linha_origem`, a chave do banco. `python -m app.diabetes.dados.schema --conferir` compara os três conjuntos — esta tabela, `COLUNAS_MAP` e `information_schema.columns` — e falha na primeira divergência.

## As 22 colunas

| # | CSV | BRFSS 2015 | Modelo / API | Banco | Tipo SQL | dtype pandas | Domínio no CSV → valor | Significado |
|---|---|---|---|---|---|---|---|---|
| 1 | `Diabetes_binary` | `DIABETE3` | `Diabetes` | `diabetes` | `text` | `object` | `0` → `Não`, `1` → `Sim` | **Alvo**: "(alguma vez um profissional de saúde disse que) você tem diabetes?". Só o "sim" vira 1; "sim, mas só na gravidez", "não" e "não, pré-diabetes ou limítrofe" viram 0 (FONTE.md, divergência 1) |
| 2 | `HighBP` | `_RFHYPE5` | `Pressao_Alta` | `pressao_alta` | `text` | `object` | `0` → `Não`, `1` → `Sim` | Já ouviu de um profissional de saúde que tem pressão alta; só na gravidez e limítrofe contam como não |
| 3 | `HighChol` | `TOLDHI2` | `Colesterol_Alto` | `colesterol_alto` | `text` | `object` | `0` → `Não`, `1` → `Sim` | Já ouviu de um profissional de saúde que tem colesterol alto |
| 4 | `CholCheck` | `_CHOLCHK` | `Exame_Colesterol_5_Anos` | `exame_colesterol_5_anos` | `text` | `object` | `0` → `Não`, `1` → `Sim` | Mediu o colesterol nos últimos 5 anos. Quem nunca mediu não responde à pergunta de colesterol alto e saiu da base na limpeza: o `Não` daqui é, na prática, "mediu há mais de 5 anos" |
| 5 | `BMI` | `_BMI5` | `IMC` | `imc` | `double precision` | `float64` | inteiro, 12 a 98 | IMC calculado pelo CDC com o peso e a altura informados, dividido por 100 e arredondado ao inteiro pela limpeza (`round` do pandas, que desempata para o par) |
| 6 | `Smoker` | `SMOKE100` | `Fumou_100_Cigarros` | `fumou_100_cigarros` | `text` | `object` | `0` → `Não`, `1` → `Sim` | Fumou pelo menos 100 cigarros (5 maços) na vida — não é "fuma hoje" |
| 7 | `Stroke` | `CVDSTRK3` | `Teve_AVC` | `teve_avc` | `text` | `object` | `0` → `Não`, `1` → `Sim` | Já ouviu de um profissional de saúde que teve um AVC |
| 8 | `HeartDiseaseorAttack` | `_MICHD` | `Doenca_Coronariana_Ou_Infarto` | `doenca_coronariana_ou_infarto` | `text` | `object` | `0` → `Não`, `1` → `Sim` | Já relatou doença coronariana ou infarto |
| 9 | `PhysActivity` | `_TOTINDA` | `Atividade_Fisica_30_Dias` | `atividade_fisica_30_dias` | `text` | `object` | `0` → `Não`, `1` → `Sim` | Fez atividade física ou exercício nos últimos 30 dias, fora do trabalho |
| 10 | `Fruits` | `_FRTLT1` | `Fruta_Diaria` | `fruta_diaria` | `text` | `object` | `0` → `Não`, `1` → `Sim` | Come fruta uma vez ou mais por dia |
| 11 | `Veggies` | `_VEGLT1` | `Verdura_Diaria` | `verdura_diaria` | `text` | `object` | `0` → `Não`, `1` → `Sim` | Come verduras ou legumes uma vez ou mais por dia |
| 12 | `HvyAlcoholConsump` | `_RFDRHV5` | `Consumo_Pesado_Alcool` | `consumo_pesado_alcool` | `text` | `object` | `0` → `Não`, `1` → `Sim` | Bebe mais de 14 doses por semana (homens) ou mais de 7 (mulheres) |
| 13 | `AnyHealthcare` | `HLTHPLN1` | `Cobertura_Saude` | `cobertura_saude` | `text` | `object` | `0` → `Não`, `1` → `Sim` | Tem alguma cobertura de saúde: seguro, plano pré-pago ou programa do governo |
| 14 | `NoDocbcCost` | `MEDCOST` | `Deixou_Medico_Por_Custo` | `deixou_medico_por_custo` | `text` | `object` | `0` → `Não`, `1` → `Sim` | Nos últimos 12 meses, precisou ir ao médico e não foi por causa do custo |
| 15 | `GenHlth` | `GENHLTH` | `Saude_Geral` | `saude_geral` | `smallint` | `int64` | escala 1–5 | Como avalia a própria saúde em geral (rótulos abaixo) |
| 16 | `MentHlth` | `MENTHLTH` | `Dias_Saude_Mental_Ruim` | `dias_saude_mental_ruim` | `smallint` | `int64` | inteiro, 0 a 30 | Dias, dos últimos 30, em que a saúde mental (estresse, depressão, emoções) não esteve boa; "nenhum" vira 0 |
| 17 | `PhysHlth` | `PHYSHLTH` | `Dias_Saude_Fisica_Ruim` | `dias_saude_fisica_ruim` | `smallint` | `int64` | inteiro, 0 a 30 | Dias, dos últimos 30, em que a saúde física (doença ou lesão) não esteve boa; "nenhum" vira 0 |
| 18 | `DiffWalk` | `DIFFWALK` | `Dificuldade_Caminhar` | `dificuldade_caminhar` | `text` | `object` | `0` → `Não`, `1` → `Sim` | Tem dificuldade séria para andar ou subir escadas |
| 19 | `Sex` | `SEX` | `Sexo` | `sexo` | `text` | `object` | `0` → `Feminino`, `1` → `Masculino` | Sexo do respondente, como a pesquisa o registrou |
| 20 | `Age` | `_AGEG5YR` | `Faixa_Etaria` | `faixa_etaria` | `smallint` | `int64` | escala 1–13 | Faixa etária de 5 anos, de 18 a 24 até 80 ou mais (rótulos abaixo) |
| 21 | `Education` | `EDUCA` | `Escolaridade` | `escolaridade` | `smallint` | `int64` | escala 1–6 | Maior série ou ano de estudo concluído (rótulos abaixo) |
| 22 | `Income` | `INCOME2` | `Faixa_Renda` | `faixa_renda` | `smallint` | `int64` | escala 1–8 | Renda anual do domicílio, de todas as fontes, em dólares de 2015 (rótulos abaixo) |

Corte das 22: **o alvo** (1) + **13 binárias** `Sim`/`Não` (2–4, 6–14, 18) + **o sexo** (19) + **6 inteiras** (15–17, 20–22) + **o IMC** (5). Na limpeza da origem, toda resposta com valor ausente ou com "não sabe"/"recusou" em qualquer uma das 22 variáveis saiu da base (FONTE.md); por isso nenhuma coluna tem nulo nem código de "não sabe".

As mesmas regras de tipo da vertente de obesidade: `numeric` e `real` são proibidos em `dados.registros_diabetes`, e o `smallint` é lido como `int64` no pandas. O IMC é `double precision` mesmo sendo inteiro no arquivo: a API o recebe com casas decimais e o arredonda como a limpeza da origem arredondou, e igualar os dois lados é o que sustenta a paridade treino/serviço.

## Domínios e contagens

Contagens sobre as 253.680 linhas, conferidas contra o CSV por `tests/diabetes/test_features.py`.

| Coluna | Domínio e contagem |
|---|---|
| `Diabetes` | Não 218.334 · Sim 35.346 |
| `Pressao_Alta` | Não 144.851 · Sim 108.829 |
| `Colesterol_Alto` | Não 146.089 · Sim 107.591 |
| `Exame_Colesterol_5_Anos` | Não 9.470 · Sim 244.210 |
| `Fumou_100_Cigarros` | Não 141.257 · Sim 112.423 |
| `Teve_AVC` | Não 243.388 · Sim 10.292 |
| `Doenca_Coronariana_Ou_Infarto` | Não 229.787 · Sim 23.893 |
| `Atividade_Fisica_30_Dias` | Não 61.760 · Sim 191.920 |
| `Fruta_Diaria` | Não 92.782 · Sim 160.898 |
| `Verdura_Diaria` | Não 47.839 · Sim 205.841 |
| `Consumo_Pesado_Alcool` | Não 239.424 · Sim 14.256 |
| `Cobertura_Saude` | Não 12.417 · Sim 241.263 |
| `Deixou_Medico_Por_Custo` | Não 232.326 · Sim 21.354 |
| `Dificuldade_Caminhar` | Não 211.005 · Sim 42.675 |
| `Sexo` | Feminino 141.974 · Masculino 111.706 |

## As 4 escalas e os seus rótulos

Os rótulos são de **apresentação** (painel, formulário, relatório) e vivem em `regras.ROTULOS_ESCALA`; o modelo vê o inteiro. A faixa etária e a renda seguem as faixas do codebook; a escolaridade traduz a série concluída do sistema escolar dos Estados Unidos ("Grades 1 through 8", "Grade 12 or GED"…) pelo equivalente mais próximo no Brasil; a renda fica em dólares de 2015, sem conversão — é por isso que ela não entra como pergunta no simulador.

#### `Saude_Geral`

| Valor | Rótulo | Contagem |
|---|---|---|
| 1 | Excelente | 45.299 |
| 2 | Muito boa | 89.084 |
| 3 | Boa | 75.646 |
| 4 | Regular | 31.570 |
| 5 | Ruim | 12.081 |

#### `Faixa_Etaria`

| Valor | Rótulo | Contagem |
|---|---|---|
| 1 | 18 a 24 anos | 5.700 |
| 2 | 25 a 29 anos | 7.598 |
| 3 | 30 a 34 anos | 11.123 |
| 4 | 35 a 39 anos | 13.823 |
| 5 | 40 a 44 anos | 16.157 |
| 6 | 45 a 49 anos | 19.819 |
| 7 | 50 a 54 anos | 26.314 |
| 8 | 55 a 59 anos | 30.832 |
| 9 | 60 a 64 anos | 33.244 |
| 10 | 65 a 69 anos | 32.194 |
| 11 | 70 a 74 anos | 23.533 |
| 12 | 75 a 79 anos | 15.980 |
| 13 | 80 anos ou mais | 17.363 |

#### `Escolaridade`

| Valor | Rótulo | Contagem |
|---|---|---|
| 1 | Nunca estudou ou só a pré-escola | 174 |
| 2 | Da 1ª à 8ª série | 4.043 |
| 3 | Da 9ª à 11ª série | 9.478 |
| 4 | Ensino médio completo | 62.750 |
| 5 | Superior incompleto ou curso técnico | 69.910 |
| 6 | Superior completo | 107.325 |

#### `Faixa_Renda`

| Valor | Rótulo | Contagem |
|---|---|---|
| 1 | Menos de US$ 10 mil | 9.811 |
| 2 | US$ 10 mil a 15 mil | 11.783 |
| 3 | US$ 15 mil a 20 mil | 15.994 |
| 4 | US$ 20 mil a 25 mil | 20.135 |
| 5 | US$ 25 mil a 35 mil | 25.883 |
| 6 | US$ 35 mil a 50 mil | 36.470 |
| 7 | US$ 50 mil a 75 mil | 43.219 |
| 8 | US$ 75 mil ou mais | 90.385 |

## As duas numéricas de dias e o IMC

`Dias_Saude_Mental_Ruim` e `Dias_Saude_Fisica_Ruim` vão de 0 a 30, com a maior parte das respostas em 0 (nenhum dia ruim) e um segundo acúmulo em 30 (o mês inteiro). O `IMC` vai de 12 a 98 — os extremos são o que as pessoas informaram de peso e altura, sem correção; `regras.FAIXAS_TREINO` guarda essa faixa observada, que a API usa para avisar quando uma entrada sai dela.
