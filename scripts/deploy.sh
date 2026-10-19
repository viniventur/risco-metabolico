#!/usr/bin/env bash
# =============================================================================
# Triagem Metabólica — Deploy na VPS, chamado pelo GitHub Actions (.github/workflows/ci.yml)
#
# Na VPS não há código-fonte. A pasta ~/risco-metabolico só tem este script, os dois arquivos do
# compose e o .env; cada serviço roda a imagem que o CI montou, testou e publicou no GitHub
# Container Registry, presa pelo digest (a "impressão digital" da imagem).
#
# A chave SSH do Actions fica PRESA a este script no ~/.ssh/authorized_keys do usuário deploy:
#   command="bash /home/deploy/risco-metabolico/deploy.sh",restrict ssh-ed25519 AAAA... github-actions-risco-metabolico
# Com isso ela não abre terminal nem túnel. Pelo stdin, ela só entrega o .env, os digests das
# imagens e uma autorização de leitura do registro que vence quando o job do Actions termina; no
# lugar do comando vai o commit (só para os registros). Mesmo que a chave vaze, ela só consegue pôr
# no ar imagens do registro deste app (REGISTRO_RE, abaixo), onde só o CI da main publica.
#
# Passos:
#   1. aceita do stdin só as variáveis esperadas, no formato esperado (e nunca mostra os valores)
#   2. baixa as imagens com a autorização temporária, que não fica gravada em lugar nenhum
#   3. tira os arquivos do pacote de deploy; se este script mudou, troca a si mesmo e recomeça
#   4. guarda a versão atual, grava o .env novo, sobe o banco, reaplica schema.sql, grants.sql e o
#      papel da API, acerta a senha do dono, semeia a base (idempotente) e carrega a referência de
#      deriva — os MESMOS arquivos e comandos do compose local (plano, §11.2)
#   5. sobe o resto, espera tudo ficar saudável e confere /api/v1/health e /api/v1/ready pelo nginx
#   6. se algo falhar, volta para a versão anterior (com os arquivos e as imagens que já estão aqui)
#
# À mão, na VPS: repete a versão que está no ar, com as imagens que já estão aqui, sem o GitHub:
#   cd ~/risco-metabolico && bash deploy.sh "$(sed -n 's/^VERSAO=//p' .env)" < .env
# =============================================================================

# Tudo fica dentro de funções chamadas na última linha: o bash lê o arquivo inteiro antes de
# começar, então o próprio script pode ser trocado (passo 3) sem atrapalhar a execução em andamento.

set -euo pipefail
# Tudo o que o deploy cria (.env, compose, cópia da versão anterior) fica só para o usuário deploy.
umask 077

# O registro de imagens deste app (ghcr.io/viniventur/risco-metabolico-*): só imagens daqui entram no ar.
readonly REGISTRO_RE='ghcr\.io/viniventur/risco-metabolico'

# Valores fixos do .env: nomes do banco e do papel da API, o COMPOSE_FILE (que liga o
# docker-compose.producao.yml em todo "docker compose" rodado na pasta do app) e os interruptores
# que em produção são sempre ligados: integridade do artefato, limitação de taxa e log de predição.
readonly NOMES_FIXOS='POSTGRES_DB=app_local POSTGRES_USER=postgres API_DB_USER=triagem_api COMPOSE_FILE=docker-compose.yml:docker-compose.producao.yml EXIGIR_INTEGRIDADE=true LIMITE_TAXA_ATIVO=true LOG_PREDICAO_HABILITADO=true'
readonly SENHAS='POSTGRES_PASSWORD API_DB_PASSWORD SAL_TAXA'
readonly IMAGENS='BANCO_IMAGE API_IMAGE WEB_IMAGE PACOTE_IMAGE'
# Os arquivos da versão no ar, guardados em .anterior/ antes de trocar (para voltar se falhar).
readonly ARQUIVOS='docker-compose.yml docker-compose.producao.yml .env'

passo() { echo "==> $*"; }
aviso() { echo "AVISO: $*" >&2; }
falhar() {
  echo "ERRO: $*" >&2
  exit 1
}

# Formato aceito de cada variável. Nada de espaço, aspas, "$" ou "#": o valor vai direto para o
# .env do Docker Compose e não pode virar outra coisa.
declare -A FORMATO=(
  [POSTGRES_PASSWORD]='^[0-9a-f]{32,128}$'
  [API_DB_PASSWORD]='^[0-9a-f]{32,128}$'
  # Sal do HMAC da chave de origem da limitação de taxa (§6.8.2): gerado, nunca versionado.
  [SAL_TAXA]='^[0-9a-f]{32,128}$'
  # O endereço público do site: vira ORIGENS_CORS da API (sem barra no fim, §11.4).
  [SITE_URL]='^https://[a-z0-9][a-z0-9.-]*[a-z0-9]$'
  # A porta em 127.0.0.1 que o web publica para o Caddy (a VPS tem outros sistemas).
  [WEB_HOST_PORT]='^[0-9]{4,5}$'
  [RETENCAO_DIAS]='^[0-9]{1,4}$'
  [TETO_LINHAS_LOG]='^[0-9]{1,9}$'
  # Cada imagem só pode vir do registro deste app, com o nome certo e presa pelo digest.
  [BANCO_IMAGE]="^${REGISTRO_RE}-banco@sha256:[0-9a-f]{64}$"
  [API_IMAGE]="^${REGISTRO_RE}-api@sha256:[0-9a-f]{64}$"
  [WEB_IMAGE]="^${REGISTRO_RE}-web@sha256:[0-9a-f]{64}$"
  [PACOTE_IMAGE]="^${REGISTRO_RE}-pacote@sha256:[0-9a-f]{64}$"
  # O commit no ar (só para saber qual é a versão).
  [VERSAO]='^[0-9a-f]{40}$'
  # A autorização temporária do registro (o GITHUB_TOKEN do job de deploy). Nunca vai para o .env.
  [GHCR_USUARIO]='^[A-Za-z0-9][A-Za-z0-9-]{0,38}(\[bot\])?$'
  [GHCR_TOKEN]='^[A-Za-z0-9._~+/=-]{20,4096}$'
)

declare -A VALOR=()
# O stdin inteiro, guardado para recomeçar com os mesmos dados se este script for trocado.
ENTRADA=""
# Pastas temporárias (globais: a limpeza roda na saída do script, fora das funções).
CONFIG_DOCKER=""
PACOTE=""

limpar_temporarios() {
  [[ -n $CONFIG_DOCKER ]] && rm -rf "$CONFIG_DOCKER"
  [[ -n $PACOTE ]] && rm -rf "$PACOTE"
  return 0
}

ler_entrada() {
  [[ -t 0 ]] && falhar "Envie o .env pelo stdin: bash deploy.sh <commit> < .env"
  ENTRADA=$(head -c 32768)

  local linha chave valor fixo
  while IFS= read -r linha || [[ -n $linha ]]; do
    linha=${linha%$'\r'}
    [[ -z $linha || $linha == \#* ]] && continue
    [[ $linha == *=* ]] || falhar "Linha do .env sem '='."
    chave=${linha%%=*}
    valor=${linha#*=}

    # Os valores fixos só são aceitos se vierem iguais (é o caso de um .env gerado aqui).
    fixo=" $NOMES_FIXOS "
    if [[ $fixo == *" $chave="* ]]; then
      [[ $fixo == *" $chave=$valor "* ]] || falhar "$chave não pode ser alterado."
      continue
    fi
    # ORIGENS_CORS é derivada de SITE_URL ao gravar o .env; num .env gerado aqui ela volta igual.
    [[ $chave == ORIGENS_CORS ]] && continue

    [[ -v "FORMATO[$chave]" ]] || falhar "Variável não aceita no .env: $chave"
    [[ -v "VALOR[$chave]" ]] && falhar "Variável repetida no .env: $chave"
    [[ $valor =~ ${FORMATO[$chave]} ]] || falhar "Valor de $chave fora do formato esperado."
    VALOR[$chave]=$valor
  done <<<"$ENTRADA"

  local senha outra imagem
  declare -A vistas=()
  for senha in $SENHAS; do
    [[ -n ${VALOR[$senha]:-} ]] || falhar "Falta $senha (gere com: openssl rand -hex 24)."
    for outra in "${!vistas[@]}"; do
      [[ ${VALOR[$senha]} == "${VALOR[$outra]}" ]] && falhar "As senhas precisam ser diferentes entre si ($outra e $senha são iguais)."
    done
    vistas[$senha]=1
  done
  for imagem in $IMAGENS; do
    [[ -n ${VALOR[$imagem]:-} ]] || falhar "Falta $imagem (o CI manda o digest de cada imagem publicada)."
  done
  [[ -n ${VALOR[SITE_URL]:-} ]] || falhar "Falta SITE_URL (https://dominio-do-app)."
  if [[ -n ${VALOR[GHCR_TOKEN]:-} && -z ${VALOR[GHCR_USUARIO]:-} ]]; then
    falhar "Falta GHCR_USUARIO junto com o GHCR_TOKEN."
  fi

  VALOR[WEB_HOST_PORT]=${VALOR[WEB_HOST_PORT]:-8085}
  VALOR[RETENCAO_DIAS]=${VALOR[RETENCAO_DIAS]:-90}
  VALOR[TETO_LINHAS_LOG]=${VALOR[TETO_LINHAS_LOG]:-500000}
}

# Com a autorização do Actions: entra no registro numa configuração do Docker só deste deploy, baixa
# as imagens pelo digest e apaga essa configuração (a autorização não fica em disco). Sem ela (deploy
# à mão): usa as imagens que já estão na VPS.
baixar_imagens() {
  local imagem
  if [[ -z ${VALOR[GHCR_TOKEN]:-} ]]; then
    passo "Sem autorização do registro: usando as imagens que já estão aqui"
    for imagem in BANCO_IMAGE API_IMAGE WEB_IMAGE; do
      docker image inspect "${VALOR[$imagem]}" >/dev/null 2>&1 ||
        falhar "A imagem de $imagem não está nesta VPS. Rode o deploy pelo GitHub (Actions → ci → Run workflow)."
    done
    return 0
  fi

  passo "Baixando as imagens do registro"
  CONFIG_DOCKER=$(mktemp -d)
  printf '%s' "${VALOR[GHCR_TOKEN]}" |
    DOCKER_CONFIG=$CONFIG_DOCKER docker login ghcr.io -u "${VALOR[GHCR_USUARIO]}" --password-stdin >/dev/null 2>&1 ||
    falhar "O registro recusou a autorização do Actions (ghcr.io)."
  for imagem in $IMAGENS; do
    DOCKER_CONFIG=$CONFIG_DOCKER docker pull -q "${VALOR[$imagem]}" >/dev/null ||
      falhar "Não consegui baixar $imagem."
  done
  DOCKER_CONFIG=$CONFIG_DOCKER docker logout ghcr.io >/dev/null 2>&1 || true
  rm -rf "$CONFIG_DOCKER"
  CONFIG_DOCKER=""
}

# Copia os arquivos do pacote de deploy para uma pasta temporária, sem rodar o pacote.
tirar_pacote() {
  local id arquivo
  PACOTE=$(mktemp -d "$PWD/.pacote.XXXXXX")
  id=$(docker create "${VALOR[PACOTE_IMAGE]}")
  if ! docker cp "$id:/pacote/." "$PACOTE" >/dev/null; then
    docker rm "$id" >/dev/null || true
    falhar "Não consegui tirar os arquivos do pacote de deploy."
  fi
  docker rm "$id" >/dev/null
  for arquivo in docker-compose.yml docker-compose.producao.yml deploy.sh; do
    [[ -s $PACOTE/$arquivo ]] || falhar "O pacote de deploy veio sem $arquivo."
  done
}

gravar_env() {
  local destino=$1 commit=$2 chave
  {
    echo "# Gerado pelo deploy.sh em $(date -u +%Y-%m-%dT%H:%M:%SZ)."
    echo "# Não edite aqui: os valores vêm do GitHub (Secrets e Variables do ambiente producao)."
    tr ' ' '\n' <<<"$NOMES_FIXOS"
    echo "VERSAO=$commit"
    for chave in BANCO_IMAGE API_IMAGE WEB_IMAGE PACOTE_IMAGE $SENHAS SITE_URL WEB_HOST_PORT \
      RETENCAO_DIAS TETO_LINHAS_LOG; do
      echo "$chave=${VALOR[$chave]:-}"
    done
    echo "ORIGENS_CORS=${VALOR[SITE_URL]}"
  } >"$destino"
}

# Os scripts do banco só rodam sozinhos quando o volume é criado. A cada deploy:
#   * schema.sql e grants.sql rodam de novo (idempotentes): tabela nova entra no banco que já existe
#   * o papel da API é refeito com a senha e as permissões do .env
#   * o dono do banco passa a usar a senha do .env (o Postgres só lê o ambiente ao criar o volume)
#   * a base é semeada (idempotente por sha256: com o mesmo CSV não escreve nada) e a referência de
#     deriva é carregada — pela imagem da API, com o DONO do banco, sem subir a API
# Os arquivos são os da própria imagem do banco (database/Dockerfile), na versão que está subindo.
preparar_banco() {
  # Sem os avisos "já existe, pulando" a cada deploy; erros continuam aparecendo.
  local psql_dono='PGOPTIONS="-c client_min_messages=warning" psql -v ON_ERROR_STOP=1 -q -U "$POSTGRES_USER" -d "$POSTGRES_DB"'
  local scripts=/docker-entrypoint-initdb.d
  local sql
  for sql in 10-schema 20-grants; do
    docker compose exec -T banco sh -c "$psql_dono -f $scripts/$sql.sql" >/dev/null || return 1
  done
  docker compose exec -T banco sh "$scripts/30-usuario-api.sh" >/dev/null || return 1
  docker compose exec -T banco sh -c "$psql_dono" <<'SQL' || return 1
\getenv senha POSTGRES_PASSWORD
ALTER ROLE CURRENT_USER PASSWORD :'senha';
SQL
  # O seed e a carga da distribuição precisam do dono (TRUNCATE + COPY); a DSN vai só para o
  # processo descartável, nunca para o .env nem para o serviço da API.
  local dono="postgresql://${VALOR[POSTGRES_USER]:-postgres}:${VALOR[POSTGRES_PASSWORD]}@banco:5432/${VALOR[POSTGRES_DB]:-app_local}"
  docker compose run --rm --no-deps -T -e BANCO_URL="$dono" api \
    python -m app.dados.seed --arquivo /app/data/bruto/obesity.csv --tabela dados.registros_triagem || return 1
  # A base da vertente diabetes, na tabela dela (idempotente do mesmo jeito).
  docker compose run --rm --no-deps -T -e BANCO_URL="$dono" api \
    python -m app.diabetes.dados.seed \
    --arquivo /app/data/bruto/diabetes/cdc_diabetes_health_indicators.csv || return 1
  docker compose run --rm --no-deps -T -e BANCO_URL="$dono" api \
    python -m app.treino.distribuicao --carregar >/dev/null || return 1
}

conferir_health() {
  local base="http://127.0.0.1:${WEB_HOST_PORT:-8085}/api/v1"
  for _ in 1 2 3 4 5 6 7 8 9 10; do
    if curl -fsS --max-time 5 "$base/health" 2>/dev/null | grep -q '"status":"ok"' &&
      curl -fsS --max-time 5 "$base/ready" 2>/dev/null | grep -q '"pronto":true'; then
      return 0
    fi
    sleep 3
  done
  echo "O $base/health ou o $base/ready não respondeu como esperado." >&2
  return 1
}

# Chamada dentro de um "if": aqui o set -e não vale, por isso cada passo confere o próprio erro.
subir() {
  passo "Banco de dados"
  docker compose up -d --wait --wait-timeout 180 banco || return 1
  passo "Schema, papel da API, senhas, seed e referência de deriva"
  preparar_banco || return 1
  passo "Subindo os serviços"
  docker compose up -d --remove-orphans --wait --wait-timeout 300 || return 1
  passo "Conferindo /api/v1/health e /api/v1/ready pelo nginx"
  conferir_health || return 1
}

# Apaga as imagens deste app que não são nem da versão no ar nem da anterior (a VPS tem outros
# sistemas: só entra na conta o que tem o rótulo do projeto risco-metabolico). Imagem em uso não sai.
limpar_imagens() {
  local manter id arquivo
  manter=$(
    for arquivo in .env .anterior/.env; do
      [[ -f $arquivo ]] && sed -n -E 's/^(BANCO|API|WEB)_IMAGE=//p' "$arquivo"
    done | xargs -r docker image inspect --format '{{.Id}}' 2>/dev/null
  ) || true
  docker image ls --no-trunc --filter "label=com.docker.compose.project=risco-metabolico" --format '{{.ID}}' |
    sort -u | while read -r id; do
      grep -qxF "$id" <<<"$manter" || docker image rm "$id" >/dev/null 2>&1 || true
    done
}

principal() {
  local app commit arquivo
  app=$(dirname -- "$(readlink -f -- "$0")")
  cd "$app"

  # Um deploy de cada vez (o workflow já garante isso; aqui é a segunda trava).
  if command -v flock >/dev/null; then
    exec 9>"$app/.deploy.lock"
    flock -n 9 || falhar "Já existe um deploy em andamento."
  fi

  commit=${1:-${SSH_ORIGINAL_COMMAND:-}}
  [[ $commit =~ ^[0-9a-f]{40}$ ]] || falhar "Informe o commit completo (40 caracteres hexadecimais)."

  trap limpar_temporarios EXIT
  passo "Lendo o que o GitHub mandou (${commit:0:7})"
  ler_entrada
  baixar_imagens

  # Com a autorização do Actions vem um pacote novo; no deploy à mão, ficam os arquivos que já estão aqui.
  if [[ -n ${VALOR[GHCR_TOKEN]:-} ]]; then
    tirar_pacote
    if ! cmp -s "$PACOTE/deploy.sh" "$app/deploy.sh"; then
      [[ -z ${DEPLOY_ATUALIZADO:-} ]] || falhar "O deploy.sh mudou de novo logo depois de trocado."
      passo "O pacote traz um deploy.sh novo: trocando este script e recomeçando"
      cp "$PACOTE/deploy.sh" "$app/.deploy.sh.novo"
      mv -f "$app/.deploy.sh.novo" "$app/deploy.sh"
      limpar_temporarios
      DEPLOY_ATUALIZADO=1 exec bash "$app/deploy.sh" "$commit" <<<"$ENTRADA"
    fi
  fi

  passo "Guardando a versão no ar em .anterior/"
  rm -rf .anterior
  mkdir .anterior
  for arquivo in $ARQUIVOS; do
    [[ -f $arquivo ]] && cp -p "$arquivo" .anterior/
  done

  if [[ -n $PACOTE ]]; then
    cp "$PACOTE/docker-compose.yml" "$PACOTE/docker-compose.producao.yml" .
  fi
  gravar_env .env.novo "$commit"
  mv -f .env.novo .env
  # O compose lê o .env; a conferência de saúde e a DSN do seed leem estas duas.
  WEB_HOST_PORT=${VALOR[WEB_HOST_PORT]}
  export WEB_HOST_PORT

  passo "Pondo no ar ${commit:0:7}"
  if subir; then
    limpar_imagens || true
    passo "Deploy de ${commit:0:7} concluído."
    return 0
  fi

  aviso "O deploy de ${commit:0:7} falhou."
  docker compose ps -a || true
  docker compose logs --tail=40 api web || true
  if [[ -f .anterior/.env && -f .anterior/docker-compose.yml ]]; then
    aviso "Voltando para a versão anterior..."
    for arquivo in $ARQUIVOS; do
      cp -p ".anterior/$arquivo" .
    done
    WEB_HOST_PORT=$(sed -n 's/^WEB_HOST_PORT=//p' .env)
    if subir; then
      aviso "O app voltou para a versão anterior e está no ar."
    else
      aviso "A volta também falhou: confira na VPS com 'docker compose ps' e 'docker compose logs'."
    fi
  fi
  exit 1
}

principal "$@"; exit $?
