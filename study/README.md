# `/study` — os notebooks de estudo e o mapa para o backend

Dois notebooks, um por vertente: `01_comparacao_de_modelos.ipynb` (obesidade, 40 células) e `02_triagem_de_diabetes.ipynb` (diabetes, descrito [no fim deste arquivo](#o-notebook-02--vertente-diabetes)). O 01 foi adaptado do notebook legado com o **mínimo** de mudanças fora dos cálculos: textos institucionais, caminhos, imports que faltavam, o A/B explícito de *binning*, a correção de contrato do encoder (`handle_unknown='error'` + `categories=`), a saída da persistência e a prosa sem número literal.

> Os dados exibidos são fictícios e servem apenas para demonstração. Nenhum registro corresponde a uma pessoa real. Esta ferramenta é de triagem e não substitui avaliação clínica.

## Como rodar

```powershell
# da raiz do repositório; o venv do backend já traz jupyter, nbconvert e os modelos (extra `estudo`)
uv run --project backend jupyter nbconvert --to notebook --execute --inplace study\01_comparacao_de_modelos.ipynb
python scripts\higiene-notebook.py study\01_comparacao_de_modelos.ipynb
```

O notebook lê `../data/bruto/obesity.csv` **diretamente**, de propósito: é um documento de estudo e precisa rodar numa máquina limpa, sem banco. Ele não escreve nenhum `.pkl` (a serialização do artefato é exclusiva de `python -m app.treino`) e grava só `data/processado/_estudo_base_painel.parquet`, com nome diferente do parquet servido para que o *Run All* nunca sobrescreva `base_painel.parquet`.

## Saídas ficam no git — de propósito

O padrão de mercado (`nbstripout`) **está errado para este projeto**: o módulo Estudos do front renderiza o notebook a partir das saídas salvas (a figura Plotly viva, os PNG do matplotlib, os DataFrames). Limpar as saídas apagaria exatamente o que a tela mostra. `scripts/higiene-notebook.py` remove só o lixo (mimes do editor, saídas de erro, caminhos absolutos) e normaliza a numeração; teto de 1,5 MB. Ninguém "conserta" isso com `nbstripout` depois.

## Mapa célula → função do backend

Cada fórmula existe **uma única vez** no backend, com uma cópia visível no notebook provada idêntica por `assert_frame_equal` (célula de paridade logo abaixo da 14, acrescentada em F4).

| Célula | Conteúdo | Onde vive agora |
|---|---|---|
| 2 | imports e leitura do CSV | — (o backend lê o snapshot congelado, nunca o CSV, §4.3.6) |
| 5 | `colunas_map`, arredondamento, `traducoes_valores` | `dominio/features.py::preparar_base` |
| 14 (a) | `engineer_features` (binning) | `dominio/features.py::engineer_features` |
| 14 (c) | `COLUNAS_CATEGORICAS` / `COLUNAS_NUMERICAS` | `treino/pipeline.py::separar_colunas` — **listas explícitas, não `select_dtypes`** |
| 14 (d) | `ColumnTransformer` com `categories=` explícito | `treino/pipeline.py::montar_preprocessamento` (categorias de `dominio/regras.py::DOMINIOS`) |
| 14 (e) | `LabelEncoder`, `RISK_CLASSES`, `to_risk_flag` | `dominio/regras.py` (`ORDEM_ALFABETICA`, `CLASSES_RISCO`, `to_risk_flag`) |
| 16 | funções de treino/avaliação | `treino/pipeline.py` + `treino/avaliacao.py` |
| 18, 21, 23 | hiperparâmetros dos 3 candidatos | `treino/pipeline.py::CANDIDATOS` |
| 25-28 | `summary`, `check_overfitting` | `treino/avaliacao.py` |
| 30-31 | persistência | `treino/__main__.py` (joblib, sem `dill`); a célula 31 foi **removida** |
| 33-34 | base de estudo do painel | `sql/agregados/*.sql` (definição) + `dominio/agregados.py` (runtime); a célula seguinte prova a paridade do IMC médio por atividade × gênero contra o backend |

## O que está congelado (contrato dos números)

- `colunas_map` (17 pares) e `traducoes_valores` (9 dicionários, com `Carro`/`Moto`).
- O arredondamento `round().astype(int)` nas 5 escalas ordinais.
- `TARGET = 'Nivel_Obesidade'`, 16 colunas de entrada.
- `train_test_split(test_size=0.2, random_state=42, stratify=y_encoded)` → 1.688 / 423.
- `SMOTE(sampling_strategy='auto', k_neighbors=5, random_state=42)` dentro de `imblearn.pipeline.Pipeline`.
- Os hiperparâmetros dos 3 candidatos, literalmente (células 18, 21 e 23).
- As três métricas e a definição de risco; `check_overfitting` e o limiar de 10 pontos.

Três exceções deliberadas: o passo `feature_engineering` é parametrizado pela variante do A/B; `cat_cols`/`num_cols` viraram listas explícitas; a célula 31 não está protegida — foi removida.

## Por que listas explícitas

As 5 escalas ordinais têm 3, 4, 3, 4 e 3 valores inteiros. `select_dtypes` sobre a amostra, com o binning desligado, jogaria as cinco em `num_cols` e o modelo teria 23 one-hot + 8 numéricas = **31** features. Os 43 do artefato legado só existem porque as cinco caíram no ramo categórico por acidente; aqui isso é **decisão** (ADR 0002), e a largura real do modelo vem sempre do manifest (`n_features_modelo`), nunca de um literal.

## Métricas do legado

Acurácia 0,9622, F1-macro 0,9610 e recall de risco 0,9936 pertencem ao artefato antigo (pipeline sem binning efetivo e sem IMC) e ficam documentadas em `docs/auditoria-do-legado.md`. Depois do retreino elas mudam; nenhuma métrica é escrita à mão em lugar nenhum do repositório.

## O notebook 02 — vertente diabetes

`02_triagem_de_diabetes.ipynb` (51 células) estuda a segunda vertente: a probabilidade de uma pessoa já ter ouvido de um profissional de saúde que tem diabetes, a partir de dez respostas que ela sabe **antes** de qualquer diagnóstico. Escrito do zero para esta base, com as mesmas regras do 01: lê o CSV diretamente (`../data/bruto/diabetes/cdc_diabetes_health_indicators.csv`), não grava artefato nenhum e a prosa não carrega número medido — todo número sai das saídas, que o *Run All* regenera.

> Os dados exibidos são respostas reais e anonimizadas de uma pesquisa pública de saúde dos Estados Unidos (BRFSS 2015, CDC) e servem apenas para demonstração. Nenhum registro identifica uma pessoa. Esta ferramenta é de triagem e não substitui avaliação clínica.

```powershell
# da raiz do repositório; os extras `estudo` (jupyter, nbconvert, gráficos) e `treino` (LightGBM)
uv run --project backend --extra estudo --extra treino jupyter nbconvert --to notebook --execute --inplace study\02_triagem_de_diabetes.ipynb
python scripts\higiene-notebook.py study\02_triagem_de_diabetes.ipynb
uv run --project backend python tools\nb2json.py --root . --out frontend\public\study
```

O que ele decide, nesta ordem e com o critério escrito **antes** de cada medição: as entradas (o custo de cada grupo excluído), o modelo (três baselines contra XGBoost e LightGBM, pela PR-AUC da validação cruzada do treino), o tratamento do desbalanceamento (nada, peso de classe ou SMOTE), a calibração e o limiar de triagem (o maior com recall ≥ 0,80 fora da dobra). O teste é tocado **uma vez**, na avaliação final, já com tudo decidido.

Depois do que fica congelado, a seção **Limiar por faixa etária** aplica o critério do limiar dentro de cada um dos três grupos de idade (18 a 44, 45 a 64, 65 ou mais). Nas predições fora da dobra, ela compara outras divisões das 13 faixas, o preço de cada alvo de recall e outros critérios (um piso e o mesmo orçamento do limiar único), com a estabilidade de cada limiar entre as dobras. A regra escolhida é medida uma vez no teste, ao lado do limiar único.

### Mapa célula → função do backend

| Célula | Conteúdo | Onde vive agora |
|---|---|---|
| 2 | leitura do CSV, `colunas_map` e `traducoes` | `backend/app/diabetes/dominio/features.py::preparar_base` — o backend lê o snapshot congelado, nunca o CSV |
| 3 | `arredondar_imc` e a célula de paridade | `backend/app/diabetes/dominio/features.py::arredondar_imc`; a célula prova por `assert_frame_equal` que as duas preparações e os dois arredondamentos são idênticos |
| 14 | `ENTRADAS`, o split e as dobras | `backend/app/diabetes/dominio/features.py::ENTRADAS`; `backend/app/diabetes/treino/pipeline.py::separar`, `dividir` e `dobras` |
| 15 | `preprocessador` e `montar` (ramo das árvores, sem SMOTE) | `treino/pipeline.py::montar_preprocessamento` e `montar_pipeline`, com os passos nomeados `imc`, `colunas` e `modelo` |
| 15 | `xgb`, com os ajustes do escolhido (célula 20) | `treino/pipeline.py::HIPERPARAMETROS`, literalmente |
| 15 | `validar` | `treino/avaliacao.py::validar`: as mesmas 5 dobras, as predições fora da dobra e as métricas por dobra |
| 29 | `limiar_para_recall` e `ponto_de_operacao` | `treino/avaliacao.py`, com os mesmos nomes; o critério escrito é `CRITERIO_LIMIAR`, e a tabela de alvos de recall vira `artifacts/diabetes/metricas/pontos-de-operacao.json` |
| 32 | a avaliação final, uma vez, no teste | `treino/avaliacao.py::avaliar_teste` e `matriz_confusao` → `metricas_teste` do manifest e `metricas/matriz-confusao.json` |
| 34 | o desempenho por sexo e por idade | `treino/avaliacao.py::por_grupo` → `metricas/por-grupo.json` |
| 38 | `CONGELADO` | o contrato dos números do CLI (`python -m app.diabetes.treino`): as constantes de `treino/pipeline.py` e `treino/avaliacao.py` |
| 40 | `GRUPOS_IDADE`, `limiares_por_grupo`, `limiar_por_linha` e `recall_cruzado`; as divisões das 13 faixas | `treino/avaliacao.py::FAIXAS_POR_GRUPO`, que sai dos cortes da célula 34, e `limiares_por_grupo` e `limiar_por_linha`, com os mesmos nomes; o recall cruzado vira `estabilidade_por_idade`. As outras divisões ficam no notebook |
| 42 | os três grupos no alvo: o limiar, o ponto fora da dobra e a estabilidade entre as dobras | `treino/avaliacao.py::tabela_por_idade` → `limiares_por_idade` do manifest; `estabilidade_por_idade` e `treino/__main__.py::registro_por_idade` → `artifacts/diabetes/metricas/limiares-por-idade.json` |
| 43 | o preço de cada alvo de recall, com o limiar único e com o limiar por grupo | `treino/avaliacao.py::pontos_por_idade` → `pontos` de `metricas/limiares-por-idade.json`; o do limiar único continua em `metricas/pontos-de-operacao.json` (célula 29) |
| 44 | o piso e o mesmo orçamento | só no notebook: o CLI não os refaz |
| 46 | a regra escolhida, uma vez, no teste, ao lado do limiar único | `treino/avaliacao.py::avaliar_teste`, `matriz_confusao` e `por_grupo`, com um limiar por linha → `metricas_teste`, `metricas/matriz-confusao.json` e `metricas/por-grupo.json`; `teste` e `teste_limiar_unico` de `metricas/limiares-por-idade.json`. Quem muda de classificação fica no notebook |
| 49 | `CONGELADO_POR_IDADE` | `treino/avaliacao.py::CRITERIO_LIMIAR_POR_IDADE` e `FAIXAS_POR_GRUPO`; os valores servidos são os do manifest (`limiares_por_idade`) |

As métricas publicadas da vertente não são as deste notebook: são as do manifest (`artifacts/diabetes/manifest.json`), que o CLI escreve ao treinar sobre o snapshot congelado do banco. Os critérios e as tabelas de cada escolha estão em `docs/modelagem-diabetes.md`; o limiar, a deriva e a reprodutibilidade entre plataformas, na ADR 0014; o limiar por grupo de idade, na ADR 0015.

### O que está congelado (contrato dos números)

As células 38 e 49 imprimem o que o CLI reproduz. O `verificar` compara com o manifest as entradas, o algoritmo, os hiperparâmetros, o desbalanceamento, a calibração e o critério de cada limiar, o único e o por grupo, com os grupos.

- As 10 entradas, na ordem de `ENTRADAS`, que é a ordem das colunas que o XGBoost vê.
- `train_test_split(test_size=0.2, random_state=42, stratify=y)` e `StratifiedKFold(n_splits=5, shuffle=True, random_state=42)` no treino.
- `XGBClassifier` com os hiperparâmetros da célula 38, literalmente.
- O desbalanceamento: `nenhum`. A calibração: `nenhuma`.
- O critério do limiar: o maior com recall ≥ 0,80 nas predições fora da dobra do treino. O teste dá um segundo ponto de leitura com a precisão fixa em 0,30.
- Os três grupos de idade da célula 34: 18 a 44, 45 a 64, 65 ou mais.
- O limiar por grupo de idade (célula 49, `CONGELADO_POR_IDADE`): o mesmo critério do limiar, dentro de cada grupo. Os grupos levam as faixas do BRFSS: 1 a 5, 6 a 9 e 10 a 13. Os valores que a célula imprime são só a referência daquela execução; os servidos são os do manifest.

### Paridade com o backend

- **A preparação.** A célula 3 prova por `assert_frame_equal` que a preparação do notebook e a de `preparar_base` produzem o mesmo DataFrame, e que o arredondamento do IMC dos dois lados é o mesmo. Fora do venv do backend, ela avisa que a paridade não foi conferida naquela execução.
- **O modelo.** O `python -m app.diabetes.treino verificar` roda no CI e retreina a configuração congelada sobre o snapshot do banco. Ele exige os mesmos limiares (o único e o de cada grupo de idade), as mesmas métricas e as mesmas predições de ouro do manifest. Na plataforma do treino, o critério é o sha256 exato; noutra, as tolerâncias medidas das ADRs 0014 e 0015.
- **O que fica no notebook.** As baselines, o A/B das entradas, os tratamentos do desbalanceamento, a calibração isotônica e, no limiar por idade, as outras divisões das 13 faixas e os critérios do piso e do mesmo orçamento são estudo: o CLI não os refaz.
