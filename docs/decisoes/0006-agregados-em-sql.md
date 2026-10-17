# ADR 0006 — Agregados do painel definidos em SQL versionado

**Data:** 2026-10-17 · **Estado:** aceita · **Fase:** F8 · **Cita:** ADR 0005

## Contexto

Os 8 artefatos de `artifacts/agregados/` nasciam de pandas em `treino/agregar.py`. Com o Postgres como fonte da base (§4.3), a definição de cada agregado podia passar a ser legível, diffável e comparável — e a mesma coisa que o SQL do projeto já é para o schema e para a deriva.

## Decisão

Cada agregado é **um arquivo `.sql`** em `sql/agregados/` (mais `sql/pontos/altura-peso.sql`), com cabeçalho `@` e o contrato de saída longo de `docs/agregados.md`. `treino/agregar.py` vira um **materializador**: lê, executa, valida as 7 invariantes e serializa; nenhum cálculo acontece em Python ali. `congelar` materializa na mesma transação `REPEATABLE READ` do snapshot, e `agregados` isolado confere a carga contra `operacao.snapshot_treino.sha256_carga` antes de carimbar um `versao_dados`.

## O que este ADR NÃO revoga do ADR 0005

| Pergunta | Antes | Agora |
|---|---|---|
| Onde os filtros do painel são aplicados? | no FastAPI, em memória, sobre `base_painel.parquet` | **igual** |
| Um request de gráfico abre conexão com o banco? | não havia banco | **não** — nenhum `/painel/*`, `/registros` ou `/dimensoes` toca o Postgres |
| Quem produz `artifacts/agregados/*.json`? | pandas em `treino/agregar.py` | **`sql/agregados/*.sql`**, materializados pelo mesmo módulo |
| Papel desses JSON | snapshot sem filtro: regressão + fallback de build | **igual**, mais: o lado SQL do teste de paridade |
| De onde vem `base_painel.parquet`? | do CSV | do **snapshot congelado**, derivado por `treino/agregar.py::derivar_base_painel` |

ADR 0005 responde "cliente ou servidor?" (servidor); este responde "servidor ou banco?" (servidor). O banco é a fonte e o destino, nunca o caminho de um gráfico.

## Quem manda quando SQL e pandas discordam

O **SQL** — ele é a definição versionada; `dominio/agregados.py` é a implementação de runtime que precisa reproduzi-la. A exceção é o valor que também aparece no notebook de estudo (a célula de agregados): aí o notebook é a fonte de verdade dos números e os dois lados se ajustam a ele. Divergência real e permanente vira três coisas ao mesmo tempo: ADR, `-- @divergencia: NNNN` no cabeçalho e linha na tabela de `docs/agregados.md`.

## Consequências

- `test_paridade_agregados.py` compara os 8 JSON com `BasePainel.agregado(id, FiltroPainel())`: conjunto de linhas, ordem, `n` e supressão exatos, valores com `abs=1e-9`.
- `test_dominios_sql.py` confere os literais `VALUES` do SQL contra `dominio/regras.py`; o domínio de atividade vem de `dados.rotulos_escala`, não de literal.
- `tools/verificar-cabecalhos-sql.py` roda no CI: `@id` × nome, `@origem` existente, `@divergencia` com ADR, `@fonte` completo, `round(` proibido, classes de medida em três lugares.
- Duas queries exemplares do plano não executavam no Postgres 16 (função de janela em `VALUES`; `ORDER BY` ambíguo) e foram corrigidas nos arquivos, com a correção registrada em `docs/agregados.md`.
