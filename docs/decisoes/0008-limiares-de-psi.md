# ADR 0008 — Limiares do PSI e a amostra mínima da deriva

**Data:** 2026-10-17 · **Estado:** aceita · **Fase:** F8b

## Contexto

`GET /monitoramento/deriva` responde "a entrada real se parece com a de treino?" com o *Population Stability Index* por feature, calculado em `sql/deriva/03_indicador_divergencia.sql` sobre as faixas de `operacao.distribuicao_treino_faixa` (decis do snapshot para as numéricas; níveis do domínio mais uma faixa `NULL` para as categóricas):

PSI = Σ (p_log − p_treino) · ln(p_log / p_treino), com epsilon 1e-6 nas proporções.

Dois números precisavam ser fechados: os **cortes de classificação** e o **n mínimo** abaixo do qual nenhum PSI é calculado.

## Decisão 1 — cortes 0,10 e 0,25

| PSI | Classificação |
|---|---|
| < 0,10 | `estavel` |
| 0,10 – 0,25 | `atencao` |
| ≥ 0,25 | `deriva significativa` |
| n < N_MINIMO_DERIVA | `amostra insuficiente` (PSI `NULL`) |

Os cortes **não são um número deste projeto**: são a convenção corrente para o PSI, nascida na validação de modelos de risco de crédito (*scorecards*) e repetida na literatura de monitoramento de modelos — "abaixo de 0,1 sem mudança relevante; 0,1 a 0,25 mudança moderada; acima de 0,25 mudança significativa". Ficam aqui como convenção adotada, não como achado.

## Decisão 2 — N_MINIMO_DERIVA, medido

Critério do plano: o menor `n` para o qual o PSI de uma **reamostragem do próprio conjunto de treino contra ele mesmo** fica abaixo de 0,10 em todas as 16 features. Uma amostra do próprio treino só pode acusar deriva por ruído; o n mínimo é o que torna esse falso alarme raro.

Método (`tools/medir_n_minimo_deriva.py`, reproduzível, semente 42): para cada `n` da grade 25…1000, 300 reamostragens com reposição do snapshot congelado (`versao_dados` do manifest); cada feature é classificada nas mesmas faixas de `artifacts/distribuicao_treino.json`, o PSI é calculado com o mesmo epsilon do SQL, e o critério usa o **percentil 95** do PSI sobre as reamostragens.

Resultado (2026-10-17, snapshot `f3b7296728f8`, 2.111 linhas):

| n | pior PSI p95 (feature) | Idade | Altura | Peso |
|---|---|---|---|---|
| 25 | 2,613 (Peso) | 2,592 | 2,590 | 2,613 |
| 50 | 1,264 (Altura) | 0,906 | 1,264 | 1,200 |
| 75 | 0,355 (Consumo_Alcool) | 0,275 | 0,250 | 0,266 |
| 100 | 0,349 (Consumo_Alcool) | 0,183 | 0,167 | 0,177 |
| 150 | 0,208 (Fumante) | 0,118 | 0,122 | 0,121 |
| **200** | **0,088 (Meio_Transporte)** | 0,084 | 0,085 | 0,087 |
| 300 | 0,074 (Meio_Transporte) | 0,059 | 0,053 | 0,060 |
| 500 | 0,048 (Meio_Transporte) | 0,034 | 0,037 | 0,033 |
| 1000 | 0,019 (Altura) | 0,018 | 0,019 | 0,017 |

**`N_MINIMO_DERIVA = 200`** — o menor n da grade com PSI p95 abaixo de 0,10 em todas as 16 features. Duas leituras: (1) o ponto de partida do plano (100) era otimista — com 100 linhas, uma amostra do próprio treino acusa "atenção" ou "deriva" em uma feature a cada vinte janelas; (2) quem limita são as categóricas de nível raro (`Consumo_Alcool = 'Sempre'`, `Meio_Transporte = 'Moto'/'Bicicleta'`, `Fumante = 'Sim'`), não as numéricas em decis.

## Consequências

- `N_MINIMO_DERIVA` não tem default em `app/config.py`: a API recusa subir com `BANCO_HABILITADO=true` sem ela. O valor medido vai para `.env.example`, `docker-compose.yml` e o CI.
- Abaixo do mínimo, a tela de monitoramento mostra a faixa "amostra insuficiente" e **esconde a coluna de PSI**: amostra insuficiente é resultado, não falha.
- Os cortes vivem só no SQL (`03_indicador_divergencia.sql`); mudar a convenção é um diff de uma query, revisável.
- Índice de expressão por feature (`((entrada->>'Idade')::numeric)`) **não** é criado: seriam 16 índices sobre uma tabela que a retenção mantém pequena. Só se uma consulta passar de 500 ms medidos com `EXPLAIN (ANALYZE, BUFFERS)` sobre o volume real de 30 dias — nunca antes.
