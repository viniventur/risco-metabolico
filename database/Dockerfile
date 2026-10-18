# syntax=docker/dockerfile:1

# Banco da Triagem Metabólica: o Postgres oficial com o schema, os grants e o papel da API DENTRO da
# imagem. Contexto de build = raiz do repositório (o Dockerfile lê sql/):
#   docker build -f database/Dockerfile -t risco-metabolico-banco .
#
# São os MESMOS sql/schema.sql e sql/grants.sql do plano (§4.3.9): o initdb os aplica por psql na
# primeira subida (volume vazio), e o scripts/deploy.sh os reaplica a cada publicação — os três
# arquivos são idempotentes. Na VPS não há código-fonte: o que o banco lê ao nascer vem daqui, na
# versão que passou nos testes do CI. Nenhuma alteração de schema pelo painel ou à mão (risco 22).
FROM postgres:16-alpine
LABEL org.opencontainers.image.source="https://github.com/viniventur/risco-metabolico"

COPY --chmod=644 sql/schema.sql /docker-entrypoint-initdb.d/10-schema.sql
COPY --chmod=644 sql/grants.sql /docker-entrypoint-initdb.d/20-grants.sql
COPY --chmod=755 sql/usuario-api.sh /docker-entrypoint-initdb.d/30-usuario-api.sh
