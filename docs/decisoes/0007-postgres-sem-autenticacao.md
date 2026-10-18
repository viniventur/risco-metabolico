# ADR 0007 — Postgres gerenciado sem autenticação de usuário

**Data:** 2026-10-17 (conferência na VPS em 2026-10-18) · **Estado:** aceita · **Fases:** F3b (desenho), F17 (conferência)

## Contexto

O projeto ganha um Postgres gerenciado (instância publicada) e um contêiner local (`docker compose`). Ele guarda **duas** coisas, e só duas: a **tabela de fonte** (a base pública semeada, `dados.registros_triagem`) e o **log de predição** (`operacao.log_predicao`), mais as tabelas de operação que os acompanham (cargas, snapshots, referências de deriva). Não há tabela de usuário, de sessão ou de estado de interface.

## Decisão

**Não existe autenticação neste desenho — e é ela que fecha o escopo.** Sem login não existe usuário; sem usuário não existe funcionalidade de escrita por pessoa (marcar, anotar, favoritar), nem tabela de sessão, nem preferência salva. Cada uma dessas exigiria login e, com ele, uma superfície de segurança que o projeto não tem tempo de fazer direito.

Consequência que sustenta a decisão: **o navegador nunca fala com o Postgres.** Todo acesso passa pelo backend, por conexão Postgres direta, com a credencial vivendo só em `BANCO_URL`, variável de ambiente do servidor. O backend **não** usa a API REST do provedor nem o SDK dele — a chave de serviço não é necessária e não é distribuída: uma credencial a menos para vazar.

### Três camadas, todas em `sql/`

1. **Schema fora do exposto.** Nenhum objeto vive em `public`; `dados` e `operacao` ficam fora da superfície que a API REST do provedor expõe por padrão.
2. **Grants revogados.** `sql/grants.sql` revoga tudo de `PUBLIC` e, quando os papéis existirem (só no provedor), de `anon` e `authenticated`, inclusive por `ALTER DEFAULT PRIVILEGES`.
3. **RLS ligada sem policy.** Um laço executável habilita e força RLS em **toda** tabela dos dois schemas. Sem policy, é negação total para qualquer papel sem `BYPASSRLS`. O papel de serviço do backend tem `BYPASSRLS`; `FORCE` só alcança o dono da tabela, então o backend não é bloqueado.

### O que nunca vai para o front

`BANCO_URL`, a senha, a chave de serviço, a chave anônima, o host do projeto e qualquer `VITE_*` que contenha um deles. Três barreiras independentes: o Vite só injeta `VITE_*` (nenhuma variável de banco tem o prefixo); o `.env` do backend não é montado no front e o build do front não recebe `env_file`; `scripts/verificar-bundle.ps1` varre `dist/` por `supabase`, `service_role`, `postgres://`, `postgresql://` e `eyJ`.

## Desenho estático-primeiro (§4.3.8)

O plano previa um Postgres gerenciado que pausa por inatividade, com duas defesas: (a) uma Action semanal de keep-alive e (b) **o produto abre inteiro com o banco fora do ar** — painel, simulador, estudos e predição não dependem dele; só `/monitoramento/deriva` degrada, com `200` e `disponivel: false`, nunca com tela de erro. Com a hospedagem na VPS (ADR 0009) o banco não pausa e a defesa (a) saiu: a retenção semanal do log, que viajava no keep-alive, roda no serviço `retencao-log`, ao lado do banco, com o dono. A defesa (b) continua inteira e agora cobre deploy, reinício e falha do banco.

## Conferido na VPS (F17)

O plano pedia esta tabela para o "painel do provedor". Não há painel: o banco é um contêiner na VPS do autor (ADR 0009). Cada linha diz o que vale agora e como é conferido — nada aqui é afirmado de memória:

| Item do plano | Na VPS | Conferido |
|---|---|---|
| Schemas expostos por API REST | Não há API REST nem porta publicada: o Postgres só existe na rede interna do compose (`docker-compose.producao.yml` zera `ports` do banco e da API). Só o nginx publica `127.0.0.1:WEB_HOST_PORT`, para o Caddy | `scripts/verificar-stack.sh` ("nenhuma porta aberta para a rede") em 2026-10-18, local e no CI; `scripts/verificar-producao.sh` (porta 5432 fechada vista de fora) a cada deploy |
| Prazo da pausa por inatividade | Não se aplica: `restart: unless-stopped`, sem pausa | — |
| Host do pooler para `BANCO_URL` | Não se aplica: a API fala com `banco:5432` pela rede interna; `statement_cache_size=0` fica por não custar nada | — |
| `rolbypassrls` do papel da API | `triagem_api` (`sql/usuario-api.sh`): `BYPASSRLS = true`, `NOSUPERUSER`, `SELECT` nos dois schemas, `INSERT` só em `operacao.log_predicao`, sem `UPDATE`/`DELETE`/`TRUNCATE`, sem `CREATE`, sem `COPY TO PROGRAM`. O seed, `congelar` e a retenção usam o dono | 12 verificações de `scripts/verificar-stack.sh` em 2026-10-18 (55 de 55 ok), local e no CI |
| Cota de disco, para `TETO_LINHAS_LOG` (§6.8.6) | O disco da VPS, compartilhado com outros sistemas. O teto fica em `500000` (padrão do plano) até existirem linhas reais no log para medir `pg_column_size`; a medição e o valor entram aqui no primeiro deploy | a preencher no primeiro deploy |

## Consequências

- Nenhuma alteração de schema pelo painel do provedor: `sql/schema.sql` é a fonte única e `python -m app.dados.schema --conferir` falha na divergência (risco 22 do plano).
- Se a senha vazar, trocar a senha do banco é o primeiro passo, não o último (risco 18).
- Introduzir o SDK do provedor um dia obriga a chave de serviço a seguir exatamente esta regra: variável de ambiente do backend, nunca no repositório, nunca no front.
