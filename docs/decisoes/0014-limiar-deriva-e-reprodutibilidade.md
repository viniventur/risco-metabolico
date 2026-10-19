# ADR 0014 — Vertente diabetes: limiar de triagem, deriva e reprodutibilidade entre plataformas

**Data:** 2026-10-19 · **Estado:** aceita · **Fases:** F2 a F4 da vertente diabetes · **Cita:** ADR 0004, ADR 0008, ADR 0013

## Contexto

A vertente diabetes (ADR 0013) devolve uma probabilidade e a classifica por um limiar (decisão D4). Isso deixou três números para fechar:

- o **limiar** de triagem;
- a **amostra mínima** da deriva da vertente;
- a **tolerância** com que o `verificar` aceita um retreino feito noutra plataforma.

Além disso, o log de predição é um só para as duas vertentes, e a deriva e a consolidação do log precisaram de quatro decisões de desenho.

Nenhum dos números abaixo é escrito à mão na interface. O limiar e as métricas vêm do manifest, por `GET /api/v1/diabetes/model/info`. As tabelas desta ADR copiam quatro registros de `artifacts/diabetes/metricas/`: `pontos-de-operacao.json` e `por-grupo.json`, gravados pelo `treinar`, e `n-minimo-deriva.json` e `reprodutibilidade.json`, gravados pelas ferramentas de medição.

## Decisão 1 — o limiar: o maior com recall ≥ 0,80 fora da dobra

O critério foi escrito antes de ver os números (notebook 02, célula 28), e o código o guarda literal em `backend/app/diabetes/treino/avaliacao.py::CRITERIO_LIMIAR`: "maior limiar com recall >= 0.8 nas predições fora da dobra do treino".

- **Recall primeiro.** Deixar de encaminhar quem tem diabetes custa mais que um exame de glicemia a mais, e a ação que a triagem sugere é barata e não invasiva.
- **Fora da dobra.** O limiar sai das predições fora da dobra da validação cruzada de 5 dobras do treino. O teste não entra na escolha: é tocado uma vez, para medir.
- **O maior limiar que cumpre o alvo.** Entre os que dão recall ≥ 0,80, o maior é o que encaminha menos gente.

O preço de cada alvo de recall, nas predições fora da dobra do treino (`pontos-de-operacao.json`):

| Recall alvo | Limiar | Recall | Precisão | Especificidade | Encaminhados |
|---|---|---|---|---|---|
| 0,70 | 0,171 | 0,700 | 0,306 | 0,743 | 31,9 % |
| 0,75 | 0,148 | 0,750 | 0,288 | 0,700 | 36,2 % |
| **0,80** | **0,126** | **0,800** | **0,271** | **0,651** | **41,2 %** |
| 0,85 | 0,102 | 0,850 | 0,253 | 0,593 | 46,8 % |
| 0,90 | 0,076 | 0,900 | 0,230 | 0,512 | 54,6 % |

Cada passo de recall custa mais encaminhamentos que o anterior, e o salto cresce depois de 0,80.

**Um limiar para todas as idades.** O risco cresce com a idade. Com um limiar só, quase ninguém entre os mais jovens passa dele, e a maioria dos mais velhos passa. Os números são do teste, no limiar (`por-grupo.json`):

| Grupo | n | Prevalência | ROC-AUC | Recall | Precisão | Encaminhados |
|---|---|---|---|---|---|---|
| 18 a 44 anos | 10.962 | 4,2 % | 0,822 | 0,416 | 0,237 | 7,4 % |
| 45 a 64 anos | 21.855 | 13,5 % | 0,791 | 0,754 | 0,268 | 37,9 % |
| 65 anos ou mais | 17.919 | 20,5 % | 0,724 | 0,874 | 0,271 | 66,0 % |
| Feminino | 28.531 | 12,9 % | 0,810 | 0,784 | 0,269 | 37,6 % |
| Masculino | 22.205 | 15,2 % | 0,779 | 0,806 | 0,268 | 45,9 % |

Um limiar por faixa etária seria uma decisão de política de triagem, fora do escopo do estudo. Fica registrado como limitação (README, seção 18; `docs/modelagem-diabetes.md`). Entre os sexos, recall e precisão ficam próximos.

**Na API.** O `limiar` vai em cada resposta e em `/diabetes/model/info`, com o critério e o ponto fora da dobra. `risco_elevado` é `probabilidade >= limiar`, e a classificação sai em magenta (ADR 0011). A probabilidade vale na escala da base, não na da população: o `description` do contrato diz isso, e a tela também.

## Decisão 2 — `N_MINIMO_DERIVA_DIABETES = 300`, medido

O método é o da ADR 0008 (decisão 2), na mesma ferramenta: `tools/medir_n_minimo_deriva.py --vertente diabetes`. Para cada `n` da grade de 25 a 1000:

- 300 reamostragens com reposição do snapshot congelado (`versao_dados` dee1f27e9777, 253.680 linhas), semente 42;
- cada entrada classificada nas faixas de `artifacts/diabetes/distribuicao_treino.json`, com o IMC arredondado como o modelo o vê;
- o PSI com o mesmo epsilon do SQL (1e-6);
- o critério sobre o percentil 95.

Registro: `artifacts/diabetes/metricas/n-minimo-deriva.json`, medido em 2026-10-19.

| n | pior PSI p95 (entrada) | Faixa etária | IMC | Escolaridade | as outras sete (pior) |
|---|---|---|---|---|---|
| 25 | 3,125 (Faixa_Etaria) | 3,125 | 2,831 | 0,724 | 0,164 |
| 50 | 1,227 (Faixa_Etaria) | 1,227 | 0,887 | 0,562 | 0,093 |
| 75 | 0,757 (Faixa_Etaria) | 0,757 | 0,281 | 0,400 | 0,062 |
| 100 | 0,400 (Faixa_Etaria) | 0,400 | 0,192 | 0,208 | 0,040 |
| 150 | 0,170 (Escolaridade) | 0,163 | 0,117 | 0,170 | 0,030 |
| 200 | 0,125 (Faixa_Etaria) | 0,125 | 0,090 | 0,071 | 0,022 |
| **300** | **0,072 (Faixa_Etaria)** | 0,072 | 0,059 | 0,038 | 0,014 |
| 400 | 0,055 (Faixa_Etaria) | 0,055 | 0,044 | 0,031 | 0,015 |
| 500 | 0,044 (Faixa_Etaria) | 0,044 | 0,034 | 0,024 | 0,008 |
| 750 | 0,027 (Faixa_Etaria) | 0,027 | 0,024 | 0,017 | 0,006 |
| 1000 | 0,021 (Faixa_Etaria) | 0,021 | 0,017 | 0,013 | 0,005 |

**`N_MINIMO_DERIVA_DIABETES = 300`**: o menor `n` da grade com PSI p95 abaixo de 0,10 nas dez entradas. Quem limita é a faixa etária, a entrada com mais níveis (13): em 200 o p95 dela ainda é 0,125. As sete respostas de dois níveis ficam abaixo de 0,10 já em 50. É mais que os 200 da obesidade (ADR 0008).

Os cortes do PSI são os mesmos da obesidade: 0,10 e 0,25, com `amostra insuficiente` abaixo do mínimo. Eles vivem em `sql/diabetes/deriva/03_indicador_divergencia.sql`. O valor medido está no `docker-compose.yml` e no `.env.example`, e `tests/diabetes/test_n_minimo_registrado.py` amarra os dois ao registro.

## Decisão 3 — a deriva da vertente num log compartilhado

1. **A vertente é escolhida pela rota.** As linhas da vertente no `operacao.log_predicao` são as de `rota LIKE '/diabetes/%'` (`/diabetes/predicoes`, `/lote` e `/relatorio`).
   - As três consultas de `sql/diabetes/deriva/` filtram por ela. Elas também filtram, como as da obesidade, por `origem IN ('painel', 'api')`, `status_http = 200` e pela versão do modelo e dos dados servidos.
   - A rota já existia, é obrigatória e diz qual roteador gravou a linha. Uma coluna nova de vertente exigiria migrar a tabela que a versão anterior da API continua gravando.
   - As consultas da obesidade (`sql/deriva/`) não mudaram: já filtram pela versão do modelo e dos dados, que as linhas de diabetes nunca têm.
2. **O IMC é comparado arredondado.** O modelo arredonda o IMC ao inteiro, como a limpeza da origem: é o passo `imc` do pipeline. A referência foi tirada do snapshot, em que o IMC já é inteiro. A deriva classifica o `round` do IMC do log, que em `double precision` desempata no par, como o numpy. Sem isso, um IMC de 28,6 vindo da calculadora cairia na faixa que vai de 27 a 29, mas o modelo o vê como 29, que é da faixa seguinte.
3. **A variável é opcional.** `N_MINIMO_DERIVA_DIABETES` não tem default e, ao contrário de `N_MINIMO_DERIVA`, não é obrigatória com o banco ligado: uma variável nova obrigatória derrubaria a API de quem atualiza a imagem sem ela. Sem a variável, a API sobe e só `GET /api/v1/diabetes/monitoramento/deriva` responde `disponivel: false`, com o motivo nomeando a variável.
4. **A consolidação do log é separada por vertente.** `operacao.manutencao_log` resume o log antigo em `operacao.deriva_diaria` antes de apagá-lo (retenção de `RETENCAO_DIAS` e o teto de linhas) e classifica as linhas pela view `operacao.v_deriva_faixa`.
   - **O defeito.** Sem filtro, as linhas de diabetes, que não têm as chaves da obesidade, cairiam pelo `IS NOT DISTINCT FROM` nas faixas NULL ("chave ausente") das 13 categóricas da obesidade.
   - **A correção.** A view passa a ignorar `rota LIKE '/diabetes/%'`. A vertente tem a classificação dela, `operacao.diabetes_v_deriva_faixa`, igual à das consultas 02 e 03 dela, e a série dela, `operacao.diabetes_deriva_diaria`.
   - **A função.** A assinatura não muda, e `consolidadas` soma as duas vertentes.
   - **O teste.** `tests/diabetes/test_consolidacao_log.py` compara com a definição anterior da view: para as linhas da obesidade, o resultado é o mesmo, linha a linha.

## Decisão 4 — reprodutibilidade entre plataformas, medida

**O achado.** O mesmo snapshot, os mesmos pacotes (`uv.lock`) e a mesma semente dão, em Windows e em Linux, **modelos diferentes**: nenhuma das 50.736 probabilidades do teste sai igual bit a bit. O XGBoost sorteia as linhas (`subsample`) e as colunas (`colsample_bytree`) de cada árvore com as distribuições da biblioteca padrão do C++, que cada compilador implementa a seu modo. A diferença é da ordem da que uma troca de semente produz na mesma plataforma.

A medição é de `tools/medir_reprodutibilidade_diabetes.py`, com registro em `artifacts/diabetes/metricas/reprodutibilidade.json` (2026-10-19). Ela compara a semente 42 em Windows, a do modelo publicado, com a mesma semente em Linux e com as sementes 43 a 47 em Windows:

| Medida | Windows × Linux, semente 42 | Sementes 43–47 × 42, Windows |
|---|---|---|
| desvio máximo nas 50.736 probabilidades do teste | 0,0604 | 0,0799 |
| desvio p99,9 e mediano no teste | 0,0339 e 0,0020 | — |
| desvio máximo nos 24 casos de ouro | 0,0376 | 0,0538 |
| maior diferença numa métrica do manifest | 0,0017 (recall na precisão fixa) | 0,0064 (a mesma) |

Os 24 casos de ouro mantêm a classificação em todos os treinos medidos. O mais próximo do limiar fica a 0,0411 dele.

**A regra do `verificar`** (`python -m app.diabetes.treino verificar`, que roda no CI):

- **Na plataforma do treino** (`ambiente.sistema` do manifest, hoje Windows): o sha256 exato das predições de ouro e as métricas a `1e-6`.
- **Noutra plataforma** (o CI, em Linux):
  - a mesma classificação nos 24 casos de ouro;
  - as probabilidades a `TOLERANCIA_PROBAS_ENTRE_PLATAFORMAS = 0,10`;
  - as métricas a `TOLERANCIA_METRICAS_ENTRE_PLATAFORMAS = 0,01`.

As duas tolerâncias cobrem com folga o maior desvio registrado: 0,0799 nas probabilidades e 0,0064 nas métricas, ambos entre sementes. `test_tolerancias_cobrem_a_medicao_registrada` confere isso contra o JSON. Se o desvio crescer, o portão fecha e a medição é refeita.

A tolerância da obesidade (0,03, ADR 0004) não serviria aqui: só entre plataformas, o desvio medido no teste já passa dela.

## Consequências

- **Mudar o critério do limiar** é mudar `CRITERIO_LIMIAR` e retreinar: o `verificar` compara o critério do manifest com o do código.
- **Um modelo ou um snapshot novo** pede a remedição do mínimo e o valor novo no compose e no `.env.example`: o registro guarda a versão do modelo e a dos dados, e `test_n_minimo_registrado.py` falha enquanto eles divergirem do manifest. Um snapshot novo também pede `distribuicao --escrever`.
- **Um artefato novo, treinado noutra plataforma ou com outra versão do XGBoost,** pede a remedição da reprodutibilidade. O teste das tolerâncias diz se as constantes ainda cobrem o registro.
- **Até haver 300 respostas da vertente na janela,** a tela de monitoramento mostra "amostra insuficiente" e esconde a coluna de PSI, como a da obesidade abaixo do mínimo dela.
- **Ao voltar para uma versão sem a vertente,** a consolidação antiga volta a misturar as linhas de diabetes nas faixas NULL da obesidade, mas só para linhas mais velhas que `RETENCAO_DIAS` (ADR 0013, "Por que o deploy continua reversível").
