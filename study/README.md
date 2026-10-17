# `/study` — o notebook de estudo e o mapa para o backend

Um único notebook: `01_comparacao_de_modelos.ipynb` (35 células), adaptado do notebook legado com o **mínimo** de mudanças fora dos cálculos: textos institucionais, caminhos, imports que faltavam, o A/B explícito de *binning*, a correção de contrato do encoder (`handle_unknown='error'` + `categories=`), a saída da persistência e a prosa sem número literal.

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
