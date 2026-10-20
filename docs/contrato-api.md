# Contrato da API — resumo humano do OpenAPI

Prefixo `/api/v1`. Documentação interativa em `/docs`; `/openapi.json` alimenta o `openapi-typescript` do front, e um snapshot dele vive em `backend/tests/contrato/openapi.json` — o CI quebra quando o contrato muda sem intenção (`ATUALIZAR_CONTRATO=1` para regenerar de propósito).

Nomenclatura híbrida, deliberada (`docs/estilo-de-codigo.md`): rotas de domínio em português (`/predicoes`, `/registros`, `/painel`, `/monitoramento`), de infraestrutura em inglês (`/health`, `/ready`, `/model/*`, `/metadata`).

## Endpoints

| Método | Caminho | Entrada | Resposta 200 | Cache | Banco |
|---|---|---|---|---|---|
| GET | `/health` | — | `{status, versao_api, artefato_carregado, uptime_s, banco, log_predicao, logs_gravados, logs_descartados}` — **sempre 200** | não | não |
| GET | `/ready` | — | `{pronto, artefato_carregado, agregados_carregados, motivo}`; 503 enquanto artefato ou agregados não carregaram. **O banco não entra** | não | não |
| GET | `/model/info` | `?versao=` | manifest normalizado: versão, algoritmo, `treinado_em`, `versao_dados`, hiperparâmetros, métricas de teste, ambiente | `max-age=300`, ETag | não |
| GET | `/model/feature-importance` | `?top=10` | `{modelo, versao, itens:[{feature, rotulo, importancia, importancia_pct}]}` (one-hot somado por feature; o IMC derivado entra como uma) | `max-age=300`, ETag | não |
| GET | `/metadata` | — | `{grupos:[{id, titulo, campos:[{nome, rotulo, tipo, minimo, maximo, passo, opcoes, padrao, ajuda}]}], versao_modelo, aviso}` | `max-age=3600`, ETag | não |
| POST | `/predicoes` | `EntradaTriagem` (16 campos, `extra=forbid`) | `RespostaTriagem` | não | escrita assíncrona (log) |
| POST | `/predicoes/lote` | `{itens:[dict]}` (teto `LIMITE_LOTE`, 413 acima) | `{total, sucesso, resultados[], falhas[{indice, campo, mensagem}], versao_modelo}` | não | escrita assíncrona |
| POST | `/predicoes/relatorio` | `{entrada: EntradaTriagem, nome?}` | `text/html` autocontido | não | escrita assíncrona (sem o `nome`) |
| GET | `/dimensoes`, `/painel/*`, `/registros*` | filtros | ver F8 | ETag | não |
| GET | `/monitoramento/deriva` | `janela_dias`, `feature` | ver F8b; `200` com `disponivel: false` com o banco fora | `max-age=300` | **sim** (única leitura) |

## `RespostaTriagem`

```jsonc
{
  "classe_prevista": "Peso Normal",
  "risco_acumulado": 0.0019,            // soma das 5 classes de risco
  "probabilidades": [                   // SEMPRE as 7, em ORDEM CLÍNICA crescente (não alfabética)
    {"classe": "Abaixo do Peso", "probabilidade": 0.0001, "de_risco": false},
    {"classe": "Peso Normal",    "probabilidade": 0.9980, "de_risco": false},
    {"classe": "Sobrepeso I",    "probabilidade": 0.0012, "de_risco": true},
    {"classe": "Sobrepeso II",   "probabilidade": 0.0003, "de_risco": true},
    {"classe": "Obesidade I",    "probabilidade": 0.0001, "de_risco": true},
    {"classe": "Obesidade II",   "probabilidade": 0.0001, "de_risco": true},
    {"classe": "Obesidade III",  "probabilidade": 0.0001, "de_risco": true}
  ],
  "imc": 24.22,                         // métrica de tela, 2 casas
  "faixa_imc": "Peso Ideal",            // vocabulário de IMC (6 faixas), distinto do das classes
  "fora_do_dominio_treino": [],         // ex.: ["Altura"] quando 1,40 m (o treino viu 1,45–1,98)
  "versao_modelo": "2.0.0",
  "latencia_ms": 6.1
}
```

Duas ordens, dois vocabulários: o `LabelEncoder` indexa em ordem alfabética (é a ordem de `predict_proba` e do campo `classes` de `/model/info`); a API devolve em ordem clínica (`ordem_clinica` em `/model/info`). `faixa_imc` usa as 6 faixas de IMC (`Peso Ideal`, `Obesidade Grau I`…), que não são as 7 classes do modelo (`Peso Normal`, `Obesidade I`…).

## Erros: um envelope só

```json
{"erro": "entrada_invalida", "mensagem": "A entrada não respeita o contrato.", "detalhes": [{"campo": "Meio_Transporte", "mensagem": "...", "tipo": "enum"}]}
```

| Status | `erro` | Quando |
|---|---|---|
| 404 | `nao_encontrado` | rota inexistente ou `?versao=` de modelo não carregada |
| 413 | `lote_acima_do_limite` | `/predicoes/lote` acima de `LIMITE_LOTE` |
| 422 | `entrada_invalida` | validação do contrato; `detalhes[].campo` nomeia o campo |
| 422 | `categoria_desconhecida` | valor fora das `categories_` do encoder (rede de segurança) |
| 429 | `limite_de_taxa` | só nos três `POST /predicoes*`; traz `Retry-After` |
| 503 | `artefato_indisponivel` | artefato não carregou ou falhou na integridade |

## Cabeçalhos

- `X-Origem-Cliente: painel` — enviado pelo front em toda requisição; o log grava `origem = painel`; qualquer outro valor (ou ausência) é `api`. Está em `allow_headers` do CORS.
- `ETag` + `If-None-Match` → 304 nos GET de memória; `expose_headers=["ETag"]` no CORS.
- Limitação de taxa: `30/minute;300/hour` por chave pseudonimizada no individual, `3/minute;20/hour` no lote (`LIMITE_TAXA_*`, desligada local e no CI).

## O que o log de predição guarda — e o que não guarda

Por allowlist: as 16 features de entrada, a resposta, `rotulo_saida`, `risco_acumulado`, versões, latência, status e a `origem` grossa. **Nunca**: o `nome` do relatório, IP, `User-Agent`, cabeçalhos. A limitação de taxa usa um HMAC diário do IP, só em memória.

## Vertente diabetes

As 12 rotas da segunda vertente (ADR 0013) ficam sob `/api/v1/diabetes`, na tag `diabetes` do OpenAPI, com a frase de dados da vertente na descrição da tag. O desenho é o das rotas da obesidade:

- o mesmo envelope de erro e os mesmos cabeçalhos;
- ETag nos GET de memória;
- a mesma limitação de taxa nos três `POST /diabetes/predicoes*`.

Os componentes próprios levam o sufixo `Diabetes`. Os genéricos são os mesmos da obesidade: `CampoFormulario`, `OpcaoCampo`, `FalhaLote`, `Dimensao`, `Medida`, `OpcaoDimensao` e `RespostaDeriva`.

| Método | Caminho | Entrada | Resposta 200 | Cache | Banco |
|---|---|---|---|---|---|
| GET | `/diabetes/model/info` | `?versao=` | `InfoModeloDiabetes`: o manifest da vertente normalizado — versão, `release`, algoritmo, `treinado_em`, `versao_dados`, entradas, hiperparâmetros, desbalanceamento, calibração, split, validação cruzada, `limiar` (o limiar único, de referência: critério, alvo de recall, valor e o ponto fora da dobra), `limiares_por_idade` (o que classifica: critério, alvo de recall, cada grupo de idade com as faixas, o valor e o ponto fora da dobra, e o total fora da dobra; nulo num artefato de limiar único), métricas de teste, ambiente e o `aviso` | `max-age=300`, ETag | não |
| GET | `/diabetes/metadata` | — | `{grupos:[{id, titulo, campos[]}], versao_modelo, aviso}`: as 10 entradas em três grupos (`dados-iniciais`, `saude`, `habitos`), com rótulos, opções, padrões e ajuda | `max-age=3600`, ETag | não |
| POST | `/diabetes/predicoes` | `EntradaDiabetes` (10 campos, `extra=forbid`) | `RespostaDiabetes` | não | escrita assíncrona (log) |
| POST | `/diabetes/predicoes/lote` | `{itens:[dict]}` (teto `LIMITE_LOTE`, 413 acima) | `{total, sucesso, resultados[], falhas[{indice, campo, mensagem}], versao_modelo}` | não | escrita assíncrona |
| POST | `/diabetes/predicoes/relatorio` | `{entrada: EntradaDiabetes, nome?}` | `text/html` autocontido, com o limiar do grupo de idade | não | escrita assíncrona (sem o `nome`) |
| GET | `/diabetes/dimensoes` | — | os 6 filtros, cada valor com rótulo e contagem na base inteira | `max-age=3600`, ETag | não |
| GET | `/diabetes/painel/resumo` | filtros | `ResumoDiabetes`: respostas, com diabetes, prevalência e IMC médio do recorte, e os mesmos números da base inteira (`*_global`) | `max-age=60`, ETag | não |
| GET | `/diabetes/painel/por-categoria` | `campo`, `serie?`, filtros | `AgregadoDiabetes`: tabela longa com `contagem`, `pct`, `n_diabetes` e `prevalencia` por grupo, domínio completo, e os `campos` com os rótulos | `max-age=60`, ETag | não |
| GET | `/diabetes/painel/fatores` | filtros | `FatoresDiabetes`: as 16 variáveis categóricas × resposta, no mesmo formato | `max-age=60`, ETag | não |
| GET | `/diabetes/registros` | filtros, `pagina`, `tamanho` (até 200), `ordenar_por`, `direcao` | `PaginaRegistrosDiabetes`: a página ordenada, com as 23 colunas | `max-age=60`, ETag | não |
| GET | `/diabetes/registros/exportar` | filtros | `text/csv` em streaming: o recorte inteiro, sem teto, na ordem de `linha_origem` | não | não |
| GET | `/diabetes/monitoramento/deriva` | `janela_dias` (1 a 365), `feature?` | `RespostaDeriva`, o contrato da obesidade; `200` com `disponivel: false` com o banco fora ou sem `N_MINIMO_DERIVA_DIABETES` | `max-age=300`; `60` indisponível | **sim** (única leitura) |

**Os filtros:** `sexo`, `faixa_etaria`, `faixa_imc`, `pressao_alta`, `colesterol_alto` e `atividade_fisica_30_dias`. São multivalorados e repetíveis na query, aplicados no servidor sobre a base do painel em memória (ADR 0005), e um valor fora do domínio é 422 nomeando o filtro. O alvo não é filtro: com ele, o "% com diabetes" do recorte viraria 100 % ou 0 %.

**As unidades:** `pct` e `prevalencia` em pontos percentuais, de 0 a 100; a `probabilidade` da predição, de 0 a 1. A prevalência de um grupo com menos de `amostra_minima` respostas sai nula e `suprimido`. As contagens nunca são suprimidas.

**Os rótulos:** as respostas do painel trazem os `campos`, com o rótulo de cada campo e de cada valor. O front não guarda uma segunda cópia deles.

### `RespostaDiabetes`

O primeiro caso de ouro (`backend/tests/diabetes/dados_ouro/entradas.json`), numa chamada local ao modelo 1.1.0:

```json
{"Faixa_Etaria": 11, "Sexo": "Feminino", "IMC": 38.4, "Pressao_Alta": "Sim", "Colesterol_Alto": "Sim", "Fumou_100_Cigarros": "Sim", "Atividade_Fisica_30_Dias": "Sim", "Fruta_Diaria": "Sim", "Verdura_Diaria": "Sim", "Escolaridade": 4}
```

```jsonc
{
  "probabilidade": 0.4705495834350586, // de 0 a 1, na escala da base (respondentes do BRFSS 2015): não é a da população
  "limiar": 0.16155649721622467,       // o do grupo de idade da pessoa; o critério e a tabela em /diabetes/model/info
  "grupo_de_idade": "65 anos ou mais", // o grupo cujo limiar classificou; nulo num artefato de limiar único
  "risco_elevado": true,               // probabilidade >= limiar: a triagem sugere o exame de glicemia
  "classificacao": "Risco elevado",    // ou "Risco baixo"
  "imc": 38.4,
  "faixa_imc": "Obesidade Grau II",    // as 6 faixas de IMC, as mesmas da vertente de obesidade
  "fora_do_dominio_treino": [],        // campos fora da faixa da base, como o modelo os vê (o IMC arredondado)
  "versao_modelo": "1.1.0",
  "latencia_ms": 5.57
}
```

- **O limiar:** é o do grupo de idade da pessoa, pela faixa etária: 18 a 44, 45 a 64 ou 65 anos ou mais. `grupo_de_idade` diz qual, e a mesma probabilidade pode classificar diferente noutra idade. O limiar único, o mesmo critério na base inteira, fica em `/diabetes/model/info` (`limiar`), só como referência ([ADR 0015](decisoes/0015-limiar-por-faixa-etaria.md)).
- **Um artefato sem a tabela** de limiares por idade, como o da 1.0.0, aplica o limiar único a todas as idades, e `grupo_de_idade` sai nulo.
- **O lote e o relatório** seguem a mesma regra: cada resultado do lote traz o limiar e o grupo dele, e o relatório diz o grupo no cartão do limiar e na leitura, com uma linha sobre por que o limiar depende da idade.
- **As escalas:** a faixa etária (1 = 18 a 24 anos … 13 = 80 ou mais) e a escolaridade (1 = nunca estudou … 6 = superior) viajam como inteiros, exatamente como o modelo foi treinado. Os rótulos estão em `/diabetes/metadata`.
- **O IMC:** o contrato aceita de 10 a 100; o modelo o arredonda ao inteiro, como a pesquisa. No simulador, a calculadora usa peso e altura só na tela, e só o IMC vai à API.
- **Um campo da outra vertente,** como `Peso`, é 422 `entrada_invalida` com `tipo: extra_forbidden`, nunca silêncio.

### Erros e log

O envelope é o mesmo da obesidade. A vertente usa:

- **404 `nao_encontrado`:** `?versao=` de um modelo não carregado;
- **413 `lote_acima_do_limite`:** o lote acima de `LIMITE_LOTE`;
- **422 `entrada_invalida` e `categoria_desconhecida`:** a entrada fora do contrato;
- **429 `limite_de_taxa`:** só nos `POST`;
- **503 `artefato_indisponivel`:** o artefato ou a base do painel da vertente não carregou. Nesse caso `/ready` também responde 503, com o `motivo`.

O log é o mesmo `operacao.log_predicao`, com a rota `/diabetes/...`, e grava por allowlist:

- as **10 entradas**;
- a resposta (`RespostaDiabetes`);
- a classificação em `rotulo_saida`;
- versões, latência, status e a `origem` grossa.

`risco_acumulado` fica nulo, porque é a soma das classes de risco da outra vertente. **Nunca** vão ao log o `nome` do relatório, o IP, o `User-Agent` ou os cabeçalhos. A deriva da vertente e a consolidação do log separam as linhas pela rota (ADR 0014).
