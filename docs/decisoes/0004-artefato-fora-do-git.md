# ADR 0004 — O artefato de modelo fica fora do git

**Data:** 2026-10-17 · **Estado:** aceita · **Fase:** F5

## Contexto

O `.pkl` do XGBoost tem alguns megabytes e muda a cada retreino. Os 3,5 MB do legado seriam toleráveis uma vez, mas o histórico do git incha a cada versão — e é justamente o retreino que este projeto quer tornar barato. Um `.pkl` também não faz *diff*: ninguém responde "o que mudou entre 2.0.0 e 2.1.0" olhando o binário.

## Decisão

Três famílias de arquivo, com destinos diferentes:

| Família | Onde | Por quê |
|---|---|---|
| `models/modelo-X.Y.Z.pkl` — binário opaco e pesado | **fora do git** (`.gitignore`), publicado como **GitHub Release asset** (`vX.Y.Z`) | muda a cada retreino, não faz diff |
| `data/processado/snapshot-<versao_dados>.parquet` — o `SELECT` congelado | **fora do git**, publicado como asset do **mesmo release** | regenerável por `congelar` e descrito por `sha256_snapshot`; a imagem publicada o baixa para derivar `base_painel.parquet` sem banco (`python -m app.treino.painel`), porque o provedor constrói a imagem a partir do git e não há volume |
| `artifacts/` — manifest, métricas, agregados, perfil de distribuição | **git** | metadados leves e textuais; fazem diff; respondem "o que mudou" sem baixar o binário |
| `sql/` — schema, agregados, deriva | **git** | texto que descreve dado, versionado como código |

O backend lê `models/` e `artifacts/` por variável de ambiente (`MODELOS_DIR`, `ARTEFATOS_DIR`): montar um volume no Docker não exige tocar em código.

## Integridade de transporte vs. reprodutibilidade

- `manifest.sha256` é o hash **do arquivo** e serve a uma coisa só: conferir o download do release asset (`scripts/baixar_modelo.py`, stdlib pura, roda dentro da imagem `python:3.12-slim`). Em produção (`EXIGIR_INTEGRIDADE=true`) um hash divergente é 503; em desenvolvimento, aviso.
- `manifest.sha256_predicoes_ouro` é o critério de **reprodutibilidade**: `python -m app.treino verificar` retreina sobre o mesmo snapshot congelado e compara o sha256 das probabilidades (6 casas) sobre `backend/tests/dados_ouro/entradas.json`, mais as métricas com tolerância `1e-6`. Comparar o sha256 do `.pkl` seria fisicamente impossível (o dump do XGBoost carrega buffers variáveis, o joblib grava versões no cabeçalho, o dict de topo tem `treinado_em`) e viraria um portão que nunca passa.

## Como o artefato é publicado

1. Local: `gh release create v2.0.0 models/modelo-2.0.0.pkl data/processado/snapshot-<versao_dados>.parquet --title "modelo 2.0.0"` (o README traz o comando). O snapshot vai junto: é o segundo asset que a imagem publicada baixa.
2. Reprodutível em CI: `.github/workflows/release-modelo.yml` (`workflow_dispatch` com a versão) sobe um Postgres, semeia, congela, treina, verifica e publica o asset — e anexa o manifest produzido como artefato do run, para ser commitado. Um modelo treinado em outra máquina tem outro `sha256` de arquivo; o manifest commitado tem de ser o do artefato publicado.
3. A imagem Docker baixa os assets no build (`baixar_modelo.py` lê `artifacts/manifest.json`, baixa `arquivo` e, com `--snapshot-destino`, o snapshot do release `v<versao>`, e confere os dois `sha256`); em seguida `python -m app.treino.painel` deriva `base_painel.parquet` do snapshot, sem banco. Localmente, com o `.pkl` em `models/` e o snapshot em `data/processado/`, o script só confere os hashes e não baixa nada.

## Consequências

- `models/*.pkl` e `data/processado/` estão no `.gitignore`; o snapshot é regenerável (`congelar`) e descrito pelo `versao_dados` do manifest.
- O manifest embutido no `.pkl` (para o artefato ser autodescritivo fora do repositório) viaja com `sha256: null` — ele não pode conter o hash do próprio arquivo.
- Trocar o algoritmo servido (por exemplo, LightGBM, 1 MB contra 3,5 MB) é mudar o vencedor no treino e o manifest, não reescrever a API.
