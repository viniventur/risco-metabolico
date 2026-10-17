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
