# ADR 0002 — Binning desligado; as 5 escalas ordinais no ramo categórico

**Data:** 2026-10-17 · **Estado:** aceita · **Fase:** F5 (A/B medido em F2/F4)

## Contexto

O legado tinha **três** versões incompatíveis da função de *binning* (ver `docs/auditoria-do-legado.md`), e nenhuma delas treinou o modelo publicado: o passo serializado era um no-op, e o artefato aprendeu sobre as 5 escalas ordinais como **inteiros crus**, uma coluna one-hot por valor (3 + 4 + 3 + 4 + 3 = 17). Em serviço, o app enviava strings de faixa e o encoder devolvia zero em silêncio.

O plano exigia decidir **uma vez**, aplicar nos dois lados (treino e serviço) e provar com o teste de paridade — e tomar a decisão com número na mão, não por argumento.

## O A/B, no notebook de estudo (`study/01_comparacao_de_modelos.ipynb`, tabela de avaliação)

Cada candidato treinado nas duas variantes, sobre o mesmo split congelado (1.688 / 423), com SMOTE:

| Modelo | Binning | Acurácia | F1-macro | Recall de risco |
|---|---|---|---|---|
| XGBoost | desligado | 96,45 | 96,36 | 99,36 |
| XGBoost | ligado | 96,45 | 96,34 | 99,68 |
| LightGBM | desligado | 95,51 | 95,41 | 99,04 |
| LightGBM | ligado | 95,04 | 94,88 | 98,71 |
| RandomForest | desligado | 92,43 | 92,28 | 95,18 |
| RandomForest | ligado | 92,43 | 92,29 | 95,82 |

Valores em pontos percentuais, do conjunto de teste; são os números daquela execução do notebook, registrados aqui como evidência da decisão — as métricas **publicadas** vêm do `artifacts/manifest.json`.

## Decisão

**Binning desligado** (`binning_ativo: false` no manifest). Quatro razões, nesta ordem de peso:

1. **O A/B não separa as variantes.** No XGBoost a diferença de recall é **um caso** em 423 (0,32 pp), com acurácia idêntica e F1 marginalmente menor; no LightGBM o binning piora as três métricas. Está dentro do ruído de um split só.
2. **O one-hot sobre os inteiros já é uma partição igual ou mais fina que as faixas.** Das 5 escalas, o binning da célula 14(a) só agrega informação em uma: `Numero_Refeicoes_Principais` funde 1 e 2 em "1-2". Nas outras quatro, faixa e valor coincidem um a um. O modelo "com binning" é o mesmo modelo com uma coluna a menos.
3. **Honra o que foi efetivamente medido.** O modelo publicado nunca teve binning de fato; desligar é descrever o que existia, não inventar um pipeline novo.
4. **Cada transformação a menos é uma superfície a menos de divergência treino/serviço** — a classe de defeito que este projeto existe para não repetir.

### Decisão irmã: as 5 escalas entram no ramo **categórico**, por lista explícita

`treino/pipeline.py::COLUNAS_CATEGORICAS` lista as 13 colunas (8 de texto + 5 escalas) **à mão**, e `COLUNAS_NUMERICAS` as 3 contínuas. Nunca `select_dtypes`: sobre uma amostra com o binning desligado, as cinco cairiam no ramo numérico e o modelo teria 23 + 8 = **31** features em vez de 40 one-hot + 3 numéricas = **43**. Os 43 do artefato legado existiam por acidente de `dtype`; aqui existem por decisão.

### Verificação registrada

`Consumo_Alcool = 'Sempre'` tem 1 ocorrência em 2.111 linhas. Com o split congelado (`random_state=42`, estratificado) ela cai no **treino** — conferido no notebook (`assert`) e gravado pelo CLI no manifest (`categoria_rara_no_treino: true`). Mesmo assim o `OneHotEncoder` recebe `categories=` explícito vindo de `dominio/regras.py::DOMINIOS`: a largura do modelo não depende do split, e a opção "Sempre" continua válida na interface. O split congelado **não** é tocado.

## Consequências

- `engineer_features(df, binning=False)` devolve o DataFrame intacto; `binning=True` aplica exatamente os bins da célula 14(a). A variante de `app.py` (IMC + `fillna` + bin diferente em vegetais) foi descartada.
- `handle_unknown='error'`: categoria desconhecida vira exceção no treino e `422` na API, nomeando campo e valor.
- A largura do modelo é lida de `preprocess.get_feature_names_out()` e gravada em `n_features_modelo`; com o IMC como feature (ADR 0003) ela é **44**. Nenhum teste escreve `43` ou `44` à mão.
- O notebook continua treinando as duas variantes como A/B explícito; só a escolhida é persistida pelo CLI.
