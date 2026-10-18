#!/bin/sh
# =============================================================================
# Papel de banco da API (menor privilégio) — roda DENTRO do contêiner do Postgres.
#
# A API não entra no banco com o dono (POSTGRES_USER, superusuário na imagem oficial): entra com
# este papel, que só lê os dois schemas e só grava no log de predição. Se um dia houver uma falha
# de injeção, o pior caso é uma linha a mais no log — nada de TRUNCATE, de DROP nem de comando no
# servidor.
#
#   * LOGIN sem atributo especial (sem superusuário, sem criar banco ou papel)
#   * SELECT em todas as tabelas e views de `dados` e `operacao` (rotulos_escala, referências de
#     deriva, log) e INSERT só em operacao.log_predicao, com USAGE na sequência do id
#   * BYPASSRLS: sql/grants.sql liga e FORÇA RLS em toda tabela SEM nenhuma policy (ADR 0007),
#     então um papel sem BYPASSRLS não enxerga linha nenhuma. É o único atributo "forte" do papel,
#     e ele não concede nada além do que os GRANTs acima dão.
#   * statement_timeout de 5 s: backstop do command_timeout de 3 s da própria API
#
# Roda sozinho na primeira subida (initdb, volume vazio, depois de 10-schema.sql e 20-grants.sql) e
# de novo a cada deploy (scripts/deploy.sh). Idempotente: rodar de novo só atualiza senha e
# permissões. Num banco local que já existe, à mão:
#   docker compose exec -T banco sh < sql/usuario-api.sh
# =============================================================================

: "${API_DB_USER:?defina API_DB_USER}"
: "${API_DB_PASSWORD:?defina API_DB_PASSWORD}"

# A senha vem do ambiente pelo \getenv, sem aparecer na linha de comando nem no log.
psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" <<'SQL'
\getenv usuario API_DB_USER
\getenv senha API_DB_PASSWORD
\getenv banco POSTGRES_DB

SELECT format('CREATE ROLE %I LOGIN', :'usuario')
 WHERE NOT EXISTS (SELECT FROM pg_roles WHERE rolname = :'usuario') \gexec

ALTER ROLE :"usuario" WITH LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION BYPASSRLS
  CONNECTION LIMIT 5 PASSWORD :'senha';
ALTER ROLE :"usuario" SET statement_timeout = '5s';

-- Ninguém além do dono cria tabelas temporárias neste banco.
REVOKE TEMPORARY ON DATABASE :"banco" FROM PUBLIC;
GRANT CONNECT ON DATABASE :"banco" TO :"usuario";
GRANT USAGE ON SCHEMA dados, operacao TO :"usuario";
GRANT SELECT ON ALL TABLES IN SCHEMA dados, operacao TO :"usuario";
GRANT INSERT ON operacao.log_predicao TO :"usuario";
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA operacao TO :"usuario";
-- Tabela ou view criada depois pelo dono (schema.sql novo) já nasce legível pela API.
ALTER DEFAULT PRIVILEGES IN SCHEMA dados, operacao GRANT SELECT ON TABLES TO :"usuario";
SQL
