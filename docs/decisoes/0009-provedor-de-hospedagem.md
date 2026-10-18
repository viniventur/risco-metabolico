# ADR 0009 — Provedor de hospedagem (backend, front e banco)

**Data:** 2026-10-17 · **Estado:** proposta, aguardando as contas do autor · **Fase:** F17

## Contexto

O plano deixa o provedor do backend como **A DEFINIR NA EXECUÇÃO** (§11.1) e dá o critério: se o
serviço não pode hibernar (demonstração ao vivo, entrevista), escolher o que mantém o contêiner
acordado; se hibernar é tolerável, o de deploy por push é mais simples. O front e o banco já
estão amarrados pelo próprio repositório: `frontend/vercel.json` (rewrites de SPA, CSP e cache de
`/study/`) e o desenho de banco de ADR 0007 (host do **pooler** na porta 6543, papéis `anon` e
`authenticated` revogados, `manter-banco-vivo.yml`), que descrevem um Postgres gerenciado com
pausa por inatividade.

A execução autônoma do plano chegou a F17 **sem credenciais de nuvem**: nenhuma conta foi criada
nem usada, nenhum segredo existe no repositório, e o remoto do GitHub não foi criado. Esta ADR
registra a decisão proposta para o autor confirmar — não a substitui.

## Decisão proposta

| Peça | Provedor proposto | Por quê | O que o autor precisa fazer |
|---|---|---|---|
| Backend (imagem `backend/Dockerfile`) | Serviço de contêiner com plano gratuito e deploy por push a partir do GitHub, com `HEALTHCHECK`/health path configurável e variáveis de ambiente por serviço | Cabe o `.pkl` (475 KB), um worker, 512 MB. Hiberna por inatividade: a nota de *cold start* do README e o estado "acordando o modelo" do front já cobrem isso. Se a demonstração não puder hibernar, trocar por um provedor de máquinas sempre ligadas — a imagem é a mesma | Criar o serviço apontando para o repositório, contexto de build na **raiz**, `-f backend/Dockerfile`; definir as variáveis de §11.3 (`ORIGENS_CORS`, `BANCO_URL` do pooler, `BANCO_HABILITADO=true`, `LIMITE_TAXA_ATIVO=true`, `SAL_TAXA` gerado, `N_MINIMO_DERIVA=200`, `EXIGIR_INTEGRIDADE=true`) |
| Front (`frontend/`) | Hospedagem estática com preview por PR (o `vercel.json` já está escrito) | Build do Vite, CDN, `VITE_API_URL` e `VITE_REPO_URL` como variáveis de build — **as únicas** do front | Importar o repositório com *root directory* `frontend`, comando `npm run build`, saída `dist` |
| Banco | Postgres gerenciado com pooler IPv4 na porta 6543 e papéis `anon`/`authenticated` | É o desenho de ADR 0007; o keep-alive semanal e o portão do bundle (`verificar-bundle.ps1`) já supõem esse provedor | Criar o projeto, aplicar `sql/schema.sql` e `sql/grants.sql` por `psql`, rodar o seed e `carregar-distribuicao-treino.ps1`, preencher a tabela "A conferir no painel do provedor" de ADR 0007 com a data |
| Artefato do modelo | GitHub Release `v2.0.0` com `models/modelo-2.0.0.pkl` | `scripts/baixar_modelo.py` baixa pelo `manifest.json` e confere o `sha256` no build da imagem | `gh release create v2.0.0 models/modelo-2.0.0.pkl --title "Modelo 2.0.0"` depois do primeiro push |

## Consequências

- Até o autor executar a coluna da direita, o aceite de F17 (`/health` público, preflight CORS com
  a origem do front, `verificar-bundle.ps1`, `gh run watch` do keep-alive) **não pode ser dado**.
- Nada no código depende do provedor: o backend lê só variáveis de ambiente, o front só
  `VITE_*`, e o SQL é aplicado por `psql` a partir dos mesmos arquivos do `docker compose`.
- **A imagem publicada é autocontida.** O provedor constrói a imagem a partir do git, onde não há
  `data/processado/` nem volume para montar; por isso o build baixa do release, além do `.pkl`, o
  **snapshot congelado** (segundo asset, `sha256_snapshot` do manifest) e deriva
  `base_painel.parquet` dele sem banco (`python -m app.treino.painel`, mesma função de
  `congelar`). O `docker compose` local continua montando `./data/processado` por cima.
- Se o provedor do backend hibernar, a primeira chamada pode levar até 60 s; o front mostra
  "Acordando o modelo…" e o README avisa. Se não puder hibernar, a troca é de provedor, não de código.
