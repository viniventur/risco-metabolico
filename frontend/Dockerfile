# syntax=docker/dockerfile:1

# ---- build: o Vite gera os arquivos estáticos ------------------------------------------------
# public/study/ já vem commitado (tools/nb2json.py roda local e no CI, nunca aqui): o build é só
# `vite build`, como o plano exige (§8.3).
FROM node:24-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --no-audit --no-fund
COPY . .
# As DUAS variáveis do front, e só estas (§4.3.4). A API fica na MESMA origem, atrás do nginx
# abaixo: VITE_API_URL é um caminho relativo e não existe CORS em produção.
ARG VITE_API_URL=/api/v1
ARG VITE_REPO_URL=https://github.com/viniventur/risco-metabolico
ENV VITE_API_URL=$VITE_API_URL VITE_REPO_URL=$VITE_REPO_URL
RUN npm run build

# ---- runtime: nginx sem root servindo o build e fazendo proxy da API ------------------------
# Imagem oficial do nginx que roda como usuário nginx (uid 101) e escuta na porta 8080.
FROM nginxinc/nginx-unprivileged:1.30-alpine
LABEL org.opencontainers.image.source="https://github.com/viniventur/risco-metabolico"
USER root
# Correções de segurança do Alpine publicadas depois da imagem base.
RUN apk upgrade --no-cache
USER 101
COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY seguranca.conf /etc/nginx/seguranca.conf
COPY seguranca-docs.conf /etc/nginx/seguranca-docs.conf
COPY --from=build /app/dist /usr/share/nginx/html
EXPOSE 8080
