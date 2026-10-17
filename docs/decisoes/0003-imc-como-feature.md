# ADR 0003 — IMC como feature: ligado

**Data:** 2026-10-17 · **Estado:** aceita · **Fase:** F5 (A/B medido em F4)

## Contexto

O plano de execução **recomendava deixar o IMC fora do modelo**: IMC = Peso / Altura² é função determinística de duas features que já entram, e "para um modelo de árvores isso não adiciona informação, só colinearidade". A recomendação vinha com a instrução de confirmar por A/B no notebook, com critério fechado: **recall das classes de risco no conjunto de teste; empate resolvido pelo menor gap treino/teste**.

## O A/B, no notebook de estudo (célula "A/B: IMC como feature")

XGBoost com SMOTE, sem *binning* (ADR 0002), com e sem a coluna `IMC`, sobre o **mesmo** split (mesmos índices):

| Variante | Acurácia | F1-macro | Recall de risco | Gap acurácia treino−teste |
|---|---|---|---|---|
| sem IMC | 96,45 | 96,36 | 99,36 | 3,55 pp |
| com IMC | 98,82 | 98,76 | 99,36 | 1,18 pp |

## Decisão

**O IMC entra como feature** (`imc_como_feature: true`). O critério do próprio plano decide: o recall empata e o desempate pelo gap é **a favor** do IMC — com, de quebra, +2,4 pontos de acurácia e de F1-macro.

A expectativa do plano estava errada, e vale registrar por quê: uma razão entre duas variáveis **não é separável por cortes alinhados aos eixos**. Árvores de profundidade 5 aproximam `Peso / Altura²` por escadas em `Peso` e em `Altura`, gastando profundidade para reconstruir o que uma coluna entrega pronta. A "colinearidade" que preocupava é irrelevante para árvores; o que importa é que a fronteira de decisão real do problema é quase literalmente uma faixa de IMC.

## Como entra

- `dominio/features.py::adicionar_imc` — transformador **nomeado e importável**, sem arredondar (o arredondamento a 2 casas é de tela, `regras.calcular_imc`).
- `treino/pipeline.py::montar_pipeline(..., imc=True)` acrescenta o passo `imc` **antes** de `columns`, e `IMC` entra no ramo numérico do `ColumnTransformer`: 43 + 1 = **44** colunas de modelo (lido de `get_feature_names_out()`, gravado em `n_features_modelo`).
- O **contrato de entrada não muda**: continuam 16 campos (`EntradaTriagem`), `feature_names_in_` tem 16 nomes, e o log de predição grava só as 16 features. O IMC é derivado dentro do pipeline.
- A referência de deriva (`distribuicao_treino.json`) continua sobre as 16 entradas: o IMC é consequência delas.

## Consequências para os testes

- A paridade treino/serviço (§10.2 do plano) e a largura (§10.3) usam `ArtefatoModelo.transformar(df)` / `treino.pipeline.transformar_ate_colunas`, que aplicam **todos** os passos antes do `sampler` (imc, columns) — nunca `named_steps['columns'].transform(df)` direto, que falharia por coluna `IMC` ausente, e nunca `pipeline[:-1]`, que incluiria o SMOTE.
- A tela do simulador continua calculando o IMC no cliente para o cartão de faixa; a API devolve `imc` e `faixa_imc` arredondados, e o modelo usa o valor cheio. São dois usos do mesmo número, não duas fórmulas.

## Reversibilidade

`python -m app.treino treinar --versao X --sem-imc` treina a variante sem o passo; o manifest registra `imc_como_feature: false` e a largura volta a 43. Nenhum outro arquivo muda.
