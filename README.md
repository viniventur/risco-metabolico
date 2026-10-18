# Triagem Metabólica

> Os dados exibidos são fictícios e servem apenas para demonstração. Nenhum registro corresponde a uma pessoa real. Esta ferramenta é de triagem e não substitui avaliação clínica.

[![ci](https://github.com/viniventur/risco-metabolico/actions/workflows/ci.yml/badge.svg)](https://github.com/viniventur/risco-metabolico/actions/workflows/ci.yml)
[![modelo](https://img.shields.io/badge/modelo-2.0.0-blue)](https://github.com/viniventur/risco-metabolico/releases/tag/v2.0.0)
[![licença](https://img.shields.io/badge/licen%C3%A7a-MIT-green)](LICENSE)

Um microserviço de machine learning que recebe **16 respostas** sobre medidas corporais e hábitos e devolve, em milissegundos, a **distribuição de probabilidade entre 7 faixas** de composição corporal mais um **risco metabólico acumulado**. A saída **ordena prioridade de atenção**; ela não fecha diagnóstico.

Em volta do modelo: uma API FastAPI com contrato versionado; um front React com simulador, painel analítico, notebook de estudo renderizado e uma tela de monitoramento de deriva; um Postgres que guarda a base de origem e o log de predições; e o SQL do projeto (schema, agregados do painel, consultas de deriva) versionado em `sql/`. **O diferencial não é o modelo — é o serviço em volta dele**, e a auditoria do modelo herdado que motivou cada decisão (seção 7).

## Sumário

1. [Demonstração ao vivo](#1-demonstração-ao-vivo)
2. [Capturas de tela](#2-capturas-de-tela)
3. [Métricas do modelo](#3-métricas-do-modelo)
4. [Arquitetura](#4-arquitetura)
5. [Como rodar local, sem nenhuma credencial](#5-como-rodar-local-sem-nenhuma-credencial)
6. [Como retreinar](#6-como-retreinar)
7. [O que este projeto corrige do modelo herdado](#7-o-que-este-projeto-corrige-do-modelo-herdado)
8. [Cold start e hibernação do banco](#8-cold-start-e-hibernação-do-banco)
9. [Desempenho](#9-desempenho)
10. [Fonte de dados e licença](#10-fonte-de-dados-e-licença)
11. [Autoria](#11-autoria)
12. [O que não está no repositório e por quê](#12-o-que-não-está-no-repositório-e-por-quê)
13. [Onde está o SQL](#13-onde-está-o-sql)
14. [Limitações conhecidas](#14-limitações-conhecidas)
15. [Deploy e variáveis de ambiente](#15-deploy-e-variáveis-de-ambiente)
16. [Testes e portões](#16-testes-e-portões)
17. [Mapa do repositório e documentação](#17-mapa-do-repositório-e-documentação)

## 1. Demonstração ao vivo

| O quê | Onde |
|---|---|
| Front (painel, simulador, estudos, monitoramento) | _publicação em andamento — URL preenchida no deploy_ |
| Documentação interativa da API (`/docs`) | _publicação em andamento — URL preenchida no deploy_ |
| Vivacidade da API (`/api/v1/health`) | _publicação em andamento — URL preenchida no deploy_ |

Se o serviço estiver hibernando, a primeira chamada pode levar até 60 s (seção 8).

## 2. Capturas de tela

**Visão Geral** — 6 KPIs e 7 gráficos sobre o recorte; clicar numa barra filtra o painel inteiro pela URL, `Esc` limpa, voltar desfaz.

![Visão Geral do painel](docs/capturas/painel.png)

**Simulador de triagem** — o formulário nasce de `GET /metadata`; a resposta traz as 7 probabilidades em ordem clínica, o risco acumulado, o IMC e o relatório para baixar ou imprimir.

![Simulador de triagem](docs/capturas/simulador.png)

## 3. Métricas do modelo

**Nenhuma métrica deste README é escrita à mão.** O treino grava acurácia, F1-macro e recall das classes de risco em `artifacts/manifest.json`; a API serve esse manifest em `GET /api/v1/model/info`, e os três cartões da página inicial leem dali. Para ver os números vigentes:

```powershell
# local
Invoke-RestMethod http://127.0.0.1:8000/api/v1/model/info | Select-Object -ExpandProperty metricas_teste
# campos: acuracia, f1_macro, recall_risco — medidos no conjunto de teste (20 %, estratificado)
```

O mesmo endpoint responde `versao`, `algoritmo`, `treinado_em`, `versao_dados` (seção 6), `n_features_modelo`, hiperparâmetros, SMOTE, split, gap treino/teste e o ambiente de treino. O CI retreina sobre o mesmo snapshot e falha se as predições não baterem (`python -m app.treino verificar`), então o manifest commitado é sempre o do artefato publicado.

As métricas do modelo **herdado** ficam só em [`docs/auditoria-do-legado.md`](docs/auditoria-do-legado.md), marcadas como históricas. Critério de escolha entre candidatos, hiperparâmetros congelados e os dois A/B (binning, IMC) estão em [`docs/modelagem.md`](docs/modelagem.md).

## 4. Arquitetura

```mermaid
flowchart TB
    subgraph nav["Navegador"]
        R["React 19 + Vite 8 + TS<br/>Recharts 3 · TanStack Query/Table/Virtual<br/>filtros na URL (nuqs)"]
    end

    subgraph vercel["Vercel (estático)"]
        D["dist/ + public/study/*.json"]
    end

    subgraph api["Contêiner FastAPI — único que fala com o banco"]
        RT["api/rotas<br/>saude · modelo · metadados · predicoes<br/>painel · registros · monitoramento"]
        ES["esquemas/ (Pydantic v2)<br/>sem pandas, sem sklearn"]
        DM["dominio/<br/>features · predicao · regras<br/>relatorio · agregados"]
        AR["nucleo/artefato.py<br/>carga no lifespan + sha256"]
        BC["nucleo/banco.py + log_predicao.py<br/>pool preguiçoso · fila em memória"]
    end

    subgraph disco["Volume / imagem"]
        MD["models/modelo-2.0.0.pkl"]
        AF["artifacts/manifest.json<br/>agregados/*.json · distribuicao_treino.json"]
        DT["data/processado/base_painel.parquet"]
    end

    subgraph pg["Postgres gerenciado (publicado) / compose (local)"]
        T1["dados.registros_triagem<br/>dados.rotulos_escala"]
        T3["operacao.log_predicao"]
        T4["operacao.carga_fonte<br/>operacao.snapshot_treino<br/>operacao.distribuicao_treino_*"]
    end

    subgraph off["Offline (CLI de treino e de agregação)"]
        NB["study/01_comparacao_de_modelos.ipynb"]
        CSV["data/bruto/obesity.csv + FONTE.md"]
        SEED["python -m app.dados.seed<br/>roda uma vez, idempotente"]
        SEL["SELECT congelado<br/>ORDER BY linha_origem"]
        PARQ["snapshot-*.parquet<br/>sha256 = versao_dados"]
        TR["python -m app.treino"]
        SQLA["sql/agregados/*.sql<br/>sql/pontos/*.sql"]
    end

    DERIVA["sql/deriva/*.sql<br/>entrada real × snapshot"]

    CSV --> SEED --> T1
    SEED --> T4
    T1 --> SEL --> PARQ --> TR
    TR --> MD
    TR --> T4
    TR --> DT
    T1 --> SQLA --> AF
    R -->|"HTTPS JSON<br/>/api/v1/*"| RT
    D --> R
    RT --> ES --> DM --> AR --> MD
    DM --> AF
    DM --> DT
    RT --> BC
    BC -.->|"fila em background;<br/>falha não derruba a predição"| T3
    BC -->|"única leitura de runtime"| DERIVA
    T3 --> DERIVA
    T4 --> DERIVA
    NB -.prova paridade por assert.-> DM
    NB -->|tools/nb2json.py| D
```

Quatro leituras do diagrama:

- **O notebook não é a fonte do código, mas prova que o código é fiel a ele.** As fórmulas continuam visíveis em `study/`, e uma célula de paridade mostra por `assert_frame_equal` que `dominio/features.py` produz exatamente o mesmo resultado. Não existe "versão do notebook" e "versão da API" de uma mesma fórmula.
- **`esquemas/` não importa pandas nem sklearn.** É o que mantém o `openapi.json` limpo e permite gerar os tipos TypeScript do front a partir dele (`src/shared/api/schema.d.ts` é gerado, não editado; o CI confere).
- **O banco é a fonte e o destino, nunca o caminho de um gráfico.** O CSV é semeado uma vez; o CLI congela um `SELECT` ordenado em parquet e o `sha256` desse arquivo vira `versao_dados`; os agregados nascem de SQL versionado. Em tempo de requisição, o painel inteiro é servido de memória. A única leitura que atravessa o banco em runtime é `/monitoramento/deriva`, e a escrita do log é assíncrona.
- **O navegador nunca fala com o Postgres.** Não há autenticação neste desenho e, por isso, não há caminho do cliente para o banco: nenhuma credencial existe no front nem no build. A senha vive em uma variável de ambiente do servidor, `BANCO_URL`, e em mais lugar nenhum ([ADR 0007](docs/decisoes/0007-postgres-sem-autenticacao.md)).

Contrato completo em [`docs/contrato-api.md`](docs/contrato-api.md): prefixo `/api/v1`, rotas de domínio em português (`/predicoes`, `/painel/*`, `/registros`, `/monitoramento/deriva`), de infraestrutura em inglês (`/health`, `/ready`, `/model/info`, `/metadata`), envelope único de erro, ETag nos GET de memória e limitação de taxa só nos `POST /predicoes*`.

## 5. Como rodar local, sem nenhuma credencial

Tudo roda contra um Postgres do `docker compose` cuja senha é `postgres` e está versionada de propósito. Nenhuma conta de nuvem é necessária.

**Pré-requisitos:** PowerShell 7+, Docker Desktop, [`uv`](https://docs.astral.sh/uv/), Node.js 24 e o cliente `psql`. O `psql` pode ser instalado com `winget install --id PostgreSQL.PostgreSQL.16 -e --override '--enable-components commandlinetools'` ou, sem instalar nada, usado de dentro do contêiner: `docker compose exec -T banco psql -U postgres -d app_local -qtAX -c "select 1"`.

```powershell
git clone https://github.com/viniventur/risco-metabolico.git
Set-Location risco-metabolico

# 1. Postgres local: o initdb aplica sql/schema.sql e sql/grants.sql — os MESMOS da instância publicada.
#    --wait importa: sem ele o seed corre contra um banco que ainda está aplicando o schema.
docker compose up -d --wait banco
$env:BANCO_URL = "postgresql://postgres:postgres@127.0.0.1:55432/app_local"   # local e descartável

# 2. Semeadura, snapshot congelado e agregados (gera data/processado/base_painel.parquet)
Push-Location backend
uv sync --extra treino
uv run --extra treino python -m app.dados.seed              # idempotente; grava o hash do CSV e do FONTE.md
uv run --extra treino python -m app.dados.schema --conferir # banco == sql/schema.sql == dicionário de dados
uv run --extra treino python -m app.treino congelar         # snapshot + agregados na mesma transação
uv run --extra treino python -m app.treino.distribuicao --carregar   # referência de deriva (tela de monitoramento)
Pop-Location

# 3. O artefato de modelo: baixa o .pkl do release v<versao> e confere o sha256 do manifest
python scripts\baixar_modelo.py --manifesto artifacts\manifest.json --destino models

# 4. API + banco em contêineres (origem cruzada de verdade, para o CORS ser testado antes do deploy)
docker compose up -d --build        # http://127.0.0.1:8000/docs

# 5. Front em modo de desenvolvimento
Push-Location frontend
npm ci
npm run dev                         # http://localhost:5173 — fala com http://127.0.0.1:8000/api/v1 por padrão
Pop-Location
```

Para rodar a API fora do contêiner (depuração), de `backend/`: `uv run uvicorn app.main:app --host 127.0.0.1 --port 8000` com `BANCO_URL` acima, `BANCO_HABILITADO=true`, `N_MINIMO_DERIVA=200` e `LIMITE_TAXA_ATIVO=false` no ambiente ou no `.env` (copie de `.env.example`).

**Armadilha do `initdb`:** os scripts de `/docker-entrypoint-initdb.d` só rodam quando o volume está vazio — depois de alterar `sql/schema.sql`, rode `docker compose down -v` antes de subir de novo, e semeie outra vez.

## 6. Como retreinar

```powershell
$env:BANCO_URL = "postgresql://postgres:postgres@127.0.0.1:55432/app_local"
Push-Location backend
uv run --extra treino python -m app.treino congelar                 # 1. snapshot + agregados, MESMA transação REPEATABLE READ
uv run --extra treino python -m app.treino treinar --versao 2.1.0   # 2. treina os 3 candidatos, escolhe, serializa, escreve o manifest
uv run --extra treino python -m app.treino verificar                # 3. retreina sobre o MESMO snapshot e compara as predições; não escreve nada
uv run --extra treino python -m app.treino.distribuicao --carregar  # 4. referência de deriva do novo snapshot
uv run --extra dev pytest -m latencia -q                            # 5. regrava artifacts/metricas/latencia.json
Pop-Location
gh release create v2.1.0 models\modelo-2.1.0.pkl (Get-Item data\processado\snapshot-*.parquet) --title "modelo 2.1.0"   # 6. .pkl e snapshot viram assets do release
```

`congelar` executa um `SELECT ... ORDER BY linha_origem` sobre `dados.registros_triagem` e grava um parquet com todos os parâmetros do writer fixos. **O `sha256` desse arquivo é o `versao_dados`** do manifest: é ele que responde "com quais dados este modelo foi treinado", e é por isso que o treino lê o snapshot, nunca o CSV. `verificar` não compara o `sha256` do `.pkl` (nunca é byte-idêntico): compara as predições sobre `backend/tests/dados_ouro/entradas.json` e as métricas com tolerância `1e-6`. Na plataforma em que o artefato foi treinado, as predições têm de bater pelo `sha256` exato; noutra, valem classes iguais e probabilidades a `0,03`, tolerância **medida** entre Windows e Linux ([ADR 0004](docs/decisoes/0004-artefato-fora-do-git.md)), porque o treino do XGBoost não é bit a bit reprodutível entre sistemas.

O mesmo fluxo roda em CI sem credencial, em [`release-modelo.yml`](.github/workflows/release-modelo.yml) (`workflow_dispatch` com a versão): sobe um Postgres, semeia, congela, treina, verifica, publica o asset e anexa o manifest produzido como artefato do run, para ser commitado.

## 7. O que este projeto corrige do modelo herdado

A auditoria do artefato legado (um `.pkl` de XGBoost, 43 features) encontrou quatro divergências entre o que a documentação dizia e o que o binário fazia — a evidência completa está em [`docs/auditoria-do-legado.md`](docs/auditoria-do-legado.md):

1. **O passo de feature engineering era uma função anônima serializada por valor** (`dill`), dependente de `__main__` e de uma versão específica de Python: intransportável. Aqui, cada passo do pipeline é nomeado e importável, e o artefato é gravado com `joblib`.
2. **Essa função referenciava nomes de coluna em inglês** num DataFrame já renomeado para português: o binning descrito na documentação **nunca aconteceu** no treino. Aqui, o binning é um parâmetro explícito, decidido por A/B com número ([ADR 0002](docs/decisoes/0002-binning-ligado-ou-desligado.md): desligado).
3. **`handle_unknown='ignore'` escondeu 17 de 43 features permanentemente zeradas em serviço**: o app enviava as 5 escalas ordinais como texto de faixa, o encoder treinado sobre inteiros não as reconhecia e devolvia zero em silêncio. Aqui, `handle_unknown='error'` com `categories=` explícito, e a exceção vira 422 nomeando campo e valor.
4. **Duas opções do formulário não existiam no domínio do encoder** (`Automóvel`, `Motocicleta` contra `Carro`, `Moto`): para quem as escolhia, 22 de 43 features iam a zero sem aviso. Aqui, o formulário nasce de `GET /metadata`, que nasce do mesmo domínio que treinou o modelo, e um teste de paridade treino ↔ serviço fecha o CI.

## 8. Cold start e hibernação do banco

**Serviço:** o backend roda em um plano gratuito que hiberna por inatividade. **A primeira chamada pode levar até 60 s enquanto o serviço acorda.** O front faz `GET /health` ao montar e mostra "Acordando o modelo…" até a resposta; o pipeline é carregado no `lifespan`, não na primeira requisição, então `/health` é honesto.

**Banco:** o Postgres do plano gratuito hiberna por inatividade. **O painel inteiro abre sem ele, e só a tela de monitoramento degrada, com aviso.** Comportamento endpoint a endpoint com o banco fora do ar:

| Endpoint | Com o banco fora | Código |
|---|---|---|
| `/painel/*`, `/registros`, `/dimensoes`, `/metadata`, `/model/*` | nada muda: servidos do parquet e dos JSON em memória | 200 |
| `POST /predicoes`, `/predicoes/lote`, `/predicoes/relatorio` | nada muda: o log é enfileirado e, se preciso, descartado e contado | 200 |
| `GET /monitoramento/deriva` | `disponivel: false` com `motivo`; o front mostra faixa de aviso, nunca tela de erro | 200 |
| `GET /health` | `banco: "indisponivel"`, `log_predicao: "degradado"`, `logs_descartados: N` | 200 |
| `GET /ready` | 200 assim que artefato e agregados carregaram — **o banco não entra** | 200 |

Duas defesas, as duas em código: o desenho estático-primeiro acima (a defesa real) e a Action semanal [`manter-banco-vivo.yml`](.github/workflows/manter-banco-vivo.yml), que roda uma consulta trivial e a retenção do log (conforto; `schedule` do GitHub atrasa sob carga e é desativado após 60 dias sem atividade).

## 9. Desempenho

Números **medidos, não prometidos** — copiados de [`artifacts/metricas/latencia.json`](artifacts/metricas/latencia.json), que é a fonte e é regravado por `uv run pytest -m latencia -q` (marcador `latencia`, fora da suíte do CI porque p95 num runner compartilhado falha por ruído de máquina, não por regressão).

| Medida | `POST /api/v1/predicoes` |
|---|---|
| p50 / p95 / p99 | 8,44 ms / 11,48 ms / 13,49 ms |
| média / máximo | 8,85 ms / 14,69 ms |
| chamadas | 200 (após 20 de aquecimento) |
| critério | p95 < 50 ms |
| modo | `TestClient` em processo, sem rede; inclui validação, pipeline e serialização |
| máquina | Intel Core i7-14700HX, Windows 11, Python 3.12.15 — medido em 2026-10-17 |

Em produção some a vantagem do processo local: rede, TLS e, no primeiro acesso, o cold start da seção 8. O simulador exibe a latência de cada resposta no rodapé do resultado (`latencia_ms`, medida no servidor).

## 10. Fonte de dados e licença

A base é o conjunto público *Estimation of Obesity Levels Based On Eating Habits and Physical Condition* (UCI Machine Learning Repository, id 544, licença **CC BY 4.0**): 2.111 registros × 17 colunas, dos quais **77 % foram gerados sinteticamente pelos próprios autores**. A citação completa, o DOI do conjunto e do artigo de origem e a licença estão em [`data/bruto/FONTE.md`](data/bruto/FONTE.md) — o único arquivo do repositório onde os nomes dos autores aparecem, por decisão de proveniência, e um portão (`scripts/verificar-proveniencia.ps1`, no pre-commit e no CI) garante que não foram copiados para nenhum outro.

As duas afirmações convivem de propósito: a interface diz que nenhum registro é de pessoa real (e nenhuma leitura epidemiológica das distribuições é válida); a documentação credita a fonte. **A proveniência acompanha o dado até dentro do banco:** o seed recusa semear se o bloco de citação estiver vazio, grava em `operacao.carga_fonte` o `sha256` do CSV e do próprio `FONTE.md`, `sql/schema.sql` carrega um `COMMENT ON TABLE` apontando para a citação, e `python -m app.dados.schema --conferir` falha se o `FONTE.md` mudou desde a semeadura. O dicionário das 17 colunas (nome no CSV, no modelo e no banco) está em [`docs/dicionario-de-dados.md`](docs/dicionario-de-dados.md).

## 11. Autoria

**Vinícius Ventura.** Código sob licença [MIT](LICENSE); dados sob CC BY 4.0, creditados em `data/bruto/FONTE.md`.

## 12. O que não está no repositório e por quê

| Ausente | Por quê | Onde está |
|---|---|---|
| `models/*.pkl` | binário opaco que muda a cada retreino; incharia o histórico ([ADR 0004](docs/decisoes/0004-artefato-fora-do-git.md)) | asset do GitHub Release `v<versao>`; `scripts/baixar_modelo.py` baixa e confere o `sha256` do manifest |
| `data/processado/` (snapshot e `base_painel.parquet`) | derivados determinísticos, regeneráveis por `python -m app.treino congelar` | descritos pelo `versao_dados` do manifest; o snapshot também é asset do release, e a imagem publicada deriva `base_painel.parquet` dele no build, sem banco |
| `.env` e qualquer DSN, senha ou chave | segredo; só `.env.example` é versionado, sem um único valor real | variáveis de ambiente do serviço e segredos do repositório |
| **Nenhum dump do banco** — nem de dados nem de schema | um dump de schema é uma segunda cópia que diverge de `sql/schema.sql` em uma semana; os dados são o CSV público mais o seed | `sql/schema.sql` é a fonte única; `python -m app.dados.schema --conferir` compara o banco com ela |
| Fotos do painel de referência | material visual do projeto herdado; nunca entram no git nem em PR | fora do repositório (`docs/design-tokens.md` registra a paleta como provisória) |

## 13. Onde está o SQL

- [`sql/schema.sql`](sql/schema.sql) — DDL único dos schemas `dados` e `operacao` (tabela de fonte, rótulos das escalas, cargas, snapshots, referências de deriva, log de predição com índices, função de retenção `operacao.manutencao_log`). Aplicado pelo `initdb` do compose e por `psql` na instância publicada; nunca pelo painel do provedor. [`sql/grants.sql`](sql/grants.sql) liga RLS sem policy em toda tabela e revoga os papéis expostos.
- [`sql/agregados/`](sql/agregados) e [`sql/pontos/`](sql/pontos) — os 7 agregados do painel e a projeção altura × peso, um arquivo por artefato, com cabeçalho `@` parseado pelo materializador. São **materializados** em `artifacts/agregados/*.json` por `python -m app.treino congelar` e conferidos contra o pandas por teste de paridade ([`docs/agregados.md`](docs/agregados.md)).
- [`sql/deriva/`](sql/deriva) — as três consultas da tela de monitoramento (distribuição numérica, contagem por faixa, PSI), lidas em runtime por `SQL_DIR` e linkadas no rodapé da própria tela.

**Nenhuma requisição de gráfico toca o banco.** `/painel/*`, `/registros` e `/dimensoes` são servidos de `base_painel.parquet` em memória, com filtros aplicados no servidor e ETag por recorte ([ADR 0005](docs/decisoes/0005-filtros-no-servidor.md), [ADR 0006](docs/decisoes/0006-agregados-em-sql.md)). Ter banco não quer dizer que o painel consulta banco.

## 14. Limitações conhecidas

- **Limitação de taxa em memória de um processo.** O serviço roda com `--workers 1`, onde a contagem do `slowapi` é exata; com N instâncias o limite efetivo vira N×. Contar no Postgres foi descartado porque colocaria uma escrita síncrona no caminho crítico da predição.
- **Triagem, não diagnóstico**, sobre uma base majoritariamente sintética: a saída ordena prioridade de atenção e nenhuma leitura epidemiológica das distribuições do painel é válida.
- **Sem autenticação, por decisão** ([ADR 0007](docs/decisoes/0007-postgres-sem-autenticacao.md)): sem login não há usuário, e sem usuário não há escrita por pessoa (marcar, anotar, favoritar) nem preferência salva. É o que fecha o escopo e o que garante que o navegador nunca fala com o banco.
- **Paleta provisória.** As fotos do painel de referência não estavam disponíveis; [`docs/design-tokens.md`](docs/design-tokens.md) registra a origem da paleta como PROVISÓRIA e os quatro arquivos que uma futura tarefa de skin pode tocar.
- **Latência medida localmente** (seção 9); o número publicado não inclui rede nem o cold start do plano gratuito.
- **Log de predição com retenção curta e sem identificador**: nenhum IP, `User-Agent` ou nome é gravado; a limitação de taxa usa um HMAC diário do IP só em memória. O simulador avisa que as entradas são registradas de forma anônima para monitoramento.

## 15. Deploy e variáveis de ambiente

Provedores e passos do autor em [ADR 0009](docs/decisoes/0009-provedor-de-hospedagem.md): backend como contêiner (`backend/Dockerfile`, contexto de build na **raiz**, `HEALTHCHECK` em `/api/v1/health`, `--workers 1`), front estático a partir de `frontend/` (`vercel.json` com rewrites de SPA, CSP e cache de `/study/`), Postgres gerenciado com pooler IPv4 na porta 6543. A imagem é autocontida: o build baixa do release o `.pkl` e o snapshot congelado, confere os dois `sha256` do manifest e deriva `base_painel.parquet` sem banco (`python -m app.treino.painel`). Nada no código depende do provedor: o backend lê só variáveis de ambiente, o front só `VITE_*`, e o SQL é aplicado por `psql` a partir dos mesmos arquivos do compose:

```powershell
# banco — uma vez, na instância publicada; $env:BANCO_URL usa o host do POOLER
psql $env:BANCO_URL -v ON_ERROR_STOP=1 -f sql\schema.sql
psql $env:BANCO_URL -v ON_ERROR_STOP=1 -f sql\grants.sql
Push-Location backend
uv run --extra treino python -m app.dados.seed --arquivo ..\data\bruto\obesity.csv --tabela dados.registros_triagem
Pop-Location
pwsh .\scripts\carregar-distribuicao-treino.ps1
```

As **22 variáveis do backend** estão em [`.env.example`](.env.example), na ordem e sem valor real. As que a instância publicada precisa definir de forma diferente do local:

| Variável | Publicado | Observação |
|---|---|---|
| `ORIGENS_CORS` | `https://<host-do-front>` | lista separada por vírgula, sem barra final |
| `BANCO_URL` | DSN do **pooler**, com a senha | único lugar da senha em todo o projeto |
| `BANCO_HABILITADO` | `true` | desligado, a API sobe e serve tudo que é estático |
| `N_MINIMO_DERIVA` | `200` | medido ([ADR 0008](docs/decisoes/0008-limiares-de-psi.md)); obrigatória com o banco ligado |
| `LIMITE_TAXA_ATIVO` / `SAL_TAXA` | `true` / sal gerado | a API recusa subir com o limitador ligado e o sal vazio |
| `EXIGIR_INTEGRIDADE` | `true` | `sha256` do artefato divergente vira 503, não aviso |

O front tem **duas** variáveis, e só estas: `VITE_API_URL` (`https://<host-da-api>/api/v1`) e `VITE_REPO_URL`. Nenhuma variável de banco tem prefixo `VITE_`, o build do front não recebe `env_file`, e `scripts/verificar-bundle.ps1` varre `dist/` depois do build (no CI e no aceite do deploy) por `supabase`, `service_role`, `postgres://`, `postgresql://` e `eyJ`. O keep-alive usa o segredo de repositório `BANCO_URL_POOLER` e as variáveis `RETENCAO_DIAS` (padrão 90) e `TETO_LINHAS_LOG` (padrão 500000).

## 16. Testes e portões

Na ordem do CI ([`ci.yml`](.github/workflows/ci.yml)): proveniência → banco → SQL → backend → front → imagem. O CI nunca aponta para a instância publicada; o Postgres é um serviço descartável do job.

```powershell
pwsh .\scripts\verificar-proveniencia.ps1          # lista negra de termos e nomes; também no pre-commit e no commit-msg
uv run --project backend --extra dev sqlfluff lint sql
Push-Location backend
uv sync --extra treino --extra dev
uv run ruff check app tests; uv run ruff format --check app tests; uv run mypy app
uv run --extra treino pytest -q --cov=app --cov-fail-under=80   # testes marcados `banco` são pulados sem BANCO_URL
uv run --extra treino python -m app.treino verificar
Pop-Location
Push-Location frontend
npx tsc --noEmit; npm run lint; npx vitest run; npm run build
npx playwright test                                 # 6 smokes; precisam do backend em 127.0.0.1:8000 e do banco do compose
Pop-Location
pwsh .\scripts\verificar-bundle.ps1                 # nenhuma credencial em frontend\dist
```

Os testes de maior valor: paridade treino ↔ serviço (a mesma entrada pelo pipeline do treino e pela API produz as mesmas probabilidades), ordem e completude das colunas, domínio fechado (os dois bugs do legado viram teste), paridade SQL × pandas dos 8 agregados, contrato OpenAPI congelado, e "o log não pode derrubar a predição" (banco morto, fila cheia, payload acima do teto).

## 17. Mapa do repositório e documentação

```
backend/      FastAPI (app/api, esquemas, dominio, nucleo, dados, treino) + tests/ + Dockerfile
frontend/     React 19 + Vite 8 + TypeScript; e2e/ com os smokes do Playwright; public/study/ gerado
sql/          schema.sql, grants.sql, agregados/, pontos/, deriva/
artifacts/    manifest.json, agregados/*.json, distribuicao_treino.json, metricas/
data/bruto/   obesity.csv + FONTE.md          data/processado/  gerado (gitignore)
study/        01_comparacao_de_modelos.ipynb (com saídas, de propósito) + README.md
tools/        nb2json.py, medir_n_minimo_deriva.py, verificar-cabecalhos-sql.py
scripts/      proveniência, bundle, baixar_modelo.py, carregar-distribuicao-treino.ps1, higiene-notebook.py
docs/         contrato da API, modelagem, dicionário, agregados, auditoria do legado, tokens, capturas, decisões/
```

| Documento | O que responde |
|---|---|
| [`docs/contrato-api.md`](docs/contrato-api.md) | endpoints, `RespostaTriagem`, envelope de erro, cabeçalhos, o que o log guarda e não guarda |
| [`docs/modelagem.md`](docs/modelagem.md) | pipeline, candidatos, critério de escolha, os dois A/B |
| [`docs/dicionario-de-dados.md`](docs/dicionario-de-dados.md) | as 17 colunas nas três convenções de nome |
| [`docs/agregados.md`](docs/agregados.md) | contrato dos agregados em SQL e a tabela de divergências |
| [`docs/auditoria-do-legado.md`](docs/auditoria-do-legado.md) | as quatro divergências do artefato herdado, com evidência |
| [`docs/design-tokens.md`](docs/design-tokens.md) · [`docs/estilo-de-codigo.md`](docs/estilo-de-codigo.md) | paleta (provisória) e convenções herdadas do legado |
| [`study/README.md`](study/README.md) | como reexecutar o notebook e o mapa célula → função do backend |

Decisões registradas (`docs/decisoes/`): [0001 nome](docs/decisoes/0001-nome-do-projeto.md) · [0002 binning desligado](docs/decisoes/0002-binning-ligado-ou-desligado.md) · [0003 IMC como feature](docs/decisoes/0003-imc-como-feature.md) · [0004 artefato fora do git](docs/decisoes/0004-artefato-fora-do-git.md) · [0005 filtros no servidor](docs/decisoes/0005-filtros-no-servidor.md) · [0006 agregados em SQL](docs/decisoes/0006-agregados-em-sql.md) · [0007 Postgres sem autenticação](docs/decisoes/0007-postgres-sem-autenticacao.md) · [0008 limiares de PSI](docs/decisoes/0008-limiares-de-psi.md) · [0009 provedor de hospedagem](docs/decisoes/0009-provedor-de-hospedagem.md).
