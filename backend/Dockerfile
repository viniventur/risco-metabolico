# backend/Dockerfile — contexto de build na RAIZ do repositório (plano, §11.2):
#   docker build -f backend/Dockerfile -t risco-metabolico-api:2.0.0 .
# O Dockerfile lê scripts/, artifacts/, sql/ e models/ — com contexto ./backend eles ficariam fora.
# Multi-stage, usuário não-root, HEALTHCHECK em /api/v1/health, --workers 1 (cada worker carrega
# o pipeline inteiro; o plano gratuito costuma ter 512 MB — escalar é horizontal, não por worker).

# ---------- estágio 1: dependências com uv (sem dev, sem editable) ----------
FROM python:3.12-slim AS builder
COPY --from=ghcr.io/astral-sh/uv:0.13.1 /uv /bin/uv
ENV UV_COMPILE_BYTECODE=1 UV_LINK_MODE=copy UV_PYTHON_DOWNLOADS=never
WORKDIR /app/backend
COPY backend/pyproject.toml backend/uv.lock ./
# Só as dependências primeiro: a camada é cacheada enquanto o lock não mudar.
RUN uv sync --frozen --no-dev --no-install-project
COPY backend/app ./app
RUN uv sync --frozen --no-dev --no-editable

# ---------- estágio 2: o artefato de modelo ----------
# Não existe PowerShell em python:3.12-slim: um RUN não executa .ps1. O script de verdade é
# scripts/baixar_modelo.py (stdlib pura): lê artifacts/manifest.json, usa o .pkl se ele já
# estiver no contexto (models/, ignorado pelo git mas presente localmente) e, senão, baixa o
# asset do release v<versao> e confere o sha256 (ADR 0004). models/.gitkeep garante que a
# pasta exista no contexto mesmo sem .pkl (CI).
FROM python:3.12-slim AS modelo
ARG REPO_GITHUB=viniventur/risco-metabolico
WORKDIR /app
COPY scripts/baixar_modelo.py scripts/
COPY artifacts/manifest.json artifacts/
COPY models/ models/
RUN python scripts/baixar_modelo.py --manifesto artifacts/manifest.json --destino models \
        --repo "$REPO_GITHUB"

# ---------- estágio 3: runtime ----------
FROM python:3.12-slim
ENV PYTHONDONTWRITEBYTECODE=1 PYTHONUNBUFFERED=1 \
    PATH="/app/backend/.venv/bin:$PATH" \
    MODELOS_DIR=/app/models ARTEFATOS_DIR=/app/artifacts DADOS_DIR=/app/data/processado \
    SQL_DIR=/app/sql
RUN groupadd --system app && useradd --system --gid app --home-dir /app --shell /usr/sbin/nologin app
WORKDIR /app/backend
COPY --from=builder --chown=app:app /app/backend/.venv ./.venv
COPY --chown=app:app backend/app ./app
# artifacts/ (manifest, agregados, métricas, perfil) e sql/ (deriva é lida em RUNTIME por SQL_DIR).
COPY --chown=app:app artifacts /app/artifacts
COPY --chown=app:app sql /app/sql
COPY --from=modelo --chown=app:app /app/models /app/models
# base_painel.parquet entra por volume (compose) ou por COPY se a imagem for autocontida:
#   COPY --chown=app:app data/processado/base_painel.parquet /app/data/processado/
RUN mkdir -p /app/data/processado && chown -R app:app /app/data
USER app
EXPOSE 8000
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
    CMD python -c "import sys, urllib.request as u; sys.exit(0 if u.urlopen('http://127.0.0.1:8000/api/v1/health', timeout=4).status == 200 else 1)"
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000", "--workers", "1"]
