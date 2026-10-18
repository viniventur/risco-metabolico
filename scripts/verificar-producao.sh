#!/usr/bin/env bash
# =============================================================================
# Aceite de F17 visto de fora, como qualquer pessoa na internet (plano, §9 F17).
# Roda no GitHub Actions depois de cada deploy e à mão:
#
#   bash scripts/verificar-producao.sh https://dominio-do-app [ip-da-vps]
#
# HTTPS (certificado, redirecionamento, HSTS), /api/v1/health e /api/v1/ready pelo nginx, a
# tela inicial e o módulo Estudos, cabeçalhos de segurança, nenhuma credencial no bundle servido e,
# com o IP, as portas internas fechadas para a internet.
# =============================================================================
set -uo pipefail

SITE=${1:?informe o endereço do site, ex.: https://triagem.exemplo.com.br}
SITE=${SITE%/}
dominio=${SITE#https://}
dominio=${dominio%%/*}
HOST=${2:-}
FALHAS=0

secao() { printf '\n== %s ==\n' "$*"; }
ok() { echo "  ok   $*"; }
falha() {
  echo "  FALHA $*" >&2
  FALHAS=$((FALHAS + 1))
}
conferir() {
  local descricao=$1
  shift
  if "$@" >/dev/null 2>&1; then ok "$descricao"; else falha "$descricao"; fi
}
contem() { grep -Eiq -- "$2" <<<"$1"; }
nega() { ! "$@"; }
status() { curl -sS -o /dev/null -w '%{http_code} %{content_type}' --max-time 30 "$SITE$1" 2>/dev/null || echo 000; }
cabecalhos() { curl -sS -D - -o /dev/null --max-time 30 "$SITE$1" 2>/dev/null || true; }

# ---------------------------------------------------------------------------
secao "HTTPS ($SITE)"
if [[ $SITE != https://* ]]; then
  falha "o endereço tem de começar com https://"
  echo "RESULTADO: $FALHAS verificação(ões) falharam." >&2
  exit 1
fi
conferir "certificado válido para $dominio" curl -sS -o /dev/null --max-time 30 "$SITE/"
redirecionamento=$(curl -sS -o /dev/null --max-time 30 -w '%{http_code} %{redirect_url}' "http://$dominio/" || true)
conferir "http:// redireciona para https://" contem "$redirecionamento" "^30[178] https://"
cab=$(cabecalhos /)
conferir "HSTS de pelo menos 6 meses" bash -c '[[ $(grep -oiE "max-age=[0-9]+" <<<"$1" | head -1 | cut -d= -f2) -ge 15552000 ]]' _ "$(grep -iE '^strict-transport-security:' <<<"$cab" || true)"
conferir "Content-Security-Policy do app" contem "$cab" "content-security-policy: default-src 'self'"
conferir "X-Content-Type-Options" contem "$cab" "x-content-type-options: nosniff"
conferir "sem cabeçalho Server com versão" nega contem "$cab" "^server: .*[0-9]"

# ---------------------------------------------------------------------------
secao "A API pelo nginx (mesma origem)"
saude=$(curl -sS --max-time 60 "$SITE/api/v1/health" 2>/dev/null || true)
conferir "/api/v1/health responde ok" contem "$saude" '"status":"ok"'
conferir "/api/v1/health com o artefato carregado" contem "$saude" '"artefato_carregado":true'
conferir "/api/v1/health vê o banco (ok ou frio, nunca 5xx)" contem "$saude" '"banco":"(ok|frio)"'
conferir "/api/v1/ready pronto" contem "$(curl -sS --max-time 30 "$SITE/api/v1/ready" 2>/dev/null)" '"pronto":true'
conferir "/api/v1/model/info com métricas" contem "$(curl -sS --max-time 30 "$SITE/api/v1/model/info" 2>/dev/null)" '"metricas_teste"'
conferir "/api/v1/monitoramento/deriva responde 200" contem "$(status /api/v1/monitoramento/deriva)" "^200 application/json"
conferir "/docs servido pela API" contem "$(status /docs)" "^200 text/html"
# O preflight do aceite de F17: a origem do próprio site tem de estar em ORIGENS_CORS.
preflight=$(curl -sS -D - -o /dev/null --max-time 30 -X OPTIONS -H "Origin: $SITE" -H "Access-Control-Request-Method: POST" \
  -H "Access-Control-Request-Headers: content-type,x-origem-cliente" "$SITE/api/v1/predicoes" 2>/dev/null || true)
conferir "preflight CORS aceita a origem do site" contem "$preflight" "access-control-allow-origin: $SITE"

# ---------------------------------------------------------------------------
secao "Telas e bundle"
conferir "a tela inicial abre (200)" contem "$(status /)" "^200 text/html"
conferir "/painel abre o app" contem "$(status /painel)" "^200 text/html"
conferir "endereço que não existe responde 404, com o app" contem "$(status /pagina-que-nao-existe)" "^404 text/html"
conferir "módulo Estudos estático" contem "$(status /study/manifest.json)" "^200 application/json"
indice=$(curl -sS --max-time 30 "$SITE/" 2>/dev/null || true)
asset=$(grep -oE '/assets/[A-Za-z0-9._-]+\.js' <<<"$indice" | head -1)
if [[ -n $asset ]]; then
  conferir "nenhuma credencial dentro do bundle publicado" nega contem "$(curl -sS --max-time 60 "$SITE$asset" 2>/dev/null)" "(supabase|service_role|postgres://|postgresql://|eyJ[A-Za-z0-9_-]{10,}\.eyJ[A-Za-z0-9_-]{10,})"
else
  falha "index.html sem referência a /assets/*.js"
fi

# ---------------------------------------------------------------------------
if [[ -n $HOST ]]; then
  secao "Portas internas fechadas para a internet ($HOST)"
  porta_aberta() { timeout 5 bash -c "exec 3<>/dev/tcp/$1/$2" 2>/dev/null; }
  conferir "443 (HTTPS) aberta" porta_aberta "$HOST" 443
  abertas=$(mktemp -d)
  for porta in 8000 8080 8083 5432 55432; do
    { porta_aberta "$HOST" "$porta" && touch "$abertas/$porta"; } &
  done
  wait
  for porta in 8000 8080 8083 5432 55432; do
    conferir "porta $porta fechada" test ! -e "$abertas/$porta"
  done
  rm -rf "$abertas"
fi

echo
if ((FALHAS)); then
  echo "RESULTADO: $FALHAS verificação(ões) falharam." >&2
  exit 1
fi
echo "RESULTADO: tudo certo."
