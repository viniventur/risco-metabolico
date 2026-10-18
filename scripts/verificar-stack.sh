#!/usr/bin/env bash
# =============================================================================
# Verifica o ambiente completo já no ar (docker compose up -d --wait), por dentro e por fora.
# Roda no CI antes de publicar as imagens e também à mão, da raiz do repositório:
#
#   bash scripts/verificar-stack.sh                        (app em http://127.0.0.1:8080)
#   WEB_HOST_PORT=8081 bash scripts/verificar-stack.sh     (se o web estiver em outra porta)
#
# Antes de conferir, prepara o banco exatamente como o scripts/deploy.sh faz na VPS: seed e
# referência de deriva pela imagem da API, com o dono do banco (idempotente).
#
# Por dentro: containers sem root e sem capabilities, portas só em 127.0.0.1, papel da API sem
# superusuário e sem DELETE/TRUNCATE, senha fora dos logs. Por fora, pelo nginx: as telas, a API
# na mesma origem, cabeçalhos de segurança, cache, limite de consultas no envelope de erro da API.
# =============================================================================
set -uo pipefail
cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.."

BASE="http://127.0.0.1:${WEB_HOST_PORT:-8080}"
POSTGRES_USER=${POSTGRES_USER:-postgres}
POSTGRES_PASSWORD=${POSTGRES_PASSWORD:-postgres}
POSTGRES_DB=${POSTGRES_DB:-app_local}
FALHAS=0

secao() { printf '\n== %s ==\n' "$*"; }
ok() { echo "  ok   $*"; }
falha() {
  echo "  FALHA $*" >&2
  FALHAS=$((FALHAS + 1))
}
# conferir <descrição> <comando...>: ok se o comando sair 0.
conferir() {
  local descricao=$1
  shift
  if "$@" >/dev/null 2>&1; then ok "$descricao"; else falha "$descricao"; fi
}
contem() { grep -Eiq -- "$2" <<<"$1"; }
nega() { ! "$@"; }
status() { curl -sS -o /dev/null -w '%{http_code} %{content_type}' --max-time 20 "$BASE$1" 2>/dev/null || echo 000; }
cabecalhos() { curl -sS -D - -o /dev/null --max-time 20 "$BASE$1" 2>/dev/null || true; }

# ---------------------------------------------------------------------------
secao "Preparação do banco, como no deploy (seed idempotente e referência de deriva)"
dono="postgresql://$POSTGRES_USER:$POSTGRES_PASSWORD@banco:5432/$POSTGRES_DB"
conferir "seed pela imagem da API, com o dono do banco" \
  docker compose run --rm --no-deps -T -e BANCO_URL="$dono" api \
  python -m app.dados.seed --arquivo /app/data/bruto/obesity.csv --tabela dados.registros_triagem
conferir "referência de deriva carregada" \
  docker compose run --rm --no-deps -T -e BANCO_URL="$dono" api python -m app.treino.distribuicao --carregar

# ---------------------------------------------------------------------------
secao "Containers"
portas=$(docker compose ps --format '{{.Ports}}')
conferir "nenhuma porta aberta para a rede (tudo em 127.0.0.1)" nega contem "$portas" "(0\.0\.0\.0|\[::\]):[0-9]"
for servico in api web retencao-log; do
  usuario=$(docker compose exec -T "$servico" id -u 2>/dev/null || echo "?")
  if [[ $usuario =~ ^[1-9][0-9]*$ ]]; then ok "$servico roda sem root (uid $usuario)"; else falha "$servico roda como root ou não respondeu"; fi
done
for servico in api web; do
  capacidades=$(docker compose exec -T "$servico" sh -c 'grep CapEff /proc/1/status' 2>/dev/null || true)
  conferir "$servico sem capabilities" contem "$capacidades" "CapEff:[[:space:]]+0+$"
done
conferir "api com sistema de arquivos só de leitura" nega docker compose exec -T api sh -c 'touch /app/backend/.verificacao'
conferir "web com sistema de arquivos só de leitura" nega docker compose exec -T web sh -c 'touch /etc/nginx/.verificacao'

# ---------------------------------------------------------------------------
secao "Banco de dados (papel da API)"
sql_api() { docker compose exec -T banco sh -c 'psql -v ON_ERROR_STOP=1 -U "$API_DB_USER" -d "$POSTGRES_DB" -Atq' <<<"$1"; }
conferir "a API não é superusuário" contem "$(sql_api 'SELECT rolsuper FROM pg_roles WHERE rolname = current_user;' 2>/dev/null || true)" "^f$"
conferir "a API tem BYPASSRLS (RLS forçada sem policy, ADR 0007)" contem "$(sql_api 'SELECT rolbypassrls FROM pg_roles WHERE rolname = current_user;' 2>/dev/null || true)" "^t$"
conferir "a API lê a base semeada" contem "$(sql_api 'SELECT count(*) FROM dados.registros_triagem;' 2>/dev/null || true)" "^2111$"
conferir "a API lê os rótulos das escalas" contem "$(sql_api 'SELECT count(*) FROM dados.rotulos_escala;' 2>/dev/null || true)" "^[1-9]"
conferir "a API lê a referência de deriva" contem "$(sql_api 'SELECT count(*) FROM operacao.distribuicao_treino_faixa;' 2>/dev/null || true)" "^[1-9]"
conferir "a API grava no log de predição" contem "$(sql_api "SELECT has_table_privilege(current_user, 'operacao.log_predicao', 'INSERT');" 2>/dev/null || true)" "^t$"
conferir "a API não apaga o log" contem "$(sql_api "SELECT has_table_privilege(current_user, 'operacao.log_predicao', 'DELETE');" 2>/dev/null || true)" "^f$"
conferir "a API não altera a base" contem "$(sql_api "SELECT has_table_privilege(current_user, 'dados.registros_triagem', 'UPDATE') OR has_table_privilege(current_user, 'dados.registros_triagem', 'DELETE');" 2>/dev/null || true)" "^f$"
conferir "a API não cria tabelas" nega sql_api "CREATE TABLE operacao.verificacao (id int);"
conferir "a API não executa comandos no servidor" nega sql_api "COPY (SELECT 1) TO PROGRAM 'id';"
conferir "a API não lê arquivos do servidor" nega sql_api "SELECT pg_read_file('/etc/passwd');"
conferir "a API não faz TRUNCATE" nega sql_api "TRUNCATE operacao.log_predicao;"

# ---------------------------------------------------------------------------
secao "Telas e arquivos estáticos pelo nginx ($BASE)"
for tela in / /painel /consulta /simulador /monitoramento /estudos /estudos/comparacao-de-modelos; do
  conferir "$tela abre o app (200)" contem "$(status "$tela")" "^200 text/html"
done
conferir "endereço que não existe responde 404, com o app" contem "$(status /pagina-que-nao-existe)" "^404 text/html"
conferir "módulo Estudos estático (/study/manifest.json)" contem "$(status /study/manifest.json)" "^200 application/json"
conferir "/study/ com cache de uma hora" contem "$(cabecalhos /study/manifest.json)" "cache-control: public, max-age=3600"
indice=$(curl -sS --max-time 20 "$BASE/" 2>/dev/null || true)
asset=$(grep -oE '/assets/[A-Za-z0-9._-]+\.js' <<<"$indice" | head -1)
if [[ -n $asset ]]; then
  conferir "pacote JS do Vite com cache imutável" contem "$(cabecalhos "$asset")" "cache-control: public, immutable"
  conferir "nenhuma credencial dentro do bundle" nega contem "$(curl -sS --max-time 20 "$BASE$asset" 2>/dev/null)" "(supabase|service_role|postgres://|postgresql://|eyJ[A-Za-z0-9_-]{10,}\.eyJ[A-Za-z0-9_-]{10,})"
else
  falha "index.html sem referência a /assets/*.js"
fi

# ---------------------------------------------------------------------------
secao "API na mesma origem"
conferir "/api/v1/health responde ok" contem "$(curl -sS --max-time 20 "$BASE/api/v1/health" 2>/dev/null)" '"status":"ok"'
conferir "/api/v1/health vê o banco" contem "$(curl -sS --max-time 20 "$BASE/api/v1/health" 2>/dev/null)" '"banco":"(ok|frio)"'
conferir "/api/v1/ready pronto" contem "$(curl -sS --max-time 20 "$BASE/api/v1/ready" 2>/dev/null)" '"pronto":true'
conferir "/api/v1/model/info com métricas" contem "$(curl -sS --max-time 20 "$BASE/api/v1/model/info" 2>/dev/null)" '"metricas_teste"'
conferir "/api/v1/painel/resumo com 2.111 registros" contem "$(curl -sS --max-time 20 "$BASE/api/v1/painel/resumo" 2>/dev/null)" '"total_global":2111'
conferir "/api/v1/monitoramento/deriva responde 200" contem "$(status /api/v1/monitoramento/deriva)" "^200 application/json"
conferir "/docs e /openapi.json servidos pela API" bash -c "[[ \$(curl -sS -o /dev/null -w '%{http_code}' --max-time 20 '$BASE/docs') == 200 && \$(curl -sS -o /dev/null -w '%{http_code}' --max-time 20 '$BASE/openapi.json') == 200 ]]"
entrada=$(python3 -c 'import json;c=json.load(open("backend/tests/dados_ouro/entradas.json", encoding="utf-8"))[0];print(json.dumps(c.get("entrada",c)))' 2>/dev/null ||
  python -c 'import json;c=json.load(open("backend/tests/dados_ouro/entradas.json", encoding="utf-8"))[0];print(json.dumps(c.get("entrada",c)))')
predicao=$(curl -sS --max-time 20 -H 'Content-Type: application/json' -H 'X-Origem-Cliente: painel' -d "$entrada" "$BASE/api/v1/predicoes" 2>/dev/null || true)
conferir "POST /api/v1/predicoes devolve as 7 probabilidades" contem "$(grep -o '"classe"' <<<"$predicao" | wc -l | tr -d ' ')" "^7$"
sleep 2
conferir "a predição chegou ao log com origem painel" contem "$(docker compose exec -T banco sh -c 'psql -v ON_ERROR_STOP=1 -U "$POSTGRES_USER" -d "$POSTGRES_DB" -Atq -c "SELECT count(*) FROM operacao.log_predicao WHERE origem = '"'"'painel'"'"'"' 2>/dev/null || true)" "^[1-9]"

# ---------------------------------------------------------------------------
secao "Cabeçalhos de segurança"
cab=$(cabecalhos /)
conferir "Content-Security-Policy do app" contem "$cab" "content-security-policy: default-src 'self'"
conferir "connect-src só o próprio site (API na mesma origem)" contem "$cab" "connect-src 'self'[;\"]"
conferir "Strict-Transport-Security" contem "$cab" "strict-transport-security: max-age=31536000"
conferir "X-Content-Type-Options" contem "$cab" "x-content-type-options: nosniff"
conferir "X-Frame-Options" contem "$cab" "x-frame-options: DENY"
conferir "sem versão do servidor" nega contem "$cab" "^server: nginx/[0-9]"
conferir "/docs sem a CSP do app (Swagger UI carrega de CDN)" nega contem "$(cabecalhos /docs)" "content-security-policy"

# ---------------------------------------------------------------------------
secao "Limite de consultas (nginx, envelope de erro da API)"
# 120 pedidos seguidos: acima de 20/s com rajada de 60, parte deles tem de voltar 429.
codigos=$(for _ in $(seq 1 120); do curl -s -o /dev/null -w '%{http_code}\n' --max-time 5 "$BASE/api/v1/health" 2>/dev/null & done; wait)
if contem "$codigos" "^429$"; then
  ok "excesso de pedidos responde 429"
  resposta=$(for _ in $(seq 1 90); do curl -s --max-time 5 "$BASE/api/v1/health" 2>/dev/null & done; wait)
  conferir "o 429 vem no envelope {erro, mensagem, detalhes} da API" contem "$resposta" '"erro":"limite_de_taxa"'
else
  falha "nenhum 429 em 120 pedidos seguidos"
fi

# ---------------------------------------------------------------------------
secao "Logs"
logs_api=$(docker compose logs --no-log-prefix api 2>/dev/null || true)
conferir "a senha do banco não aparece nos logs da API" nega contem "$logs_api" "$POSTGRES_PASSWORD"
conferir "a DSN não aparece nos logs da API" nega contem "$logs_api" "postgresql://"
conferir "a retenção rodou ao subir" contem "$(docker compose logs --no-log-prefix retencao-log 2>/dev/null || true)" "retencao"

# ---------------------------------------------------------------------------
echo
if ((FALHAS)); then
  echo "RESULTADO: $FALHAS verificação(ões) falharam." >&2
  exit 1
fi
echo "RESULTADO: tudo certo."
