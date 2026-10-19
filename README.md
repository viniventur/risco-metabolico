# Triagem Metabólica

> Os dados exibidos são fictícios e servem apenas para demonstração. Nenhum registro corresponde a uma pessoa real. Esta ferramenta é de triagem e não substitui avaliação clínica.
>
> Os dados exibidos são respostas reais e anonimizadas de uma pesquisa pública de saúde dos Estados Unidos (BRFSS 2015, CDC) e servem apenas para demonstração. Nenhum registro identifica uma pessoa. Esta ferramenta é de triagem e não substitui avaliação clínica.

[![ci](https://github.com/viniventur/risco-metabolico/actions/workflows/ci.yml/badge.svg)](https://github.com/viniventur/risco-metabolico/actions/workflows/ci.yml)
[![modelo](https://img.shields.io/badge/modelo-2.0.0-blue)](https://github.com/viniventur/risco-metabolico/releases/tag/v2.0.0)
[![diabetes](https://img.shields.io/badge/diabetes-1.0.0-blue)](https://github.com/viniventur/risco-metabolico/releases/tag/diabetes-v1.0.0)
[![licença](https://img.shields.io/badge/licen%C3%A7a-MIT-green)](LICENSE)

Um microserviço de machine learning em duas vertentes, lado a lado. A de **obesidade** recebe **16 respostas** sobre medidas corporais e hábitos e devolve, em milissegundos, a **distribuição de probabilidade entre 7 faixas** de composição corporal mais um **risco metabólico acumulado**, sobre uma base pública majoritariamente sintética. A de **diabetes** recebe **10 respostas** que se sabem antes de qualquer diagnóstico e devolve a **probabilidade de já ter recebido o diagnóstico**, comparada a um **limiar de triagem**, sobre respostas reais e anonimizadas do BRFSS 2015 ([seção 18](#18-a-vertente-diabetes)) — daí as duas frases acima. Nas duas, a saída **ordena prioridade de atenção**; ela não fecha diagnóstico.

Em volta dos dois modelos: uma API FastAPI com contrato versionado; um front React com, para cada vertente, simulador, painel analítico, notebook de estudo renderizado e tela de monitoramento de deriva; um Postgres que guarda as duas bases de origem e o log de predições; e o SQL do projeto (schema, agregados do painel, consultas de deriva) versionado em `sql/`. **O diferencial não é o modelo — é o serviço em volta dele**, e a auditoria do modelo herdado que motivou cada decisão (seção 7).

## Sumário

1. [Demonstração ao vivo](#1-demonstração-ao-vivo)
2. [Capturas de tela](#2-capturas-de-tela)
3. [Métricas do modelo](#3-métricas-do-modelo)
4. [Arquitetura](#4-arquitetura)
5. [Como rodar local, sem nenhuma credencial](#5-como-rodar-local-sem-nenhuma-credencial)
6. [Como retreinar](#6-como-retreinar)
7. [O que este projeto corrige do modelo herdado](#7-o-que-este-projeto-corrige-do-modelo-herdado)
8. [Disponibilidade e o banco fora do ar](#8-disponibilidade-e-o-banco-fora-do-ar)
9. [Desempenho](#9-desempenho)
10. [Fonte de dados e licença](#10-fonte-de-dados-e-licença)
11. [Autoria](#11-autoria)
12. [O que não está no repositório e por quê](#12-o-que-não-está-no-repositório-e-por-quê)
13. [Onde está o SQL](#13-onde-está-o-sql)
14. [Limitações conhecidas](#14-limitações-conhecidas)
15. [Deploy e variáveis de ambiente](#15-deploy-e-variáveis-de-ambiente)
16. [Testes e portões](#16-testes-e-portões)
17. [Mapa do repositório e documentação](#17-mapa-do-repositório-e-documentação)
18. [A vertente diabetes](#18-a-vertente-diabetes)

## 1. Demonstração ao vivo

| O quê | Onde |
|---|---|
| Front (painel, simulador, estudos, monitoramento) | <https://triagem-metabolica.viniciusventura.com.br> |
| Documentação interativa da API (`/docs`) | <https://triagem-metabolica.viniciusventura.com.br/docs> |
| Vivacidade da API (`/api/v1/health`) | <https://triagem-metabolica.viniciusventura.com.br/api/v1/health> |

Hospedado na VPS do autor, em contêineres, sem hibernação (seção 8 e [ADR 0009](docs/decisoes/0009-provedor-de-hospedagem.md)).

## 2. Capturas de tela

**Visão Geral** — contada em três partes (quem está no recorte, o que anda junto com a obesidade, o corpo): o recorte em destaque, excesso de peso e obesidade comparados com a base, os 7 níveis na cor da família com o degradê do grau, a pirâmide de níveis por gênero e os fatores associados (histórico familiar, alimentação, atividade, transporte, água e álcool). Os 6 filtros ficam em dropdowns numa faixa presa ao topo, e clicar numa barra filtra igual — os dois pela URL (o filtro aparece como chip no cabeçalho); `Esc` limpa, voltar desfaz, e todo gráfico tem a tabela equivalente. O levantamento de storytelling e de novas análises está em [`docs/visao-geral-storytelling.md`](docs/visao-geral-storytelling.md).

![Visão Geral do painel](docs/capturas/painel.png)

**Simulador de triagem** — o formulário nasce de `GET /metadata`, em três seções, com o aviso de registro anônimo no topo e o botão sempre visível; o resultado fica fixo ao lado e traz a classe estimada, o risco acumulado, o IMC, as 7 probabilidades em ordem clínica e o relatório para baixar ou imprimir.

Tema claro e escuro, barra lateral recolhível e gaveta no celular. O desenho (shadcn/ui sobre Radix, Tailwind v4, tokens HSL) e o diagnóstico que o motivou estão em [`docs/redesenho-front.md`](docs/redesenho-front.md) e na [ADR 0010](docs/decisoes/0010-redesenho-do-front.md); a identidade visual é a da **marca Visor** — o símbolo de uma balança cujo visor é uma fita métrica, tinta e papel, o magenta só no resultado da previsão, Source Serif 4 em tudo, favicon e manifesto — ([ADR 0011](docs/decisoes/0011-marca-visor.md)). As capturas abaixo são de antes da marca.

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

    subgraph web["nginx na VPS — mesma origem do front"]
        D["dist/ + public/study/*.json<br/>proxy de /api/ e /docs para a API"]
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

    subgraph pg["Postgres em contêiner (VPS e local) — só na rede interna"]
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
# A vertente diabetes (seção 18): a base, o snapshot, os agregados com a base do painel e a referência de deriva
uv run --extra treino python -m app.diabetes.dados.seed
uv run --extra treino python -m app.diabetes.dados.schema --conferir
uv run --extra treino python -m app.diabetes.treino snapshot
uv run --extra treino python -m app.diabetes.treino.agregar             # gera data/processado/diabetes/base_painel.parquet
uv run --extra treino python -m app.diabetes.treino.distribuicao --carregar
Pop-Location

# 3. O artefato de modelo de cada vertente: baixa o .pkl do release do manifest e confere o sha256
python scripts\baixar_modelo.py --manifesto artifacts\manifest.json --destino models            # release v<versao>
python scripts\baixar_modelo.py --manifesto artifacts\diabetes\manifest.json --destino models   # release diabetes-v<versao>

# 4. A mesma stack da VPS: banco, API, nginx com o front e a retenção do log
docker compose up -d --build        # site em http://127.0.0.1:8080 (nginx) e a API em http://127.0.0.1:8000/docs
bash scripts/verificar-stack.sh     # o mesmo aceite do CI: 60 verificações, por dentro e por fora (no Git Bash do Windows, com MSYS_NO_PATHCONV=1)

# 5. Front em modo de desenvolvimento
Push-Location frontend
npm ci
npm run dev                         # http://localhost:5173 — fala com http://127.0.0.1:8000/api/v1 por padrão
Pop-Location
```

No compose, a API entra no banco com o papel `triagem_api`, de menor privilégio (`sql/usuario-api.sh`); os comandos de CLI acima usam o dono `postgres`, local e descartável. Para rodar a API fora do contêiner (depuração), de `backend/`: `uv run uvicorn app.main:app --host 127.0.0.1 --port 8000` com `BANCO_URL` acima, `BANCO_HABILITADO=true`, `N_MINIMO_DERIVA=200`, `N_MINIMO_DERIVA_DIABETES=300` e `LIMITE_TAXA_ATIVO=false` no ambiente ou no `.env` (copie de `.env.example`). A da vertente diabetes é opcional: sem ela, só a deriva dessa vertente fica indisponível.

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

## 8. Disponibilidade e o banco fora do ar

**Serviço:** backend, front e banco rodam em contêineres na VPS do autor, sempre ligados; não há plano gratuito hibernando. O plano previa uma nota de *cold start* "se o provedor hibernar" — não se aplica. O front ainda faz `GET /health` ao montar e, se a API demora, mostra "Acordando o modelo…" num selo da barra do topo, o que cobre um deploy ou um reinício; o pipeline é carregado no `lifespan`, não na primeira requisição, então `/health` é honesto.

**Banco:** o produto foi desenhado para um Postgres que pausava por inatividade, e o desenho ficou: **o painel inteiro abre sem o banco, e só as telas de monitoramento degradam, com aviso.** Hoje isso cobre um deploy, um reinício ou uma falha do contêiner. Comportamento endpoint a endpoint com o banco fora do ar (as rotas de `/diabetes` se comportam como as suas equivalentes):

| Endpoint | Com o banco fora | Código |
|---|---|---|
| `/painel/*`, `/registros`, `/dimensoes`, `/metadata`, `/model/*` | nada muda: servidos do parquet e dos JSON em memória | 200 |
| `POST /predicoes`, `/predicoes/lote`, `/predicoes/relatorio` | nada muda: o log é enfileirado e, se preciso, descartado e contado | 200 |
| `GET /monitoramento/deriva` | `disponivel: false` com `motivo`; o front mostra faixa de aviso, nunca tela de erro | 200 |
| `GET /health` | `banco: "indisponivel"`, `log_predicao: "degradado"`, `logs_descartados: N` | 200 |
| `GET /ready` | 200 assim que os artefatos e as bases do painel das duas vertentes carregaram — **o banco não entra** | 200 |

A retenção do log de predição (`operacao.manutencao_log`, 90 dias e um teto de linhas) roda no serviço `retencao-log` do compose, ao lado do banco, ao subir e a cada 7 dias — o Postgres não publica porta nenhuma, nem na VPS nem localmente, então nada de fora precisa alcançá-lo.

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

Em produção some a vantagem do processo local: rede, TLS e o proxy do nginx. O simulador exibe a latência de cada resposta no rodapé do resultado (`latencia_ms`, medida no servidor).

## 10. Fonte de dados e licença

A base da vertente de obesidade é o conjunto público *Estimation of Obesity Levels Based On Eating Habits and Physical Condition* (UCI Machine Learning Repository, id 544, licença **CC BY 4.0**): 2.111 registros × 17 colunas, dos quais **77 % foram gerados sinteticamente pelos próprios autores**. A citação completa, o DOI do conjunto e do artigo de origem e a licença estão em [`data/bruto/FONTE.md`](data/bruto/FONTE.md) — o único arquivo do repositório onde os nomes dos autores aparecem, por decisão de proveniência, e um portão (`scripts/verificar-proveniencia.ps1`, no pre-commit e no CI) garante que não foram copiados para nenhum outro.

As duas afirmações convivem de propósito: a interface diz que nenhum registro é de pessoa real (e nenhuma leitura epidemiológica das distribuições é válida); a documentação credita a fonte. **A proveniência acompanha o dado até dentro do banco:** o seed recusa semear se o bloco de citação estiver vazio, grava em `operacao.carga_fonte` o `sha256` do CSV e do próprio `FONTE.md`, `sql/schema.sql` carrega um `COMMENT ON TABLE` apontando para a citação, e `python -m app.dados.schema --conferir` falha se o `FONTE.md` mudou desde a semeadura. O dicionário das 17 colunas (nome no CSV, no modelo e no banco) está em [`docs/dicionario-de-dados.md`](docs/dicionario-de-dados.md).

A base da vertente diabetes, de respostas reais e anonimizadas do BRFSS 2015 sob licença CC0 1.0, tem o seu `FONTE.md`, com o mesmo portão, e o seu dicionário ([seção 18](#18-a-vertente-diabetes)).

## 11. Autoria

**Vinícius Ventura.** Código sob licença [MIT](LICENSE). Os dados têm licença própria, registrada também no `LICENSE`: CC BY 4.0 na vertente de obesidade, creditada em `data/bruto/FONTE.md`, e CC0 1.0 na de diabetes, creditada em `data/bruto/diabetes/FONTE.md`.

No front, os créditos ("Desenvolvido por", com a marca do autor e o link para [viniciusventura.com.br](https://viniciusventura.com.br)) ficam no pé do menu lateral, no fim do Início, na Política de Privacidade e no 404 (`frontend/src/shared/autor`). A **Política de Privacidade** fica em `/privacidade`, com link no rodapé de toda tela: o texto mora em `frontend/src/features/legal/politica-privacidade.md` e os dados do responsável e os prazos (retenção do log, rodízio dos registros técnicos, janela do limite) em `responsavel.ts` — mudou um prazo na infraestrutura, muda lá.

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
- **Capturas anteriores à marca.** As duas imagens de `docs/capturas/` são do redesenho da ADR 0010, com a paleta azul; a marca Visor (ADR 0011) chegou depois e elas ainda não foram refeitas.
- **Latência medida localmente** (seção 9); o número publicado não inclui rede, TLS nem o proxy.
- **Log de predição com retenção curta e sem identificador**: nenhum IP, `User-Agent` ou nome é gravado; a limitação de taxa usa um HMAC diário do IP só em memória. O simulador avisa que as entradas são registradas de forma anônima para monitoramento.

## 15. Deploy e variáveis de ambiente

Hospedagem na **VPS do autor**, decidida em [ADR 0009](docs/decisoes/0009-provedor-de-hospedagem.md) e descrita passo a passo em [`docs/deploy-vps.md`](docs/deploy-vps.md). Três imagens, montadas e testadas pelo CI e publicadas no GitHub Container Registry presas pelo digest:

- **`risco-metabolico-api`** (`backend/Dockerfile`, contexto na raiz): autocontida — o build baixa do release o `.pkl` e o snapshot congelado, confere os dois `sha256` do manifest e deriva `base_painel.parquet` sem banco (`python -m app.treino.painel`). A vertente diabetes faz o mesmo, do release `diabetes-v<versao>` do manifest dela (`python -m app.diabetes.treino.painel`). Usuário sem root, sistema de arquivos só de leitura, `HEALTHCHECK` em `/api/v1/health`, `--workers 1`.
- **`risco-metabolico-web`** (`frontend/Dockerfile`): o build do Vite servido por nginx sem root, que faz proxy de `/api/`, `/docs` e `/openapi.json` para a API. **Front e API na mesma origem**: `VITE_API_URL=/api/v1`, sem CORS em produção; CSP, HSTS e os demais cabeçalhos em `frontend/seguranca.conf`; limite de consultas respondendo no envelope de erro da API.
- **`risco-metabolico-banco`** (`database/Dockerfile`): `postgres:16-alpine` com `sql/schema.sql`, `sql/grants.sql` e `sql/usuario-api.sh` dentro, aplicados pelo `initdb` e reaplicados a cada deploy. Só na rede interna; a API entra com o papel `triagem_api`.

O deploy é o job `deploy` do CI, no ambiente `producao` do GitHub (só a `main`): SSH para a VPS com uma chave presa a `scripts/deploy.sh`, que confere cada variável recebida pelo stdin, baixa as imagens, reaplica schema, grants e papel, semeia as duas bases (idempotente), carrega as referências de deriva das duas vertentes, sobe tudo, confere `/api/v1/health` e `/api/v1/ready` pelo nginx e volta sozinho para a versão anterior se algo falhar. Na VPS não há código-fonte. O Caddy faz o HTTPS e entrega para `127.0.0.1:WEB_HOST_PORT`.

As **22 variáveis do backend**, mais a da vertente diabetes, estão em [`.env.example`](.env.example), na ordem e sem valor real, seguidas das variáveis do compose. O que a produção fixa, pelo `deploy.sh` e pelo `docker-compose.yml`:

| Variável | Publicado | Observação |
|---|---|---|
| `ORIGENS_CORS` | `https://<dominio>` (a própria origem) | só importa para chamadas de fora e para o preflight do aceite |
| `BANCO_URL` | `postgresql://triagem_api:…@banco:5432/app_local` | papel de menor privilégio; o dono só semeia, congela e faz a retenção |
| `BANCO_HABILITADO` | `true` | desligado, a API sobe e serve tudo que é estático |
| `N_MINIMO_DERIVA` | `200` | medido ([ADR 0008](docs/decisoes/0008-limiares-de-psi.md)); obrigatória com o banco ligado |
| `N_MINIMO_DERIVA_DIABETES` | `300` | medido ([ADR 0014](docs/decisoes/0014-limiar-deriva-e-reprodutibilidade.md)); opcional: sem ela, só a deriva da vertente diabetes fica indisponível |
| `LIMITE_TAXA_ATIVO` / `SAL_TAXA` | `true` / sal gerado | a API recusa subir com o limitador ligado e o sal vazio |
| `EXIGIR_INTEGRIDADE` | `true` | `sha256` do artefato divergente vira 503, não aviso |

Segredos do ambiente `producao`: `POSTGRES_PASSWORD`, `API_DB_PASSWORD`, `SAL_TAXA`, `VPS_SSH_KEY`, `VPS_KNOWN_HOSTS`. Variáveis do repositório: `VPS_HOST` (liga o deploy), `VPS_USER`, `SITE_URL` (liga o aceite externo), `WEB_HOST_PORT`, `RETENCAO_DIAS` (90) e `TETO_LINHAS_LOG` (500000 até a medição de §6.8.6).

O front tem **duas** variáveis, e só estas: `VITE_API_URL` e `VITE_REPO_URL`. Nenhuma variável de banco tem prefixo `VITE_`, o build do front não recebe `env_file`, e `scripts/verificar-bundle.ps1` varre `dist/` depois do build por `supabase`, `service_role`, `postgres://`, `postgresql://` e JWT — no CI, e `scripts/verificar-producao.sh` repete a varredura no bundle servido, depois de cada deploy.

## 16. Testes e portões

Na ordem do CI ([`ci.yml`](.github/workflows/ci.yml)): proveniência → banco → SQL → backend → front → ambiente completo em Docker (`scripts/verificar-stack.sh`) → publicação das imagens → deploy → aceite visto de fora (`scripts/verificar-producao.sh`). O CI nunca aponta para a instância publicada; o Postgres é um serviço descartável do job.

```powershell
pwsh .\scripts\verificar-proveniencia.ps1          # lista negra de termos e nomes; também no pre-commit e no commit-msg
uv run --project backend --extra dev sqlfluff lint sql
Push-Location backend
uv sync --extra treino --extra dev
uv run ruff check app tests; uv run ruff format --check app tests; uv run mypy app
uv run --extra treino pytest -q --cov=app --cov-fail-under=80   # testes marcados `banco` são pulados sem BANCO_URL
uv run --extra treino python -m app.treino verificar
uv run --extra treino python -m app.diabetes.treino verificar   # o modelo da vertente diabetes (ADR 0014)
Pop-Location
Push-Location frontend
npx tsc --noEmit; npm run lint; npx vitest run; npm run build
npx playwright test                                 # os smokes, um arquivo por tela e e2e/diabetes.spec.ts para as quatro da vertente; precisam do backend em 127.0.0.1:8000 e do banco do compose
Pop-Location
pwsh .\scripts\verificar-bundle.ps1                 # nenhuma credencial em frontend\dist
docker compose up -d --build; bash scripts\verificar-stack.sh    # a stack inteira: containers, papel da API, nginx, cabeçalhos, limite
```

Os testes de maior valor: paridade treino ↔ serviço (a mesma entrada pelo pipeline do treino e pela API produz as mesmas probabilidades), ordem e completude das colunas, domínio fechado (os dois bugs do legado viram teste), paridade SQL × pandas dos 8 agregados da obesidade e dos 5 da vertente diabetes, contrato OpenAPI congelado, e "o log não pode derrubar a predição" (banco morto, fila cheia, payload acima do teto).

## 17. Mapa do repositório e documentação

```
backend/      FastAPI (app/api, esquemas, dominio, nucleo, dados, treino) + tests/ + Dockerfile (imagem api);
              app/diabetes/ e tests/diabetes/: a vertente diabetes, no mesmo desenho
frontend/     React 19 + Vite 8 + TypeScript + Tailwind v4 + shadcn/ui (Radix); e2e/ com os smokes do
              Playwright; public/study/ gerado; public/tema-inicial.js (tema antes da hidratação);
              Dockerfile + nginx.conf + seguranca.conf (imagem web); src/features/diabetes/ (/diabetes/*)
database/     Dockerfile da imagem do banco (postgres + sql/)
sql/          schema.sql, grants.sql, usuario-api.sh, agregados/, pontos/, deriva/, diabetes/{agregados,deriva}/
artifacts/    manifest.json, agregados/*.json, distribuicao_treino.json, metricas/; diabetes/ (os da vertente)
data/bruto/   obesity.csv + FONTE.md; diabetes/ (CSV + FONTE.md)       data/processado/  gerado (gitignore)
study/        01_comparacao_de_modelos.ipynb e 02_triagem_de_diabetes.ipynb (com saídas, de propósito) + README.md
tools/        nb2json.py, medir_n_minimo_deriva.py, medir_reprodutibilidade_diabetes.py, verificar-cabecalhos-sql.py
scripts/      proveniência, bundle, baixar_modelo.py, carregar-distribuicao-treino.ps1, higiene-notebook.py,
              deploy.sh, pacote.Dockerfile, verificar-stack.sh, verificar-producao.sh
docker-compose.yml (local, monta as imagens) · docker-compose.producao.yml (VPS, imagens por digest)
docs/         contrato da API, modelagem, dicionário, agregados, auditoria do legado, tokens, capturas,
              deploy-vps.md, decisões/; modelagem e dicionário da vertente diabetes
```

| Documento | O que responde |
|---|---|
| [`docs/contrato-api.md`](docs/contrato-api.md) | endpoints, `RespostaTriagem`, envelope de erro, cabeçalhos, o que o log guarda e não guarda; as 12 rotas de `/diabetes` e `RespostaDiabetes` |
| [`docs/modelagem.md`](docs/modelagem.md) | pipeline, candidatos, critério de escolha, os dois A/B |
| [`docs/modelagem-diabetes.md`](docs/modelagem-diabetes.md) | a vertente diabetes: entradas, baselines e candidatos, desbalanceamento, calibração, limiar, avaliação e limitações |
| [`docs/dicionario-de-dados.md`](docs/dicionario-de-dados.md) | as 17 colunas nas três convenções de nome |
| [`docs/dicionario-de-dados-diabetes.md`](docs/dicionario-de-dados-diabetes.md) | as 22 colunas da vertente diabetes, com a variável do BRFSS 2015 de cada uma |
| [`docs/agregados.md`](docs/agregados.md) | contrato dos agregados em SQL e a tabela de divergências; os 5 da vertente diabetes e a paridade deles |
| [`docs/auditoria-do-legado.md`](docs/auditoria-do-legado.md) | as quatro divergências do artefato herdado, com evidência |
| [`docs/design-tokens.md`](docs/design-tokens.md) · [`docs/estilo-de-codigo.md`](docs/estilo-de-codigo.md) | tokens claro/escuro, rampas dos gráficos, tipografia e grade; convenções herdadas do legado |
| [`docs/redesenho-front.md`](docs/redesenho-front.md) | a auditoria medida do front anterior (defeito a defeito, com número) e a especificação do redesenho |
| [`study/README.md`](study/README.md) | como reexecutar os dois notebooks e o mapa célula → função do backend de cada um |
| [`docs/deploy-vps.md`](docs/deploy-vps.md) | como a VPS é publicada: chave presa ao `deploy.sh`, segredos, Caddy, aceite; o que a vertente diabetes muda no deploy |

Decisões registradas (`docs/decisoes/`): [0001 nome](docs/decisoes/0001-nome-do-projeto.md) · [0002 binning desligado](docs/decisoes/0002-binning-ligado-ou-desligado.md) · [0003 IMC como feature](docs/decisoes/0003-imc-como-feature.md) · [0004 artefato fora do git](docs/decisoes/0004-artefato-fora-do-git.md) · [0005 filtros no servidor](docs/decisoes/0005-filtros-no-servidor.md) · [0006 agregados em SQL](docs/decisoes/0006-agregados-em-sql.md) · [0007 Postgres sem autenticação](docs/decisoes/0007-postgres-sem-autenticacao.md) · [0008 limiares de PSI](docs/decisoes/0008-limiares-de-psi.md) · [0009 provedor de hospedagem](docs/decisoes/0009-provedor-de-hospedagem.md) · [0010 redesenho do front](docs/decisoes/0010-redesenho-do-front.md) · [0011 marca Visor](docs/decisoes/0011-marca-visor.md) · [0012 Visão Geral como história](docs/decisoes/0012-visao-geral-como-historia.md) · [0013 segunda vertente](docs/decisoes/0013-segunda-vertente.md) · [0014 limiar, deriva e reprodutibilidade da vertente diabetes](docs/decisoes/0014-limiar-deriva-e-reprodutibilidade.md).

## 18. A vertente diabetes

Uma segunda triagem, **paralela** à de obesidade e sem tocá-la ([ADR 0013](docs/decisoes/0013-segunda-vertente.md)). Ela parte de dez respostas que uma pessoa sabe **antes** de qualquer diagnóstico:

- faixa etária e sexo;
- IMC;
- se já ouviu de um profissional de saúde que tem pressão alta ou colesterol alto;
- se fumou 100 cigarros na vida;
- se fez atividade física nos últimos 30 dias;
- se come fruta e verdura todo dia;
- escolaridade.

Com elas, estima a **probabilidade de essa pessoa já ter ouvido que tem diabetes**. Se a probabilidade fica no **limiar de triagem** ou acima dele, a classificação é "Risco elevado", e a triagem sugere o exame de glicemia.

A base é real: respostas anonimizadas do BRFSS 2015, a pesquisa telefônica de fatores de risco do CDC dos Estados Unidos. O alvo da obesidade é quase uma faixa de IMC, com altura e peso entre as entradas ([ADR 0003](docs/decisoes/0003-imc-como-feature.md)). O da diabetes não se calcula a partir das entradas, é caro de obter na hora da triagem e vem de dados reais. As duas vertentes convivem, e a junção das previsões fica para depois, com o autor.

### Métricas

Como na seção 3, nenhuma é escrita à mão. O treino grava em `artifacts/diabetes/manifest.json` as métricas da validação cruzada, o limiar com o critério e as do teste. A API as serve em `GET /api/v1/diabetes/model/info`, e a seção "Triagem de diabetes" do Início lê dali.

```powershell
Invoke-RestMethod http://127.0.0.1:8000/api/v1/diabetes/model/info | Select-Object -ExpandProperty metricas_teste
# campos: roc_auc, pr_auc, brier, brier_da_prevalencia, recall_na_precisao_fixa e recall, precisão,
# especificidade e encaminhados no limiar — medidos uma vez, no teste (20 %, estratificado)
```

O critério de cada escolha está em [`docs/modelagem-diabetes.md`](docs/modelagem-diabetes.md): as entradas, o modelo contra três baselines, a recusa do SMOTE e da calibração e o limiar.

### Telas e API

**No front**, o grupo "Diabetes" do menu tem a Visão Geral (`/diabetes`), a Consulta (`/diabetes/consulta`), o Simulador (`/diabetes/simulador`) e o Monitoramento (`/diabetes/monitoramento`). Há também a seção "Triagem de diabetes" no Início e o notebook em `/estudos/triagem-de-diabetes`. O rodapé escolhe a frase de dados pela rota:

- as telas da vertente mostram a das respostas reais;
- as da obesidade, a dos dados fictícios;
- Início, Estudos e Privacidade, as duas.

**Na API**, são 12 rotas sob `/api/v1/diabetes` ([`docs/contrato-api.md`](docs/contrato-api.md#vertente-diabetes)): a predição (individual, em lote e o relatório), o formulário, o modelo, o painel, a Consulta com a exportação em CSV e a deriva. Como na obesidade, só a deriva lê o banco; o resto é servido de memória.

### Como rodar e retreinar

O passo a passo da seção 5 já sobe a vertente. Para treinar um modelo novo dela:

```powershell
$env:BANCO_URL = "postgresql://postgres:postgres@127.0.0.1:55432/app_local"
Push-Location backend
uv run --extra treino python -m app.diabetes.treino snapshot                  # 1. congela dados.registros_diabetes; o sha256 vira versao_dados
uv run --extra treino python -m app.diabetes.treino.agregar                   # 2. agregados SQL + data/processado/diabetes/base_painel.parquet
uv run --extra treino python -m app.diabetes.treino treinar --versao 1.1.0    # 3. a configuração do notebook 02 (célula 38): limiar, métricas, manifest
uv run --extra treino python -m app.diabetes.treino verificar                 # 4. retreina sobre o MESMO snapshot e compara; não escreve nada
uv run --extra treino python -m app.diabetes.treino.distribuicao --escrever   # 5. o perfil de deriva do snapshot, com a versão nova
uv run --extra treino python -m app.diabetes.treino.distribuicao --carregar   #    e a referência no banco
Pop-Location
gh release create diabetes-v1.1.0 models\modelo-diabetes-1.1.0.pkl (Get-Item data\processado\diabetes\snapshot-*.parquet) --title "modelo de diabetes 1.1.0" --latest=false   # 6. o release da vertente
```

`--latest=false` mantém o release da obesidade como o mais recente. Um modelo novo pede também a remedição de `N_MINIMO_DERIVA_DIABETES` (`tools/medir_n_minimo_deriva.py --vertente diabetes`): o registro guarda a versão do modelo e a dos dados, e um teste confere os dois contra o manifest.

### Limiar, deriva e reprodutibilidade

O que está na [ADR 0014](docs/decisoes/0014-limiar-deriva-e-reprodutibilidade.md):

- **O limiar** é o maior com recall ≥ 0,80 nas predições fora da dobra do treino.
- **A deriva** da vertente lê só as linhas `/diabetes/...` do log e compara o IMC arredondado, como o modelo o vê. Ela pede `N_MINIMO_DERIVA_DIABETES` respostas, um mínimo medido.
- **O `verificar`** exige o sha256 exato das predições de ouro na plataforma do treino. Noutra, exige a mesma classificação e tolerâncias medidas: o XGBoost não dá o mesmo modelo em Windows e em Linux.

### Onde está o SQL

- `sql/schema.sql` tem a seção da vertente: `dados.registros_diabetes`, as referências `operacao.diabetes_*` e a view e a série da consolidação dela.
- `sql/diabetes/agregados/` tem os 5 agregados da Visão Geral, com paridade SQL × pandas ([`docs/agregados.md`](docs/agregados.md#vertente-diabetes)).
- `sql/diabetes/deriva/` tem as 3 consultas da tela de monitoramento da vertente.

### Fonte e licença

O conjunto é o *CDC Diabetes Health Indicators* (UCI Machine Learning Repository, id 891, DOI `10.24432/C53919`), cópia do BRFSS 2015 do CDC, com licença **CC0 1.0** no conjunto de origem.

- [`data/bruto/diabetes/FONTE.md`](data/bruto/diabetes/FONTE.md) traz a citação, a ficha e as quatro afirmações da página que o arquivo desmente. A principal: o alvo **não** inclui o pré-diabetes.
- A proveniência acompanha o dado até o banco, como na outra base: o hash do CSV e do `FONTE.md` em `operacao.carga_fonte`, o `COMMENT ON TABLE` e `python -m app.diabetes.dados.schema --conferir`.
- As 22 colunas, com a variável do BRFSS de cada uma, estão em [`docs/dicionario-de-dados-diabetes.md`](docs/dicionario-de-dados-diabetes.md).

### Limitações

- **Autodeclarado e transversal.** Diagnósticos, hábitos e o próprio IMC são o que a pessoa respondeu ao telefone, num momento só. É associação, não causa: quem já tem o diagnóstico pode ter mudado os hábitos depois dele.
- **O alvo é o diagnóstico recebido.** Quem tem diabetes e não sabe responde "não". O pré-diabetes também fica no "não", e a pergunta não separa o tipo 1 do tipo 2.
- **Escala da base, não da população.** Sem pesos amostrais e só com casos completos, a probabilidade e a prevalência do painel valem para quem respondeu à pesquisa. Não valem para a população dos Estados Unidos, nem para a do Brasil, e nenhuma validação externa foi feita.
- **Um limiar para todas as idades.** Entre os mais jovens quase ninguém passa do limiar; entre os mais velhos, a maioria passa (`artifacts/diabetes/metricas/por-grupo.json`). Um limiar por faixa etária seria uma decisão de política de triagem.
- **O que este README ainda não tem da vertente:** medição de latência própria e capturas de tela.
