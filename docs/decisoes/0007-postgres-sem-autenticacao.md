# ADR 0007 — Postgres gerenciado sem autenticação de usuário

**Data:** 2026-10-17 · **Estado:** aceita · **Fases:** F3b (desenho), F17 (conferência no provedor)

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

O plano gratuito pausa o projeto por inatividade. Duas defesas, as duas obrigatórias: (a) a Action semanal `manter-banco-vivo.yml` (conforto); (b) **o produto abre inteiro com o banco pausado** — painel, simulador, estudos e predição não dependem dele; só `/monitoramento/deriva` degrada, com `200` e `disponivel: false`, nunca com tela de erro. A defesa real é a (b).

## A conferir no painel do provedor (F17)

Campos preenchidos na fase de deploy, com a data da consulta — este ADR **não afirma prazo** de pausa nem hosts de memória:

| Item | Valor | Conferido em |
|---|---|---|
| Schemas expostos pela API REST (deve ser: sem `dados`, sem `operacao`; idealmente Data API desligada) | a conferir | — |
| Prazo vigente da política de pausa por inatividade e se há remoção após a pausa | a conferir | — |
| Host do **pooler** (porta 6543) oferecido para conexão IPv4 — usado em `BANCO_URL` e no segredo `BANCO_URL_POOLER` | a conferir | — |
| `rolbypassrls` do papel usado pelo seed e pelo backend | a conferir | — |
| Cota de disco do plano, para o critério de `TETO_LINHAS_LOG` (§6.8.6) | a conferir | — |

## Consequências

- Nenhuma alteração de schema pelo painel do provedor: `sql/schema.sql` é a fonte única e `python -m app.dados.schema --conferir` falha na divergência (risco 22 do plano).
- Se a senha vazar, trocar a senha do banco é o primeiro passo, não o último (risco 18).
- Introduzir o SDK do provedor um dia obriga a chave de serviço a seguir exatamente esta regra: variável de ambiente do backend, nunca no repositório, nunca no front.
