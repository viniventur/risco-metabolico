# Fonte do conjunto de dados

`obesity.csv` é uma **cópia literal** (2.111 registros × 17 colunas, 263.627 bytes, sha256 `6214bfbca5dab06768f903f5e1cf4e7d80169cda4f323a9fd2ff240783527665`) do conjunto público descrito abaixo. É o **insumo de semeadura** do Postgres (`python -m app.dados.seed`): o seed grava o hash deste arquivo e o hash deste `FONTE.md` em `operacao.carga_fonte`, e recusa semear se o bloco de citação estiver vazio ou `PENDENTE`.

Na interface do produto os registros são descritos como **fictícios/sintéticos, sem nenhum indivíduo real** — e as duas afirmações são verdadeiras ao mesmo tempo: os autores do conjunto declaram que **77% dos registros foram gerados sinteticamente** (ferramenta Weka, filtro SMOTE) e 23% coletados por formulário em plataforma web. Nenhuma leitura epidemiológica das distribuições é válida.

## Citação

Bloco copiado da página do conjunto no repositório público (citação oferecida pela própria página) e do registro Crossref do artigo de origem. **É o único lugar do repositório onde os nomes dos autores podem aparecer** (plano, §3.2/§3.3); o sub-bloco `autores-inicio`/`autores-fim` é o que `scripts/verificar-proveniencia.ps1` e `tests/test_proveniencia.py` leem para garantir que esses nomes não foram copiados para nenhum outro arquivo.

<!-- citacao-inicio -->
Estimation of Obesity Levels Based On Eating Habits and Physical Condition [Dataset]. (2019). UCI Machine Learning Repository. https://doi.org/10.24432/C5H31Z

Artigo de origem do conjunto: <!-- autores-inicio -->Fabio Mendoza Palechor; Alexis de la Hoz Manotas<!-- autores-fim -->. "Dataset for estimation of obesity levels based on eating habits and physical condition in individuals from Colombia, Peru and Mexico". Data in Brief, v. 25, art. 104344, 2019. https://doi.org/10.1016/j.dib.2019.104344

Licença: Creative Commons Attribution 4.0 International (CC BY 4.0).
<!-- citacao-fim -->

## Ficha

| Campo | Valor |
|---|---|
| Nome do conjunto | Estimation of Obesity Levels Based On Eating Habits and Physical Condition |
| Instituição que publica | UCI Machine Learning Repository (University of California, Irvine) |
| Identificador no repositório | 544 |
| URL | https://archive.ics.uci.edu/dataset/544/estimation+of+obesity+levels+based+on+eating+habits+and+physical+condition |
| DOI do conjunto | 10.24432/C5H31Z |
| DOI do artigo de origem | 10.1016/j.dib.2019.104344 (Data in Brief, v. 25, 2019) |
| Licença | CC BY 4.0 |
| Ano | 2019 (doado ao repositório em 26/08/2019) |
| Tamanho declarado | 2.111 instâncias; a página lista 16 atributos de entrada e o texto descritivo fala em 17 colunas — a diferença é a coluna-alvo |
| Registros sintéticos | 77%, gerados com Weka + filtro SMOTE, conforme declarado pelos autores; 23% coletados por plataforma web |
| Conferido em | 2026-10-17, na página do conjunto e no registro Crossref do DOI do artigo |

## O que foi alterado em relação ao original

Nada no conteúdo. O arquivo foi renomeado de `Obesity.csv` para `obesity.csv` (nome minúsculo, convenção do repositório); os 2.111 registros, as 17 colunas, a ordem das linhas e os bytes são os do arquivo recebido. Toda transformação (renomeação de colunas, arredondamento das escalas, tradução dos valores) acontece em código versionado — `backend/app/dominio/features.py::preparar_base` — e está descrita em [`../../docs/dicionario-de-dados.md`](../../docs/dicionario-de-dados.md).
