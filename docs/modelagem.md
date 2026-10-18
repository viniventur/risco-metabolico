# Modelagem

Adaptado do `doc/modelos_ml.md` do projeto herdado, com as afirmações que o artefato desmentiu corrigidas e uma seção sobre o que a auditoria encontrou. Nenhuma métrica aparece escrita à mão: tudo que é publicado vem de `artifacts/manifest.json`, servido por `GET /api/v1/model/info`.

## Contexto e dados

- Base pública de triagem metabólica, 2.111 registros × 17 colunas, fictícia/sintética (ver `data/bruto/FONTE.md` e `docs/dicionario-de-dados.md`).
- O treino **não lê o CSV**: lê o **snapshot congelado** — um `SELECT ... ORDER BY linha_origem` sobre `dados.registros_triagem`, gravado em parquet com todos os parâmetros do writer fixos. Os 12 primeiros caracteres do sha256 desse arquivo são o `versao_dados` do manifest e respondem "com quais dados este modelo foi treinado".
- Preparação (célula 5 do notebook, `dominio/features.py::preparar_base`): renomeação das 17 colunas, arredondamento das 5 escalas ordinais para inteiro, tradução dos valores para português.

## Pipeline

Passos nomeados, serializados com `joblib`, sem `dill` e sem função anônima:

| Passo | O que faz | Decisão |
|---|---|---|
| `imc` | `FunctionTransformer(adicionar_imc)`: acrescenta `IMC = Peso / Altura²` | ADR 0003 (ligado) |
| `feature_engineering` | binning das 5 escalas pela célula 14(a) — **só quando ligado** | ADR 0002 (desligado) |
| `columns` | `ColumnTransformer`: `OneHotEncoder(categories=DOMINIOS, handle_unknown='error')` nas 13 categóricas (8 de texto + 5 escalas, por lista explícita) e passthrough nas numéricas | ADR 0002 |
| `sampler` | `SMOTE(sampling_strategy='auto', k_neighbors=5, random_state=42)`, dentro de `imblearn.pipeline.Pipeline` — atua só no `fit` | congelado (§5.3) |
| `model` | o candidato vencedor | critério abaixo |

Largura do modelo na variante servida: 23 one-hot (texto) + 17 one-hot (escalas) + 3 numéricas + IMC = **44**, lida de `get_feature_names_out()` e gravada em `n_features_modelo`. Nenhum teste escreve esse número à mão.

## Candidatos e hiperparâmetros (congelados)

| Candidato | Hiperparâmetros |
|---|---|
| RandomForest | `n_estimators=300, random_state=42, n_jobs=-1, class_weight='balanced_subsample'` |
| LightGBM | `n_estimators=39, learning_rate=0.05, max_depth=-1, subsample=0.8, colsample_bytree=0.8, objective='multiclass', num_class=7, random_state=42, n_jobs=4` |
| XGBoost | `n_estimators=400, learning_rate=0.05, max_depth=5, subsample=0.8, colsample_bytree=0.8, objective='multi:softprob', eval_metric='mlogloss', random_state=42, num_class=7, n_jobs=4` |

Split: `train_test_split(test_size=0.2, random_state=42, stratify=y)` → 1.688 treino / 423 teste.

## Métricas e critério de escolha

- **Acurácia**, **F1-macro** e **recall das classes de risco** (Sobrepeso I/II e Obesidade I/II/III contra Abaixo do Peso e Peso Normal). Deixar de sinalizar alguém que precisa de atenção custa mais caro do que uma conversa a mais; por isso o recall de risco vem primeiro.
- Critério (`treino/avaliacao.py::escolher`): maior recall de risco; empate por acurácia; depois pelo **menor** gap treino/teste de acurácia. `check_overfitting` alerta acima de 10 pontos.
- O vencedor, as métricas de teste, o relatório por classe, a matriz de confusão e a comparação dos candidatos ficam em `artifacts/manifest.json` e `artifacts/metricas/`.

## Reprodutibilidade

```powershell
docker compose up -d --wait banco
$env:BANCO_URL = "postgresql://postgres:postgres@localhost:55432/app_local"
Push-Location backend
uv run --extra treino python -m app.dados.seed            # uma vez
uv run --extra treino python -m app.treino congelar       # snapshot + agregados, mesma transação
uv run --extra treino python -m app.treino treinar --versao 2.0.0
uv run --extra treino python -m app.treino verificar      # retreina e compara: roda no CI
Pop-Location
```

`verificar` não compara o sha256 do `.pkl` (nunca é byte-idêntico): compara as predições sobre `backend/tests/dados_ouro/entradas.json` e as métricas com tolerância `1e-6`. Na mesma plataforma do treino, a comparação das predições é o sha256 exato das probabilidades arredondadas; noutra plataforma (o CI em Linux contra o artefato treinado em Windows), valem classes iguais e probabilidades a `0,03`, tolerância medida em F17 (máximo observado 0,0214, com métricas idênticas; ADR 0004). Se o modelo servido não for o que o pipeline produz sobre os mesmos dados, o CI quebra.

## O que a auditoria do artefato herdado encontrou

Resumo de `docs/auditoria-do-legado.md`: o passo de feature engineering do `.pkl` legado referenciava nomes de coluna em inglês e era um **no-op** no treino; o `handle_unknown='ignore'` fazia **17 de 43** features chegarem permanentemente zeradas em serviço (as 5 escalas enviadas como texto de faixa); duas opções do formulário (`Automóvel`, `Motocicleta`) não existiam no domínio do encoder; e a função serializada por `dill` era intransportável entre versões de Python. A documentação herdada dizia que o pipeline "calcula IMC, aplica binning e preenche valores faltantes" — o binário não fazia nenhuma das três coisas.

## Os dois A/B que fecharam as decisões

- **Binning** (ADR 0002): diferença de um caso de recall em 423, acurácia idêntica — desligado.
- **IMC como feature** (ADR 0003): recall empatado, gap treino/teste e acurácia claramente melhores com IMC — ligado, contra a expectativa inicial do plano.
