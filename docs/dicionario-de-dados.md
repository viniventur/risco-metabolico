# Dicionário de dados

Base pública de triagem metabólica: **2.111 registros × 17 colunas**, versionada em `data/bruto/obesity.csv` e semeada em `dados.registros_triagem` no Postgres. Os registros são **fictícios/sintéticos** — nenhum corresponde a pessoa real — e a proveniência completa (conjunto, repositório público, DOI, licença e a nota dos autores sobre a parte sintética) está em [`../data/bruto/FONTE.md`](../data/bruto/FONTE.md). Este arquivo **não repete** a citação nem os nomes dos autores: ele referencia.

Três nomes para cada coluna, e os três convivem de propósito:

| Camada | Convenção | Exemplo |
|---|---|---|
| CSV público (`data/bruto/obesity.csv`) | nome original em inglês | `FCVC` |
| Modelo, API e notebook (`colunas_map` em `dominio/features.py`) | português, `Snake_Case` com inicial maiúscula | `Consumo_Vegetais` |
| Banco (`dados.registros_triagem`) | português, `snake_case` minúsculo, sem aspas | `consumo_vegetais` |

O banco usa minúsculas porque identificador não citado em Postgres é dobrado para minúsculo; o CLI de treino renomeia de volta para o nome do modelo logo depois do `SELECT`, usando o mesmo `colunas_map`. `tests/test_proveniencia.py` confere que os três conjuntos coincidem (dicionário, `colunas_map`, `information_schema.columns`).

## As 17 colunas

| # | CSV | Modelo / API | Banco | Tipo SQL | dtype pandas | Domínio no CSV → valor em português | Significado |
|---|---|---|---|---|---|---|---|
| 1 | `Gender` | `Genero` | `genero` | `text` | `object` | `Female` → `Feminino`, `Male` → `Masculino` | Sexo biológico |
| 2 | `Age` | `Idade` | `idade` | `double precision` | `float64` | contínuo, 14,0 a 61,0 | Idade em anos |
| 3 | `Height` | `Altura` | `altura` | `double precision` | `float64` | contínuo, 1,45 a 1,98 | Altura em metros |
| 4 | `Weight` | `Peso` | `peso` | `double precision` | `float64` | contínuo, 39,0 a 173,0 | Peso em quilogramas |
| 5 | `family_history` | `Historico_Familiar_Sobrepeso` | `historico_familiar_sobrepeso` | `text` | `object` | `yes` → `Sim`, `no` → `Não` | Histórico familiar de excesso de peso |
| 6 | `FAVC` | `Consumo_Calorico_Frequente` | `consumo_calorico_frequente` | `text` | `object` | `yes` → `Sim`, `no` → `Não` | Consumo frequente de alimentos muito calóricos |
| 7 | `FCVC` | `Consumo_Vegetais` | `consumo_vegetais` | `smallint` | `int64` | escala 1–3 (arredondada): 1 raramente, 2 às vezes, 3 sempre | Frequência de consumo de vegetais nas refeições |
| 8 | `NCP` | `Numero_Refeicoes_Principais` | `numero_refeicoes_principais` | `smallint` | `int64` | escala 1–4 (arredondada): 1, 2, 3, 4 ou mais | Número de refeições principais por dia |
| 9 | `CAEC` | `Consumo_Alimentos_Entre_Refeicoes` | `consumo_alimentos_entre_refeicoes` | `text` | `object` | `no` → `Não`, `Sometimes` → `Às vezes`, `Frequently` → `Frequentemente`, `Always` → `Sempre` | Consumo de lanches entre as refeições |
| 10 | `SMOKE` | `Fumante` | `fumante` | `text` | `object` | `yes` → `Sim`, `no` → `Não` | Hábito de fumar |
| 11 | `CH2O` | `Consumo_Agua_Diario` | `consumo_agua_diario` | `smallint` | `int64` | escala 1–3 (arredondada): 1 < 1 L/dia, 2 1–2 L/dia, 3 > 2 L/dia | Consumo diário de água |
| 12 | `SCC` | `Monitoramento_Calorias` | `monitoramento_calorias` | `text` | `object` | `yes` → `Sim`, `no` → `Não` | Monitora a ingestão calórica diária |
| 13 | `FAF` | `Atividade_Fisica_Frequencia` | `atividade_fisica_frequencia` | `smallint` | `int64` | escala 0–3 (arredondada): 0 nenhuma, 1 1–2×/sem, 2 3–4×/sem, 3 5×/sem ou mais | Frequência semanal de atividade física |
| 14 | `TUE` | `Tempo_Dispositivos_Tecnologicos` | `tempo_dispositivos_tecnologicos` | `smallint` | `int64` | escala 0–2 (arredondada): 0 0–2 h/dia, 1 3–5 h/dia, 2 > 5 h/dia | Tempo diário usando dispositivos eletrônicos |
| 15 | `CALC` | `Consumo_Alcool` | `consumo_alcool` | `text` | `object` | `no` → `Não`, `Sometimes` → `Às vezes`, `Frequently` → `Frequentemente`, `Always` → `Sempre` | Consumo de bebida alcoólica |
| 16 | `MTRANS` | `Meio_Transporte` | `meio_transporte` | `text` | `object` | `Automobile` → `Carro`, `Motorbike` → `Moto`, `Bike` → `Bicicleta`, `Public_Transportation` → `Transporte Público`, `Walking` → `Caminhada` | Meio de transporte habitual |
| 17 | `Obesity` | `Nivel_Obesidade` | `nivel_obesidade` | `text` | `object` | `Insufficient_Weight` → `Abaixo do Peso`, `Normal_Weight` → `Peso Normal`, `Overweight_Level_I` → `Sobrepeso I`, `Overweight_Level_II` → `Sobrepeso II`, `Obesity_Type_I` → `Obesidade I`, `Obesity_Type_II` → `Obesidade II`, `Obesity_Type_III` → `Obesidade III` | **Alvo**: classe de composição corporal |

Corte das 17: **3 numéricas** (2–4) + **5 escalas ordinais** (7, 8, 11, 13, 14) + **8 categóricas** (1, 5, 6, 9, 10, 12, 15, 16) + **o alvo** (17). As 16 primeiras são as features de entrada do modelo (`EntradaTriagem`), na ordem desta tabela.

`numeric` e `real` são proibidos em `dados.registros_triagem`: `numeric` volta como `Decimal` e quebra o `float64` do snapshot congelado; `real` é 32 bits e perde dígito. O `smallint` das escalas é lido como `int64` no pandas de propósito — é o dtype que a API produz a partir do JSON de entrada, e igualar os dois lados é o que sustenta a paridade treino/serviço.

## As 5 escalas ordinais

No CSV os valores das escalas aparecem **com decimais** (ruído da geração sintética: `2.4`, `0.7`, `1.3`). A regra, herdada do dicionário original e congelada no notebook de estudo (célula 5), é **arredondar para o inteiro mais próximo** (`round().astype(int)`) antes de qualquer uso. Contagens após o arredondamento:

| Coluna | Valores | Contagem (n = 2.111) | Rótulo de exibição (`ROTULOS_ESCALA`) |
|---|---|---|---|
| `Consumo_Vegetais` | 1, 2, 3 | 102 · 1.013 · 996 | baixa · moderada · alta |
| `Numero_Refeicoes_Principais` | 1, 2, 3, 4 | 316 · 176 · 1.470 · 149 | 1-2 · 1-2 · 3 · 4+ |
| `Consumo_Agua_Diario` | 1, 2, 3 | 485 · 1.110 · 516 | <1L · 1-2L · >2L |
| `Atividade_Fisica_Frequencia` | 0, 1, 2, 3 | 720 · 776 · 496 · 119 | nenhuma · baixa · media · alta |
| `Tempo_Dispositivos_Tecnologicos` | 0, 1, 2 | 952 · 915 · 244 | 0-2h · 3-5h · >5h |

As escalas entram no modelo como **inteiros crus, no ramo categórico** do `OneHotEncoder` (3 + 4 + 3 + 4 + 3 = **17** colunas one-hot) — por decisão registrada no ADR 0002, não por acidente de `dtype`. O rótulo de exibição é de apresentação (painel e slicers) e nunca chega ao modelo.

## Domínios das categóricas e do alvo (contagens no CSV)

| Coluna | Domínio (português) e contagem |
|---|---|
| `Genero` | Masculino 1.068 · Feminino 1.043 |
| `Historico_Familiar_Sobrepeso` | Sim 1.726 · Não 385 |
| `Consumo_Calorico_Frequente` | Sim 1.866 · Não 245 |
| `Consumo_Alimentos_Entre_Refeicoes` | Às vezes 1.765 · Frequentemente 242 · Sempre 53 · Não 51 |
| `Fumante` | Não 2.067 · Sim 44 |
| `Monitoramento_Calorias` | Não 2.015 · Sim 96 |
| `Consumo_Alcool` | Às vezes 1.401 · Não 639 · Frequentemente 70 · **Sempre 1** |
| `Meio_Transporte` | Transporte Público 1.580 · Carro 457 · Caminhada 56 · **Moto 11** · **Bicicleta 7** |
| `Nivel_Obesidade` (alvo) | Obesidade I 351 · Obesidade III 324 · Obesidade II 297 · Sobrepeso I 290 · Sobrepeso II 290 · Peso Normal 287 · Abaixo do Peso 272 |

Três categorias raras merecem atenção em todo teste: `Consumo_Alcool = 'Sempre'` (1 ocorrência), `Meio_Transporte = 'Moto'` (11) e `'Bicicleta'` (7). Uma amostra de 200 linhas quase sempre as perde; por isso a fixture de teste completa a amostra estratificada com `groupby(col).head(3)` em cada categórica, e o encoder recebe `categories=` explícito vindo de `DOMINIOS` em `dominio/regras.py`.

Total de one-hot do modelo: 23 (categóricas: 2+2+2+4+2+2+4+5) + 17 (escalas) = **40**, mais 3 numéricas = **43** features de modelo (a largura real vem do manifest, nunca deste texto).

## Duas ordens para as 7 classes

| Ordem | Sequência | Onde vale |
|---|---|---|
| Alfabética (`LabelEncoder`) | Abaixo do Peso · Obesidade I · Obesidade II · Obesidade III · Peso Normal · Sobrepeso I · Sobrepeso II | vetor de `predict_proba`, campo `classes` do manifest |
| Clínica crescente (`ORDEM_CLINICA`) | Abaixo do Peso · Peso Normal · Sobrepeso I · Sobrepeso II · Obesidade I · Obesidade II · Obesidade III | resposta da API, gráficos, `por-nivel.sql` |

As **classes de risco** (`CLASSES_RISCO`) são as 5 últimas da ordem clínica; `risco_acumulado` é a soma das suas probabilidades. `Abaixo do Peso` e `Peso Normal` são as `CLASSES_SEGURAS`.

## Faixas de IMC (métrica de tela, não feature)

`IMC = Peso / Altura²`, arredondado a 2 casas na exibição. É um vocabulário **separado** do das 7 classes do modelo (`FaixaImc`, 6 valores): `< 18,5` Abaixo do Peso · `18,5–25` Peso Ideal · `25–30` Sobrepeso · `30–35` Obesidade Grau I · `35–40` Obesidade Grau II · `≥ 40` Obesidade Grau III. O IMC não entra no modelo (ADR 0003).
