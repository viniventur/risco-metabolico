# Auditoria do artefato legado

**Data:** 2026-10-17 (F1; números finais confirmados em F5) · **Autor:** Vinícius Ventura

Este documento é a evidência por trás da frase de portfólio do README: as divergências entre o que a documentação do projeto herdado dizia e o que o binário realmente fazia. Nenhum artefato do legado foi reaproveitado; o `.pkl` ficou na pasta de referência, fora deste repositório, e foi carregado **uma vez**, por variável de ambiente (`ARTEFATO_LEGADO`), para produzir o que está abaixo. Nenhum caminho absoluto foi impresso.

## Como a auditoria foi feita

| Item | Valor |
|---|---|
| Artefato auditado | `xgboost.pkl`, 3.561.025 bytes, serializado com `dill` |
| Ambiente de leitura | Python 3.12, scikit-learn 1.9.1, xgboost 3.4.1, imbalanced-learn 0.14.2, dill |
| Versão que gravou o pickle | scikit-learn **1.8.0** (aviso `InconsistentVersionWarning` em cada estimador) |
| Base usada nas medições | o CSV público, preparado exatamente como a célula 5 do notebook (renomeação, arredondamento das 5 escalas, tradução dos valores) |
| Split usado nas métricas | `train_test_split(test_size=0.2, random_state=42, stratify=y)` → 1.688 treino / 423 teste, o mesmo do notebook |

## O que há dentro do binário

- Objeto de topo: `dict` com `pipeline` e `label_encoder`.
- `label_encoder.classes_` (ordem alfabética): `Abaixo do Peso`, `Obesidade I`, `Obesidade II`, `Obesidade III`, `Peso Normal`, `Sobrepeso I`, `Sobrepeso II`.
- Passos do pipeline: `['feature_engineering', 'columns', 'sampler', 'model']` — `FunctionTransformer`, `ColumnTransformer`, `SMOTE(k_neighbors=5)`, `XGBClassifier(n_estimators=400, max_depth=5, learning_rate=0.05)`.
- Booster: 43 features de entrada, 400 rodadas.
- `ColumnTransformer`: `categorical` = `OneHotEncoder(handle_unknown='ignore')` sobre **13 colunas** (as 8 categóricas **e as 5 escalas ordinais**); `numeric` = passthrough sobre `Idade`, `Altura`, `Peso`.
- `feature_names_in_` (16): `Genero, Idade, Altura, Peso, Historico_Familiar_Sobrepeso, Consumo_Calorico_Frequente, Consumo_Vegetais, Numero_Refeicoes_Principais, Consumo_Alimentos_Entre_Refeicoes, Fumante, Consumo_Agua_Diario, Monitoramento_Calorias, Atividade_Fisica_Frequencia, Tempo_Dispositivos_Tecnologicos, Consumo_Alcool, Meio_Transporte`.

### As `categories_` reais do encoder

| Coluna | Categorias | n |
|---|---|---|
| `Genero` | Feminino, Masculino | 2 |
| `Historico_Familiar_Sobrepeso` | Não, Sim | 2 |
| `Consumo_Calorico_Frequente` | Não, Sim | 2 |
| `Consumo_Vegetais` | **1, 2, 3** (`int64`) | 3 |
| `Numero_Refeicoes_Principais` | **1, 2, 3, 4** (`int64`) | 4 |
| `Consumo_Alimentos_Entre_Refeicoes` | Frequentemente, Não, Sempre, Às vezes | 4 |
| `Fumante` | Não, Sim | 2 |
| `Consumo_Agua_Diario` | **1, 2, 3** (`int64`) | 3 |
| `Monitoramento_Calorias` | Não, Sim | 2 |
| `Atividade_Fisica_Frequencia` | **0, 1, 2, 3** (`int64`) | 4 |
| `Tempo_Dispositivos_Tecnologicos` | **0, 1, 2** (`int64`) | 3 |
| `Consumo_Alcool` | Frequentemente, Não, Sempre, Às vezes | 4 |
| `Meio_Transporte` | Bicicleta, Caminhada, Carro, Moto, Transporte Público | 5 |

Total: **40 colunas one-hot** (23 das categóricas + **17 das 5 escalas**) + 3 numéricas = **43**. A primeira leitura do artefato, feita de memória, dizia 14 para as escalas; o número real é 17 (3 + 4 + 3 + 4 + 3), e é por isso que o plano exigia apurar antes de publicar.

## As quatro divergências

### 1. O passo de feature engineering é uma função anônima serializada por valor — e intransportável

`feature_engineering` é um `FunctionTransformer` cuja função foi serializada **por valor** pelo `dill`, a partir de uma célula de kernel que **não está no notebook salvo** (`co_filename` aponta para o arquivo temporário de uma célula do ipykernel; a célula 14 do `.ipynb` define outra versão da função). O pickle só carrega com `sys.modules["__main__"].engineer_features` definido antes do `load` — o truque que o `app.py` legado fazia na linha 52 — e **executar** a função serializada noutra build de Python termina em *access violation* (bytecode de outra versão). O próprio `app.py` reconhecia o problema: reapontava o passo para a sua cópia local "evitando bytecode incompatível entre ambientes", reescrevendo `pipeline.steps` num `except Exception` silencioso.

Consequência para o projeto novo: nenhum `dill`, nenhuma função anônima no pipeline. O binning, se existir, é um transformador nomeado e importável (`dominio/features.py`), e o artefato é gravado com `joblib`.

### 2. A função serializada referencia nomes em inglês: o passo era um no-op no treino

As constantes do código serializado (lidas sem executá-lo) são `FCVC, NCP, CH2O, FAF, TUE` e bins `(0, 1.5, 2.5, 10)`, `(0, 2, 3, 4, 10)`, `(0, 1, 3, 10)`, `(0, 1, 2, 10)` com rótulos `1-2/3/4/5+`, `1-2L/2-3L/3L+`, `0-1h/1-3h/3h+`, `0-1h/1-2h/2h+`. O DataFrame de treino já tinha sido renomeado para português na célula 5; a guarda `if col in df.columns` nunca casou, e o passo devolveu o DataFrame intacto. **Prova:** as `categories_` das 5 escalas são inteiros, não rótulos de faixa.

Existem, portanto, **três versões** incompatíveis da mesma função, e nenhuma delas é a que efetivamente treinou o modelo (que foi "nenhuma"):

| Origem | Nomes de coluna | `Consumo_Vegetais` | `Numero_Refeicoes_Principais` | `Consumo_Agua_Diario` | `Atividade_Fisica_Frequencia` | `Tempo_Dispositivos_Tecnologicos` | IMC | `fillna` |
|---|---|---|---|---|---|---|---|---|
| função dentro do `.pkl` | inglês | `[0,1.5,2.5,10]` | `[0,2,3,4,10]` (4 faixas) | `[0,1.5,2.5,10]` → `1-2L/2-3L/3L+` | `[0,1,3,10]` (3 faixas) | `[0,1,2,10]` → `0-1h/1-2h/2h+` | não | não |
| notebook, célula 14(a) | português | `[0,1.5,2.5,4]` | `[0,2.5,3.5,10]` | `[0,1.5,2.5,10]` → `<1L/1-2L/>2L` | `[0,0.5,1.5,2.5,10]` (4 faixas) | `[0,0.5,1.5,10]` → `0-2h/3-5h/>5h` | não | não |
| `app.py`, linhas 24-49 | português | `[0,1.5,2.5,10]` | `[0,2.5,3.5,10]` | idem notebook | idem notebook | idem notebook | **sim** | **sim** (`'missing'`) |

A variante de `app.py` é **descartada**: calcula IMC, faz `fillna` e usa um bin diferente em `Consumo_Vegetais`. A referência canônica do binning, quando ligado, é a célula 14(a) do notebook (ADR 0002 decide se ele fica ligado; a recomendação é desligado).

### 3. `handle_unknown='ignore'` escondeu 17 de 43 features zeradas em serviço

O `app.py` convertia as 5 escalas em **strings de faixa** (`"moderada"`, `"3"`, `"1-2L"`, …) e acrescentava a coluna `IMC` antes de chamar `predict_proba`. O encoder, treinado sobre inteiros, não reconhecia nenhuma dessas strings e — por causa do `handle_unknown='ignore'` — devolvia zero em silêncio. O `ColumnTransformer` também aceitou a coluna `IMC` extra sem reclamar (`remainder='drop'`).

Medido sobre a base inteira (2.111 linhas), comparando o caminho de treino (inteiros crus) com o caminho de serviço (`app.py`):

- **N = 17 de 43** colunas vivas no treino e **permanentemente zeradas** em serviço: `Consumo_Vegetais_{1,2,3}`, `Numero_Refeicoes_Principais_{1,2,3,4}`, `Consumo_Agua_Diario_{1,2,3}`, `Atividade_Fisica_Frequencia_{0,1,2,3}`, `Tempo_Dispositivos_Tecnologicos_{0,1,2}` — independentemente do que o usuário preenchesse.
- Efeito sobre o conjunto de teste congelado: o **mesmo** artefato servido como o `app.py` servia cai de acurácia 0,9622 para **0,9527** e F1-macro 0,9610 para **0,9515**, com **7 de 423** predições trocadas. O recall de risco **não muda** (0,9936): as colunas mortas são de hábito, e peso/altura/idade continuam vivas — e é por isso que ninguém notou.

### 4. Duas opções do formulário não existiam no domínio do encoder

O `app.py` oferecia `"Automóvel"` e `"Motocicleta"` em `Meio_Transporte`; o encoder conhece `Carro` e `Moto` (a tradução da célula 5 do notebook). Para quem escolhia uma dessas opções, as **5** colunas de transporte iam a zero — somadas às 17 acima, **22 de 43** features zeradas, sem um único aviso.

## Outras observações, menores

- `models/randomforest_n_smote_sem_smote.pkl`: o nome vem de `f"{name}_sem_smote"` aplicado a um `name` que já continha `_n_smote`. Vira teste de nomenclatura no CLI novo.
- **O mesmo objeto estimador era reutilizado nos dois pipelines do RandomForest** (com e sem SMOTE): `Pipeline.fit` ajusta o estimador no lugar, então o segundo `fit` sobrescrevia o modelo do primeiro — e as duas linhas de RandomForest saíam com números idênticos no teste de overfitting (1,000 / 0,922 nos dois). O notebook migrado usa `sklearn.base.clone` em cada pipeline.
- `label_encoder.pkl` solto, em formato diferente dos outros quatro artefatos; a ordem de classes passa a ser constante explícita em `dominio/regras.py`.
- `requirements.txt` sem versão fixada e com `shap`, que nenhum arquivo importa.
- `warnings.filterwarnings('ignore')` global no `app.py` — esconde exatamente o `InconsistentVersionWarning` que revela a divergência 1.
- O notebook salvo não roda do zero: faltam os imports de `SMOTE`, `accuracy_score`, `f1_score`, `recall_score`, `classification_report`, `LGBMClassifier`, `XGBClassifier` e o objeto `feature_engineering`.
- `Consumo_Alcool = 'Sempre'` tem 1 ocorrência na base; com `random_state=42` ela cai no **treino** (verificado). Mesmo assim o encoder novo recebe `categories=` explícito (ADR 0002), para a largura não depender do split.

## Métricas históricas do legado

Valem para o pipeline **sem binning efetivo e sem IMC** (as divergências 1 e 2 fazem o modelo ser, na prática, um XGBoost sobre one-hot de inteiros + 3 numéricas), no split congelado do notebook:

| Métrica | Valor |
|---|---|
| Acurácia | 0,9622 |
| F1-macro | 0,9610 |
| Recall das classes de risco | 0,9936 |

São números **históricos**, reproduzidos aqui pela auditoria e coincidentes com os impressos no notebook. **Não** são as métricas do modelo deste repositório: estas vêm de `artifacts/manifest.json`, via `GET /api/v1/model/info`, e nunca são escritas à mão.

## Por que o artefato não é reaproveitado

1. Função serializada por valor, dependente de `__main__` e de uma versão de Python (divergência 1).
2. Passo de feature engineering que nunca fez nada (divergência 2) — a documentação descrevia um pipeline que não existia.
3. `handle_unknown='ignore'` (divergências 3 e 4): o projeto novo usa `'error'` com `categories=` explícito, e a exceção vira 422 nomeando campo e valor.
4. Serialização com `dill`; o novo usa `joblib`.
5. O artefato não sabe com quais dados foi treinado; o novo carrega `versao_dados` (sha256 do snapshot congelado) no manifest.

O que atravessa é **conhecimento**: `colunas_map`, `traducoes_valores`, o arredondamento das escalas, os hiperparâmetros dos três candidatos, o split e as definições de métrica — reimplementados em código testado.
