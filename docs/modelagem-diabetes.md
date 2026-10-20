# Modelagem — vertente diabetes

A modelagem da segunda vertente (ADR 0013), do estudo ao artefato servido.

- **O estudo** é o notebook `study/02_triagem_de_diabetes.ipynb`.
- **O modelo servido** sai do CLI `python -m app.diabetes.treino` (`backend/app/diabetes/treino/`), que reproduz a configuração que o notebook congelou nas células 38 e 49 (a 49 é o limiar por grupo de idade).

Nenhuma métrica publicada aparece escrita à mão: tudo vem de `artifacts/diabetes/manifest.json`, servido por `GET /api/v1/diabetes/model/info`. As tabelas abaixo copiam as saídas das células citadas, registradas como evidência de cada escolha; o *Run All* do notebook as regenera.

## Contexto e dados

- **Base.** *CDC Diabetes Health Indicators* (UCI 891), cópia do BRFSS 2015: respostas reais e anonimizadas, 21 variáveis e o alvo. A proveniência está em `data/bruto/diabetes/FONTE.md`; as colunas, em `docs/dicionario-de-dados-diabetes.md`.
- **Alvo (D1).** `Diabetes = Sim` é quem já ouviu de um profissional de saúde que tem diabetes. O pré-diabetes e o diabetes só na gravidez ficam no `Não` (FONTE.md, divergência 1). A prevalência é a da base, sem pesos amostrais, e não estima a da população.
- **Snapshot.** O treino não lê o CSV: lê o snapshot congelado. `python -m app.diabetes.treino snapshot` grava um `SELECT ... ORDER BY linha_origem` de `dados.registros_diabetes` em `data/processado/diabetes/`, com os parâmetros do writer fixos. Os 12 primeiros caracteres do sha256 desse arquivo são o `versao_dados` do manifest.
- **Preparação.** Nomes em português, `0`/`1` em `Não`/`Sim` e o sexo em `Feminino`/`Masculino`: `app/diabetes/dominio/features.py::preparar_base`, a célula 2 do notebook. A célula 3 prova por `assert_frame_equal` que a preparação e o arredondamento do IMC do notebook e do backend dão o mesmo resultado.

## Entradas (D2)

Dez respostas que uma pessoa sabe antes de qualquer diagnóstico:

- faixa etária e sexo;
- IMC;
- pressão alta e colesterol alto;
- se fumou 100 cigarros na vida;
- atividade física nos últimos 30 dias;
- fruta e verdura todo dia;
- escolaridade.

Ficam de fora as consequências da doença, o acesso ao diagnóstico, as complicações, o álcool pesado (associação invertida) e a renda (dólares de 2015). Os critérios e o custo medido de cada exclusão (célula 16) estão na ADR 0013. As 21 variáveis seguem no banco, na Consulta e no gráfico de fatores.

O contrato (`EntradaDiabetes`) aceita o IMC de 10 a 100, uma faixa mais larga que a da base. Valores fora da faixa da base voltam em `fora_do_dominio_treino`, como na vertente de obesidade.

## Pipeline

Passos nomeados, os mesmos do notebook (célula 15, ramo das árvores), serializados com `joblib`. Estão em `app/diabetes/treino/pipeline.py`.

| Passo | O que faz | Por quê |
|---|---|---|
| `imc` | `FunctionTransformer(arredondar_imc)`: o IMC ao inteiro | a limpeza da origem arredondou o IMC do BRFSS; o modelo vê o que a base viu |
| `colunas` | `ColumnTransformer`: `OrdinalEncoder` com o domínio explícito e `handle_unknown='error'` nas seis respostas de sim ou não e no sexo; `passthrough` na faixa etária, no IMC e na escolaridade | árvores não precisam de one-hot nas escalas ordinais; categoria desconhecida é erro, nunca zero em silêncio |
| `modelo` | `XGBClassifier` | o critério abaixo |

Sem *sampler* e sem calibração: o notebook mediu os dois, e nenhum reduziu o Brier fora da dobra (seções abaixo). A largura do modelo, igual ao número de entradas, é lida de `get_feature_names_out()` e gravada em `n_features_modelo`.

## Split e validação cruzada (congelados)

- `train_test_split(test_size=0.2, random_state=42, stratify=y)`. As linhas de treino e de teste e a prevalência de cada lado ficam no `split` do manifest.
- `StratifiedKFold(n_splits=5, shuffle=True, random_state=42)` sobre o treino. As mesmas cinco dobras servem à escolha do modelo, ao desbalanceamento, à calibração e aos limiares.

## Candidatos e critério de escolha

- **Três baselines dão a régua:**
  - a prevalência: a mesma probabilidade para todos;
  - só o IMC, como escore;
  - a regressão logística com as dez entradas, as escalas em one-hot e as contínuas padronizadas.
- **Contra eles,** XGBoost (`max_depth` 3 ou 5 × `n_estimators` 300 ou 600) e LightGBM (`num_leaves` 15 ou 31 × 300 ou 600), com os demais hiperparâmetros fixos nas fábricas da célula 15.
- **Critério**, fixado antes de ver os números (célula 18):
  - vence a maior PR-AUC média na validação cruzada do treino;
  - há empate quando a diferença para o melhor é menor que o desvio-padrão do melhor entre as dobras;
  - o empate se resolve pelo menor Brier (4 casas) e depois pelo modelo mais simples: menos árvores, depois menos profundo.

Resultado (célula 20, validação cruzada de 5 dobras no treino):

| Modelo | Parâmetros | ROC-AUC | PR-AUC (dp) | Brier |
|---|---|---|---|---|
| **XGBoost** | **`max_depth=3`, `n_estimators=300`** | **0,8002** | **0,3847 (0,0074)** | **0,1014** |
| XGBoost | `max_depth=3`, `n_estimators=600` | 0,8002 | 0,3840 (0,0074) | 0,1014 |
| LightGBM | `num_leaves=15`, `n_estimators=300` | 0,8003 | 0,3839 (0,0074) | 0,1014 |
| XGBoost | `max_depth=5`, `n_estimators=300` | 0,7998 | 0,3821 (0,0075) | 0,1015 |
| LightGBM | `num_leaves=15`, `n_estimators=600` | 0,7995 | 0,3818 (0,0074) | 0,1016 |
| LightGBM | `num_leaves=31`, `n_estimators=300` | 0,7994 | 0,3816 (0,0082) | 0,1016 |
| XGBoost | `max_depth=5`, `n_estimators=600` | 0,7985 | 0,3784 (0,0077) | 0,1018 |
| LightGBM | `num_leaves=31`, `n_estimators=600` | 0,7978 | 0,3781 (0,0079) | 0,1019 |
| regressão logística | — | 0,7932 | 0,3641 (0,0042) | 0,1031 |
| só o IMC (escore) | — | 0,6900 | 0,2485 (0,0058) | — |
| prevalência | — | 0,5000 | 0,1393 (0,0000) | 0,1199 |

Os boosters empatam pelo critério. O desempate escolhe o XGBoost raso, com menos árvores: com dez respostas curtas, não há interação complexa a aprender. A regressão logística fica abaixo deles por mais que o ruído entre as dobras.

Hiperparâmetros congelados (`HIPERPARAMETROS` em `pipeline.py` e `hiperparametros` no manifest):

| Candidato | Hiperparâmetros |
|---|---|
| XGBoost | `n_estimators=300, learning_rate=0.05, max_depth=3, subsample=0.8, colsample_bytree=0.8, objective='binary:logistic', eval_metric='logloss', tree_method='hist', random_state=42, n_jobs=8` |

## Desbalanceamento: nenhum tratamento

A classe positiva é minoria. Foram medidos três tratamentos com o modelo escolhido, pelo mesmo critério (célula 23):

- **nenhum**;
- **peso de classe**: `scale_pos_weight` igual a negativos ÷ positivos;
- **SMOTE**: dentro do pipeline, só no ajuste de cada dobra.

| Tratamento | ROC-AUC | PR-AUC | Brier |
|---|---|---|---|
| **nenhum** | **0,8002** | **0,3847** | **0,1014** |
| peso de classe | 0,8002 | 0,3846 | 0,1883 |
| SMOTE | 0,7912 | 0,3646 | 0,1323 |

O peso de classe não muda a ordenação e quase dobra o Brier: a probabilidade passaria a dizer mais do que a base sustenta. O SMOTE piora as duas coisas e ainda interpola respostas codificadas, criando pessoas com "meio sim". O desbalanceamento se resolve no limiar, que é onde a decisão de encaminhar mora.

## Calibração: nenhuma

A regressão isotônica (`CalibratedClassifierCV`, `cv=3`, ajustada dentro de cada dobra) só entraria se reduzisse o Brier fora da dobra (célula 26). Os dois deram 0,1014, então a calibração ficou de fora: é um passo a menos entre o treino e o serviço. A curva de confiabilidade da probabilidade crua acompanha a diagonal.

A probabilidade é calibrada **na escala da base**: frequência entre os respondentes da pesquisa, não na população. O Brier do teste e o de chutar a prevalência estão no manifest (`metricas_teste.brier` e `brier_da_prevalencia`).

## Limiar de triagem (D4 e ADR 0015)

O critério foi escrito antes de ver os números (célula 28): o maior limiar com recall ≥ 0,80 nas predições fora da dobra do treino. Ele é aplicado em dois níveis:

- **Na base inteira,** ele dá o limiar único (`avaliacao.py::CRITERIO_LIMIAR`). Foi o que classificou na versão 1.0.0, e o manifest o guarda como referência (`limiar`).
- **Dentro de cada grupo de idade** (18 a 44, 45 a 64 e 65 anos ou mais), ele dá um limiar por grupo (células 39 a 49; `avaliacao.py::CRITERIO_LIMIAR_POR_IDADE` e `FAIXAS_POR_GRUPO`). É o que classifica desde a 1.1.0. O manifest o guarda em `limiares_por_idade`, e a API responde o limiar do grupo da pessoa, com `grupo_de_idade`.

O `treinar` recalcula os dois sobre o snapshot, e os valores servidos estão no manifest. Com um limiar só, o recall chegava ao alvo na média, mas ficava baixo entre os mais jovens. Com um limiar por grupo, ele chega ao alvo em cada idade, com mais encaminhados para o mesmo recall total. A justificativa, as alternativas medidas e o preço estão na ADR 0015; o preço de cada alvo com o limiar único, na ADR 0014.

## Avaliação, uma vez, no teste

Com tudo decidido, o modelo é ajustado no treino inteiro e avaliado **uma única vez** no teste, cada pessoa no limiar do grupo de idade dela:

- ROC-AUC, PR-AUC, Brier e o Brier da prevalência;
- o recall com precisão fixa de 0,30;
- recall, precisão, especificidade e a fração encaminhada no limiar do grupo de cada pessoa.

Os números estão no `metricas_teste` do manifest, servidos por `/diabetes/model/info`, e a seção "Triagem de diabetes" do Início os mostra. Os artefatos ao lado do manifest:

- `artifacts/diabetes/metricas/matriz-confusao.json`: a matriz, cada pessoa no limiar do grupo dela;
- `artifacts/diabetes/metricas/pontos-de-operacao.json`: o preço de cada alvo de recall com o limiar único, fora da dobra;
- `artifacts/diabetes/metricas/limiares-por-idade.json`: a escolha dos limiares por grupo, com cada grupo fora da dobra e no teste ao lado do limiar único, a estabilidade entre as dobras e o preço de cada alvo;
- `artifacts/diabetes/metricas/por-grupo.json`: o desempenho por sexo e pelos três grupos de idade, com o limiar de cada grupo.

A importância por ganho (célula 35) se concentra em pressão alta, IMC, faixa etária e colesterol alto. A probabilidade média prevista acompanha a observada por faixa de IMC e por faixa etária, inclusive no recuo das idades mais altas: o modelo não aprendeu nenhuma direção invertida.

## Reprodutibilidade

```powershell
docker compose up -d --wait banco
$env:BANCO_URL = "postgresql://postgres:postgres@127.0.0.1:55432/app_local"
Push-Location backend
uv run --extra treino python -m app.diabetes.dados.seed                    # uma vez; idempotente
uv run --extra treino python -m app.diabetes.treino snapshot               # snapshot congelado + versao_dados no manifest
uv run --extra treino python -m app.diabetes.treino verificar              # retreina e compara: roda no CI, não escreve nada
Pop-Location
```

Um modelo novo sai de `python -m app.diabetes.treino treinar --versao X.Y.Z`, que escreve o `.pkl`, o manifest, as métricas e as saídas de ouro (README, seção 18). Retreinar a versão publicada trocaria o sha256 do `.pkl`, que deixaria de bater com o asset do release.

O `verificar` retreina sobre o **mesmo** snapshot. Ele compara:

- a configuração: entradas, algoritmo, hiperparâmetros, desbalanceamento, calibração, o critério do limiar único e o do limiar por grupo, com os grupos;
- os limiares e as métricas;
- as predições sobre `backend/tests/diabetes/dados_ouro/entradas.json`, cada caso classificado pelo limiar do grupo dele.

O sha256 do `.pkl` fica de fora, porque nunca é byte a byte igual.

- **Na plataforma do treino:** o sha256 exato das predições de ouro.
- **Noutra plataforma:** a mesma classificação nos casos de ouro e as tolerâncias medidas entre Windows e Linux. O XGBoost não dá o mesmo modelo nas duas (ADR 0014, decisão 4). Os limiares têm tolerância própria, mais estreita que a das métricas (ADR 0015).

## Limitações

- **Autodeclarado.** Diagnósticos, hábitos e o próprio IMC (calculado de peso e altura informados ao telefone) são o que a pessoa respondeu.
- **Transversal.** É uma resposta por pessoa, num momento só: associação, não causa. Quem já tem o diagnóstico pode ter mudado os hábitos depois dele.
- **O alvo é o diagnóstico recebido.** Quem tem diabetes e não sabe está entre os negativos, e o modelo aprende "ter sido diagnosticado". O pré-diabetes conta como "não", e a pergunta do BRFSS não separa o tipo 1 do tipo 2. As entradas foram escolhidas para reduzir esse viés, não para eliminá-lo.
- **Um limiar por grupo de idade.** O recall chega ao alvo em cada idade, mas a mesma probabilidade passa a ter classificações diferentes conforme a idade. O total encaminhado é maior que o de um limiar único com o mesmo recall (ADR 0015).
- **Sem pesos e só casos completos.** A probabilidade está na escala da base. Ela não vale para a população dos Estados Unidos, e menos ainda para a do Brasil, onde hábitos, escolaridade e o sistema de saúde são outros. Nenhuma validação externa foi feita.

## Diferenças para a modelagem da obesidade

| | Obesidade (`docs/modelagem.md`) | Diabetes |
|---|---|---|
| Alvo | 7 faixas, multiclasse | binário, com um limiar por grupo de idade |
| Base | majoritariamente sintética | respostas reais e anonimizadas |
| Critério de escolha | recall das classes de risco no teste | PR-AUC média na validação cruzada do treino |
| Desbalanceamento | SMOTE no pipeline | nenhum (o limiar resolve) |
| Escalas ordinais | one-hot, por lista explícita | como número (árvores) |
| Calibração | — | medida e descartada (Brier igual) |
| Tolerância entre plataformas | probabilidades a 0,03 (ADR 0004) | probabilidades a 0,10 e métricas a 0,01 (ADR 0014); limiares a 0,005 (ADR 0015) |
