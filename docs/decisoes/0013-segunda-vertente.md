# ADR 0013 — Segunda vertente: a triagem de diabetes ao lado da de obesidade

**Data:** 2026-10-19 (decidida pelo autor em 2026-10-18) · **Estado:** aceita · **Fases:** F0 a F6 da vertente diabetes · **Cita:** ADR 0003, ADR 0004, ADR 0005, ADR 0006, ADR 0011, ADR 0012, ADR 0014, ADR 0015

## Contexto

O modelo servido classifica sete níveis de obesidade, numa base em que a maior parte dos registros foi gerada sinteticamente pelos próprios autores (`data/bruto/FONTE.md`), e altura e peso estão entre as entradas. A ADR 0003 já admitia: "a fronteira de decisão real do problema é quase literalmente uma faixa de IMC".

Em 2026-10-18 o autor pediu um alvo que atendesse a três critérios: (1) não pode ser calculado a partir das entradas; (2) precisa ser caro ou indisponível no momento da triagem; (3) precisa vir de dados reais. O diagnóstico de diabetes, a partir de um questionário, atende aos três, e nele o IMC passa a ser uma entrada legítima. A base é o conjunto *CDC Diabetes Health Indicators* (UCI 891), cópia do BRFSS 2015: respostas reais e anonimizadas, conferidas na fonte (`data/bruto/diabetes/FONTE.md`).

O pedido era **trocar** o alvo. O autor decidiu outra coisa: o diabetes entra como **segunda vertente, paralela**. A de obesidade fica intocada — modelo v2.0.0, simulador, painel, contrato, artefatos, notebook 01 e testes. A junção das duas previsões, com o modelo de obesidade retreinado sem peso e altura, fica com ele, depois.

## Decisão

Cinco decisões, propostas na F0 com a recomendação de cada uma e aceitas pelo autor ("ok nas recomendações").

**D1 — Alvo binário, como vem no arquivo.** `Diabetes = Sim` é quem já ouviu de um profissional de saúde que tem diabetes. O pré-diabetes e o diabetes só na gravidez ficam no `Não`. A página do repositório público diz o contrário ("1 = prediabetes or diabetes"); o cruzamento linha a linha com o arquivo de três classes do conjunto de origem põe as 4.631 respostas de pré-diabetes no 0 (FONTE.md, divergência 1). Três motivos:

- uma fonte só basta: a alternativa "diabetes ou pré-diabetes" exigiria trazer o arquivo de três classes da origem como segundo arquivo bruto;
- o pré-diabetes autodeclarado mede quem fez o exame, não a doença;
- três classes pediriam aprender uma classe rara e autodeclarada.

**D2 — Dez entradas, para quem ainda não tem diagnóstico.** São elas:

- faixa etária (as 13 faixas do BRFSS) e sexo;
- IMC: campo numérico, com uma calculadora por peso e altura na tela que só preenche o campo, então o contrato não muda;
- pressão alta e colesterol alto (diagnósticos já recebidos);
- se fumou 100 cigarros na vida;
- atividade física nos últimos 30 dias;
- fruta e verdura todo dia;
- escolaridade.

Uma variável entra se uma pessoa sem diagnóstico consegue respondê-la e se a associação dela com o alvo não é, principalmente, consequência do diagnóstico ou do acesso a ele. Ficam de fora cinco grupos:

| Grupo | Variáveis | Por quê |
|---|---|---|
| consequências | saúde geral, dias de saúde mental e física ruins, dificuldade de caminhar | descrevem o efeito da doença, não o antecedem |
| acesso ao diagnóstico | cobertura de saúde, deixar de ir ao médico por custo, exame de colesterol nos últimos 5 anos | predizem "foi diagnosticado": o modelo daria risco menor a quem não vai ao médico, que é quem a triagem procura |
| complicações | AVC, doença coronariana ou infarto | complicações da própria diabetes |
| álcool pesado | consumo pesado de álcool | a associação aponta para o lado contrário: o simulador ensinaria que beber muito protege |
| renda | faixa de renda | faixas em dólares de 2015, sem tradução para quem usa o produto |

Todas continuam no banco, na Consulta e no gráfico de fatores da Visão Geral, como dado descritivo.

O custo de cada exclusão foi medido depois da decisão, para confirmá-la ou derrubá-la (notebook 02, célula 16). A medição usou validação cruzada de 5 dobras no treino, com LightGBM numa configuração de referência. São os números daquela execução, registrados aqui como evidência; as métricas publicadas vêm do manifest.

| Entradas | n | ROC-AUC | PR-AUC |
|---|---|---|---|
| todas as 21 | 21 | 0,8311 | 0,4366 |
| sem consequências | 17 | 0,8124 | 0,4070 |
| sem acesso ao diagnóstico | 18 | 0,8297 | 0,4350 |
| sem complicações | 19 | 0,8298 | 0,4333 |
| **as 10 entradas** | **10** | **0,7994** | **0,3816** |
| 10 + álcool pesado | 11 | 0,8018 | 0,3862 |
| 10 + renda | 11 | 0,8049 | 0,3923 |
| 10 + complicações | 12 | 0,8046 | 0,3938 |
| 10 sem escolaridade | 9 | 0,7961 | 0,3774 |
| mínimo: idade, sexo, IMC, pressão, colesterol, atividade | 6 | 0,7946 | 0,3759 |

Quase toda a distância entre as 21 variáveis e as 10 entradas vem das consequências. Esse é o ganho que o modelo não pode usar. Os outros grupos custam pouco, e cada um traz o defeito descrito na tabela anterior.

**D3 — Uma frase de dados por vertente, literal e com portão.** A frase obrigatória diz "fictícios", o que é falso para o BRFSS. Ela fica intacta onde vale, e a vertente nova ganha a sua:

> Os dados exibidos são respostas reais e anonimizadas de uma pesquisa pública de saúde dos Estados Unidos (BRFSS 2015, CDC) e servem apenas para demonstração. Nenhum registro identifica uma pessoa. Esta ferramenta é de triagem e não substitui avaliação clínica.

Onde cada frase aparece:

- **Rodapé.** Ele escolhe a frase pela rota (`frontend/src/shared/ui/avisosDaRota.ts`). As telas `/diabetes/*` mostram a da D3; as da obesidade, a de sempre; Início, Estudos, Privacidade e a página que não existe, as duas.
- **README.** O primeiro bloco traz as duas, na mesma citação.
- **API.** O relatório HTML, o `aviso` do formulário e o de `/diabetes/model/info`, a tag `diabetes` e a descrição geral do OpenAPI.
- **Estudo.** O notebook 02 e `study/README.md`.

Os portões:

- `test_aviso_de_dados_reais_presente`: o código, o estudo e o notebook;
- `test_aviso_de_dados_reais_no_front`: `RodapeAviso.tsx`;
- `test_aviso_de_dados_reais_no_readme`: o primeiro bloco do README, o mesmo que o portão da frase da obesidade lê.

O selo do herói do Início passa a dizer só "Triagem, não diagnóstico", o que vale para o produto inteiro. A natureza de cada base fica no cartão "Dados", também a pedido do autor. Desde a ADR 0016, cada projeto tem o seu cartão "Dados", no bloco dele do Início.

**D4 — Limiar e saída da API.** O limiar é o **maior** com recall ≥ 0,80 nas predições fora da dobra do treino. Ele é escolhido na validação cruzada e avaliado uma vez no teste. A resposta traz:

- a probabilidade, na escala da base e não da população;
- o limiar;
- `risco_elevado`;
- a classificação, "Risco elevado" ou "Risco baixo", em magenta (ADR 0011);
- o IMC com a faixa da OMS;
- os campos fora do domínio da base;
- a versão e a latência.

O critério, o preço de cada alvo de recall e o limiar único para todas as idades estão na ADR 0014. Desde a versão 1.1.0, o limiar é o do grupo de idade da pessoa: ADR 0015.

**D5 — Nomes e versões próprios.**

| Peça | Nome |
|---|---|
| Release | `diabetes-v1.0.0`, versão própria, com o `.pkl` e o snapshot; a obesidade segue em `v2.0.0`, o release marcado como o mais recente |
| Manifest | `artifacts/diabetes/manifest.json`, com `vertente` e `release` |
| API | `/api/v1/diabetes/*`, tag `diabetes`: 12 rotas (`docs/contrato-api.md`) |
| Banco | tabela `dados.registros_diabetes`; referências e série de deriva em `operacao.diabetes_*`; o log é o `operacao.log_predicao` de sempre, com a rota `/diabetes/...` |
| Front | grupo "Diabetes" no menu, entre "Modelo" e "Estudos": `/diabetes`, `/diabetes/consulta`, `/diabetes/simulador`, `/diabetes/monitoramento`; seção "Triagem de diabetes" no Início, entre "Modelo servido" e "Explorar" |
| Dados brutos | `data/bruto/diabetes/` (o CSV, em CRLF preservado, e o `FONTE.md`) |
| Notebook | `study/02_triagem_de_diabetes.ipynb`, em `/estudos/triagem-de-diabetes` |
| Código | `backend/app/diabetes/`, `frontend/src/features/diabetes/`, `sql/diabetes/` |

O menu e o Início mudaram de forma na ADR 0016: um bloco por projeto, a obesidade e a diabetes, cada um com as mesmas quatro telas.

## Como as duas vertentes convivem

- **Código.** Tudo da vertente é novo e fica no pacote dela. O que já era genérico entra por import, sem edição:
  - o materializador SQL e o snapshot do parquet;
  - o banco, os erros, o limite de taxa e o sumidouro do log;
  - os componentes de gráfico, de filtro e de deriva do front;
  - os esquemas `CampoFormulario`, `OpcaoCampo`, `FalhaLote`, `Dimensao`, `Medida` e `OpcaoDimensao` do OpenAPI.
- **Dados.** Tabela, snapshot, manifest, release e referências de deriva próprios. O snapshot fica em `data/processado/diabetes/`, porque o `congelar` da obesidade apaga os `snapshot-*.parquet` da pasta dele. `operacao.carga_fonte` registra as duas cargas, cada uma com o seu `FONTE.md`.
- **Log.** Uma tabela só, como pede a D5. A linha leva a rota, e só as dez entradas atravessam a allowlist. `risco_acumulado` fica nulo, porque é a soma das classes de risco da outra vertente. A deriva e a consolidação de cada vertente escolhem as linhas pela rota (ADR 0014).
- **API.** O roteador `/diabetes` é registrado em `main.py`. `/ready` só responde 200 com o artefato e a base do painel das duas vertentes. `/health` não muda.
- **Front.** As rotas e o menu crescem, e o rodapé escolhe a frase pela rota. A cor da vertente é um token novo, `--diabetes`, violeta. O magenta continua só da previsão (ADR 0011), e a pirâmide marca o sexo pela posição, porque o violeta não se separa do azul masculino.
- **Testes.** A vertente tem a suíte dela em `backend/tests/diabetes/`, `RodapeAviso.test.tsx` e os vitest de `features/diabetes`, e os e2e num arquivo só (`frontend/e2e/diabetes.spec.ts`). Testes existentes alterados, cada um registrado no commit da fase e levado ao autor:
  - o snapshot do OpenAPI, que só ganha acréscimos;
  - o portão de proveniência, que passa a ler os dois `FONTE.md`;
  - uma consulta de `test_seed.py`, que lia "a última carga" e passou a ler a da tabela da obesidade (F1);
  - a lista de rotas de `test_openapi_tem_as_rotas_e_a_tag_da_vertente`, um teste da própria vertente (F4);
  - a data e a versão da Política de Privacidade em `PrivacidadePage.test.tsx` (F6).

  As duas primeiras estavam previstas no plano da F0; as duas últimas foram autorizadas pelo autor antes da edição.

## O que foi estendido (F1 a F5)

Arquivos compartilhados que ganharam extensão. Sem tráfego nem dado da vertente, cada um faz o que fazia.

| Arquivo | Fase | Extensão |
|---|---|---|
| `.gitattributes` | F1 | `data/bruto/diabetes/*.csv -text`: o CSV mantém o CRLF, e o sha256 registrado no `FONTE.md` vale em qualquer clone |
| `LICENSE` | F1 | um parágrafo com a licença do CSV novo (CC0 1.0) |
| `scripts/verificar-proveniencia.ps1`, `backend/tests/test_proveniencia.py` | F1 | leem todo `data/bruto/**/FONTE.md`; o nome de cada autor só vale no próprio |
| `sql/schema.sql` | F1, F4 | as seções da vertente: a tabela, as referências `operacao.diabetes_*`, a view e a série da consolidação dela; `v_deriva_faixa` ignora as linhas `/diabetes/...`; `manutencao_log` ganha o passo da vertente, com a mesma assinatura |
| `.dockerignore`, `backend/Dockerfile` | F1, F3, F4 | o snapshot da vertente entra no contexto; a imagem baixa o `.pkl` e o snapshot do release `diabetes-v<versao>` num `RUN` à parte e deriva a base do painel dela |
| `scripts/baixar_modelo.py`, `scripts/baixar-modelo.ps1` | F3 | a tag vem do `release` do manifest; sem o campo, `v<versao>` |
| `backend/app/main.py`, `backend/app/api/rotas/saude.py` | F3, F4 | o artefato e a base da vertente no lifespan, o roteador `/diabetes`, a tag `diabetes`; `/ready` exige as duas vertentes, sem campo novo no corpo |
| `backend/app/config.py`, `.env.example`, `docker-compose.yml` | F4 | `N_MINIMO_DERIVA_DIABETES`, opcional (ADR 0014) |
| `tools/medir_n_minimo_deriva.py`, `tools/verificar-cabecalhos-sql.py` | F4 | `--vertente diabetes`; os cabeçalhos de `sql/diabetes/agregados` |
| `.github/workflows/ci.yml`, `scripts/deploy.sh`, `scripts/verificar-stack.sh` | F1, F3, F4, F5 | o seed e a conferência da base, o snapshot, os agregados, o download do modelo, o `verificar`, a referência de deriva, as rotas e as telas da vertente |
| `frontend/src/routes.tsx`, `shared/layout/navegacao.ts` | F5 | as quatro telas e o grupo do menu |
| `frontend/src/app.tsx`, `shared/layout/CascaCarregando.tsx`, `shared/ui/RodapeAviso.tsx` | F5 | o rodapé por rota (`avisosDaRota.ts`) e a frase da D3 |
| `shared/filtros/agregadoUtil.ts` | F5 | o tipo de entrada de `pivotar`, mais largo, com o mesmo corpo |
| `shared/tema/tokens.css`, `shared/tema/useChartTheme.ts`, `docs/design-tokens.md` | F5 | o token `--diabetes`, validado nos dois temas |
| `features/inicio/InicioPage.tsx` | F5 | a seção "Triagem de diabetes" |
| `features/inicio/Heroi.tsx`, `SobreOProjeto.tsx`, `shared/layout/Sidebar.tsx` | entre F1 e F2 | o selo e a natureza das duas bases (D3) |
| `frontend/nginx.conf`, `frontend/public/sitemap.xml` | F5 | a regex de rotas do SPA e o sitemap com as telas e o notebook da vertente |

Na F6 entram só textos: esta ADR e a 0014, `docs/modelagem-diabetes.md`, as seções da vertente no README e nos documentos, a Política de Privacidade (versão 1.1), a descrição geral do OpenAPI e a descrição do site (`index.html` e `site.webmanifest`).

## Por que o deploy continua reversível

- **Tudo é aditivo.** O banco ganha tabelas por `CREATE TABLE IF NOT EXISTS`. A view e a função de consolidação são trocadas por `CREATE OR REPLACE`, com as mesmas colunas e a mesma assinatura. Nada é apagado nem renomeado, e nenhuma coluna existente muda.
- **A versão anterior não enxerga a vertente.** A imagem v2 não lê nenhuma tabela nova. As consultas de deriva dela filtram pela versão do modelo e dos dados, e as linhas de diabetes do log nunca têm as dela.
- **A volta reaplica o schema anterior.** A volta automática do `deploy.sh`, ou um `git revert` com push, reaplica o `schema.sql` da versão anterior. As tabelas da vertente ficam, sem uso, e a view e a função voltam à definição antiga.
- **Na volta automática, o script é o novo e a imagem da API é a anterior.** O `preparar_banco` pergunta à imagem se ela tem a vertente; sem ela, pula o seed e a referência de deriva da vertente. A F7 achou o defeito: sem essa pergunta, a volta parava no seed da vertente, com o banco na versão anterior e a API e o web ainda nas imagens novas.
- **Um cuidado, só para uma volta longa.** A função antiga consolidaria as linhas de diabetes do log nas faixas NULL das 13 categóricas da obesidade, o defeito que a F4 corrigiu (ADR 0014, decisão 3). Ela só consolida linhas mais velhas que `RETENCAO_DIAS`. Uma volta curta não chega lá; uma que fique no ar mais que isso, com tráfego de diabetes no log, chega.
- **O primeiro deploy cai por cima do volume da v2**, que é o que a VPS tem. O schema reaplicado cria as tabelas, o seed carrega a base uma vez (idempotente por sha256) e a referência de deriva da vertente é carregada. A F7 conferiu esse caminho, o do volume vazio e as duas voltas: nada do que a v2 gravou mudou.

## Consequências

- Dois modelos, dois manifests, dois releases. O CI verifica os dois (`python -m app.treino verificar` e `python -m app.diabetes.treino verificar`), e retreinar uma vertente não toca a outra.
- A imagem da API baixa dois `.pkl` e dois snapshots, e guarda as duas bases do painel em memória.
- O log mistura as duas vertentes. Quem consulta direto no banco separa pela rota.
- A junção das previsões e o retreino da obesidade sem peso e altura continuam fora do escopo: são do autor.
- Os limites da base viajam com a vertente: dados autodeclarados, estudo transversal (quem já tem o diagnóstico pode ter mudado o hábito), alvo que é o diagnóstico recebido e nenhum peso amostral (a prevalência da base não é a da população). Eles estão em `docs/modelagem-diabetes.md`, na seção 18 do README e no Início.
- Documentação da vertente:
  - `docs/modelagem-diabetes.md`;
  - `docs/dicionario-de-dados-diabetes.md` e `data/bruto/diabetes/FONTE.md`;
  - as seções "Vertente diabetes" de `docs/contrato-api.md`, `docs/agregados.md` e `docs/deploy-vps.md`;
  - `study/README.md`;
  - a seção 18 do README.
