# syntax=docker/dockerfile:1

# Pacote de deploy: os únicos arquivos que a VPS recebe além das imagens do app (nada de
# código-fonte). O CI publica este pacote no GitHub Container Registry junto com as imagens, e o
# scripts/deploy.sh da VPS tira os arquivos dele (docker create + docker cp), sem nunca rodá-lo.
#
# Montado a partir da raiz do repositório:  docker build -f scripts/pacote.Dockerfile .
FROM scratch
LABEL org.opencontainers.image.source="https://github.com/viniventur/risco-metabolico"
# O deploy.sh apaga as imagens antigas do app pelo projeto do Compose; o pacote entra na mesma limpeza.
LABEL com.docker.compose.project="risco-metabolico"
COPY docker-compose.yml docker-compose.producao.yml scripts/deploy.sh /pacote/
# O docker create exige um comando, mas o pacote nunca é executado.
CMD ["/pacote/nunca-roda"]
