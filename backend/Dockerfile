# backend/Dockerfile — contexto de build na RAIZ do repositório (plano, §11.2):
#   docker build -f backend/Dockerfile -t risco-metabolico-api:2.0.0 .
# O Dockerfile lê scripts/, artifacts/, sql/, models/ e data/processado/ — com contexto ./backend
# eles ficariam fora. Multi-stage, usuário não-root, HEALTHCHECK em /api/v1/health, --workers 1
# (cada worker carrega o pipeline inteiro; o plano gratuito costuma ter 512 MB — escalar é
# horizontal, não por worker).

# ---------- estágio 1: dependências com uv (sem dev, sem editable) ----------
FROM python:3.12-slim AS builder
COPY --from=ghcr.io/astral-sh/uv:0.13.1 /uv /bin/uv
ENV UV_COMPILE_BYTECODE=1 UV_LINK_MODE=copy UV_PYTHON_DOWNLOADS=never
WORKDIR /app/backend
COPY backend/pyproject.toml backend/uv.lock ./
# Só as dependências primeiro: a camada é cacheada enquanto o lock não mudar. O extra `operacao`
# (só o psycopg) deixa a imagem rodar o seed e a carga da referência de deriva na VPS (deploy.sh).
RUN uv sync --frozen --no-dev --no-install-project --extra operacao
COPY backend/app ./app
RUN uv sync --frozen --no-dev --no-editable --extra operacao

# ---------- estágio 2: os artefatos do release — modelo e snapshot congelado ----------
# Não existe PowerShell em python:3.12-slim: um RUN não executa .ps1. O script de verdade é
# scripts/baixar_modelo.py (stdlib pura): lê artifacts/manifest.json e, para o .pkl e para o
# snapshot, usa o arquivo se ele já estiver no contexto (models/ e data/processado/ estão fora do
# git mas presentes localmente) e, senão, baixa o asset do release v<versao> e confere o sha256
# (ADR 0004). Os .gitkeep garantem que as duas pastas existam no contexto mesmo vazias (CI).
FROM python:3.12-slim AS modelo
ARG REPO_GITHUB=viniventur/risco-metabolico
WORKDIR /app
COPY scripts/baixar_modelo.py scripts/
COPY artifacts/manifest.json artifacts/
COPY models/ models/
COPY data/processado/ data/processado/
RUN python scripts/baixar_modelo.py --manifesto artifacts/manifest.json --destino models \
        --snapshot-destino data/processado --repo "$REPO_GITHUB"

# ---------- estágio 3: runtime ----------
FROM python:3.12-slim
LABEL org.opencontainers.image.source="https://github.com/viniventur/risco-metabolico"
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
COPY --from=modelo --chown=app:app /app/data/processado /app/data/processado
# O CSV público e a citação: o seed roda a partir desta imagem na VPS (deploy.sh), e ele confere
# a citação de FONTE.md e grava os dois hashes em operacao.carga_fonte (§3.2).
COPY --chown=app:app data/bruto /app/data/bruto
# base_painel.parquet é derivado AQUI, do snapshot, sem banco (python -m app.treino.painel): a
# imagem é autocontida, local e na VPS — nenhum compose monta arquivo por cima dela.
RUN python -m app.treino.painel && chown -R app:app /app/data
USER app
EXPOSE 8000
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
    CMD python -c "import sys, urllib.request as u; sys.exit(0 if u.urlopen('http://127.0.0.1:8000/api/v1/health', timeout=4).status == 200 else 1)"
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000", "--workers", "1"]
