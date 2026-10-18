# ADR 0009 — Hospedagem: VPS do autor, imagens do CI e deploy por SSH preso ao script

**Data:** 2026-10-18 (proposta em 2026-10-17, decidida pelo autor em 2026-10-18) · **Estado:** aceita · **Fase:** F17

## Contexto

O plano deixa o provedor do backend como **A DEFINIR NA EXECUÇÃO** (§11.1) e dá o critério: se o
serviço não pode hibernar, escolher o que mantém o contêiner acordado. A primeira versão desta ADR
(2026-10-17) propunha três serviços gratuitos — contêiner com hibernação para a API, hospedagem
estática para o front e um Postgres gerenciado com pausa por inatividade — e o código foi escrito
para sobreviver a isso (desenho estático-primeiro, aviso de *cold start*, keep-alive semanal).

Em 2026-10-18 o autor decidiu publicar **na própria VPS**, com o mesmo modelo de outro projeto seu:
nenhum código-fonte no servidor, imagens montadas e testadas pelo CI, deploy automático a partir da
`main` por uma chave SSH que só consegue rodar o script de deploy, Caddy na frente com HTTPS e
um arquivo por site. Esta ADR registra o modelo e o que ele muda em relação ao plano.

## Decisão

| Peça | Como fica |
|---|---|
| **API** | Imagem `risco-metabolico-api` (`backend/Dockerfile`, contexto na raiz), **autocontida**: o `.pkl` e o snapshot congelado vêm do release `v<versao>` com `sha256` conferido, `base_painel.parquet` é derivado no build (`python -m app.treino.painel`), e `data/bruto/` (CSV + `FONTE.md`) entra para o seed rodar na VPS. Usuário sem root, sistema de arquivos só de leitura, sem capabilities. |
| **Front** | Imagem `risco-metabolico-web` (`frontend/Dockerfile`): build do Vite servido por nginx sem root, que faz proxy de `/api/`, `/docs` e `/openapi.json` para a API. **Front e API na mesma origem**: `VITE_API_URL=/api/v1` e nenhum CORS em produção. A política de cabeçalhos que vivia em `vercel.json` passou para `frontend/seguranca.conf`; o limite de consultas do nginx responde no envelope de erro da própria API. |
| **Banco** | Imagem `risco-metabolico-banco` (`database/Dockerfile`): `postgres:16-alpine` com `sql/schema.sql`, `sql/grants.sql` e `sql/usuario-api.sh` dentro, aplicados pelo `initdb` na primeira subida e reaplicados a cada deploy (idempotentes). A API entra com o papel **`triagem_api`**, de menor privilégio: `NOSUPERUSER`, `SELECT` nos dois schemas, `INSERT` só em `operacao.log_predicao`, e `BYPASSRLS` porque `grants.sql` força RLS sem policy (ADR 0007). Nunca publica porta: só a rede interna do compose. |
| **Retenção do log** | Serviço `retencao-log` (mesma imagem do banco), que chama `operacao.manutencao_log(RETENCAO_DIAS, TETO_LINHAS_LOG)` ao subir e a cada 7 dias, com o dono do banco. Substitui a Action `manter-banco-vivo.yml`: na VPS o Postgres não pausa nem é alcançável de fora. |
| **Registro** | GitHub Container Registry, imagens presas pelo **digest**; mais um "pacote de deploy" (`scripts/pacote.Dockerfile`: os dois compose e o `deploy.sh`). O job `ambiente` do CI monta as imagens, sobe tudo, roda `scripts/verificar-stack.sh` e só então publica — as MESMAS imagens que passaram. |
| **Deploy** | Job `deploy` do CI (ambiente `producao` do GitHub, só `main`): SSH com uma chave presa ao `scripts/deploy.sh` por `command=`/`restrict` no `authorized_keys`; o `.env`, os digests e uma autorização de leitura do registro que vence com o job vão pelo stdin. O `deploy.sh` confere cada variável, baixa as imagens, reaplica schema/grants/papel, acerta a senha do dono, semeia (idempotente), carrega a referência de deriva, sobe, confere `/api/v1/health` e `/api/v1/ready` pelo nginx e **volta sozinho** para a versão anterior se falhar. |
| **VPS** | Usuário `deploy` no grupo `docker`, Caddy com HTTPS automático e um arquivo por site em `/etc/caddy/sites/`; só `127.0.0.1:WEB_HOST_PORT` é publicado, para o Caddy. Na VPS existem apenas `~/risco-metabolico/{deploy.sh, docker-compose.yml, docker-compose.producao.yml, .env, .anterior/}`, as imagens e o volume do banco. |
| **Aceite** | `scripts/verificar-stack.sh` (CI, antes de publicar: containers, papel da API, telas, API na mesma origem, cabeçalhos, limite, logs) e `scripts/verificar-producao.sh` (depois de cada deploy, visto de fora: HTTPS, HSTS, health/ready, preflight CORS da própria origem, bundle sem credencial, portas internas fechadas). Passo a passo em `docs/deploy-vps.md`. |

## O que muda em relação ao plano e às ADRs anteriores

- **Sem hibernação.** O backend e o banco ficam de pé; a nota de *cold start* do README deixa de
  valer e o aviso "Acordando o modelo…" do front fica como estado de carregamento de um reinício
  ou deploy. O desenho estático-primeiro (§4.3.8) continua — agora cobre deploy, reinício e falha
  do banco, não a pausa de um plano gratuito.
- **Sem CORS em produção.** `ORIGENS_CORS` recebe a URL do site mesmo assim: é o que o preflight do
  aceite de F17 confere e o que vale para quem chamar a API de outra origem.
- **Sem keep-alive, sem pooler, sem `anon`/`authenticated`.** `manter-banco-vivo.yml` e o segredo
  `BANCO_URL_POOLER` saem; `RETENCAO_DIAS` e `TETO_LINHAS_LOG` continuam variáveis do repositório,
  entregues ao `.env` da VPS pelo deploy. O bloco condicional de `grants.sql` para os papéis do
  provedor gerenciado simplesmente não roda (eles não existem), e o `statement_cache_size=0` do
  pool continua: não custa nada e evita a surpresa se um dia houver um pooler na frente.
- **Papel da API separado do dono.** O plano falava em "papel de serviço com BYPASSRLS" (ADR 0007);
  agora ele tem nome, script idempotente e 12 verificações no CI (`verificar-stack.sh`).
- **`frontend/vercel.json` removido.** Rewrites de SPA, CSP e cache de `/study/` vivem em
  `frontend/nginx.conf` e `frontend/seguranca.conf`.
- **ADR 0007:** a tabela "a conferir no painel do provedor" vira "conferido na VPS".

## Consequências

- As 22 variáveis do backend (§11.3) não mudam. Em produção o `deploy.sh` fixa
  `EXIGIR_INTEGRIDADE=true`, `LIMITE_TAXA_ATIVO=true` e `LOG_PREDICAO_HABILITADO=true`; a DSN da
  API usa `triagem_api`, nunca o dono; `N_MINIMO_DERIVA=200` (ADR 0008) está no compose.
- Secrets do ambiente `producao`: `POSTGRES_PASSWORD`, `API_DB_PASSWORD`, `SAL_TAXA`,
  `VPS_SSH_KEY`, `VPS_KNOWN_HOSTS`. Variáveis do repositório: `VPS_HOST` (liga o deploy),
  `VPS_USER`, `SITE_URL` (liga o aceite externo), `WEB_HOST_PORT`, `RETENCAO_DIAS`,
  `TETO_LINHAS_LOG`.
- O repositório é público, as imagens no registro ficam privadas e a VPS as baixa com o token do
  próprio job. Quem entrar na conta do GitHub do autor consegue publicar no servidor: verificação
  em duas etapas na conta e ambiente `producao` restrito à `main` fazem parte da decisão.
- Local, nada muda para quem clona: `docker compose up -d --build` sobe os quatro serviços com as
  senhas descartáveis do `docker-compose.yml`, e `bash scripts/verificar-stack.sh` roda o mesmo
  aceite do CI.
