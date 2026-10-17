# Agregados do painel em SQL versionado

Os 8 artefatos de `artifacts/agregados/` nascem de **SQL versionado**, um arquivo por artefato, materializados por `python -m app.treino congelar` (ou `agregados`, com a conferência de carga) na **mesma transação `REPEATABLE READ`** do snapshot de treino — o `versao_dados` carimbado em cada JSON descreve, de fato, as linhas lidas.

O que eles **não** são: a fonte do painel em runtime. Nenhum endpoint `/painel/*`, `/registros` ou `/dimensoes` toca o Postgres; o runtime serve `data/processado/base_painel.parquet` de memória (ADR 0005/0006). Os JSON servem ao **teste de paridade SQL × pandas** (`backend/tests/test_paridade_agregados.py`) e como fallback de build.

## Estrutura e regra de nome

| Arquivo | Artefato | O que mede |
|---|---|---|
| `sql/agregados/resumo.sql` | `resumo.json` | count(*), médias de idade/altura/peso, **moda** da faixa (com desempate por nome) |
| `sql/agregados/por-nivel.sql` | `por-nivel.json` | contagem e % por faixa, em ordem clínica, domínio completo |
| `sql/agregados/imc-por-genero.sql` | `imc-por-genero.json` | IMC médio por gênero |
| `sql/agregados/imc-por-atividade-genero.sql` | `imc-por-atividade-genero.json` | IMC médio por frequência de atividade × gênero (domínio de `dados.rotulos_escala`) |
| `sql/agregados/imc-por-alcool.sql` | `imc-por-alcool.json` | IMC médio por consumo de álcool ("Sempre", n=1, é suprimido) |
| `sql/agregados/caloricos.sql` | `caloricos.json` | contagem e % de consumo calórico frequente |
| `sql/agregados/genero.sql` | `genero.json` | por gênero: n, percentual, IMC médio, faixa predominante — 4 linhas por gênero |
| `sql/pontos/altura-peso.sql` | `pontos-altura-peso.json` | **projeção** de registros (altura, peso, imc, nivel), contrato próprio |

O `stem` do `.sql` **é** o `@id` e **é** o nome do `.json` (a projeção leva o prefixo `pontos-`). O materializador falha se o `@id` divergir do nome do arquivo; `tools/verificar-cabecalhos-sql.py` e `test_paridade_agregados.py` afirmam que 7 + 1 arquivos SQL produzem exatamente os 8 JSON, sem sobra nem falta.

## Cabeçalho `@`

Todo `.sql` abre com um bloco `-- @chave: valor`, parseado pelo materializador (não é decoração): `@id`, `@titulo`, `@mede` (frase que um leitor não técnico entende), `@origem` (arquivo ou seção de onde a definição vem), `@fonte` (tabelas lidas; a query só pode referenciar o que declarou), `@dimensao nome:tipo` (`texto` | `inteiro`), `@medida nome:classe` (`contagem` | `media_limitada` | `proporcao` | `texto`), `@amostra_minima`, `@suprime_quando`, `@divergencia` (`-` ou o número de um ADR). Linhas de continuação começam com `--` e dois ou mais espaços.

## Contrato de saída — formato longo único

Toda query de `sql/agregados/` devolve exatamente estas colunas, nesta ordem e **com alias** (o materializador compara os nomes): `agregado_id text`, `ordem integer`, `dim1_nome`/`dim1_valor`/`dim2_nome`/`dim2_valor` (`text`, nuláveis), `medida text`, `valor double precision`, `valor_texto text`, `n bigint`, `suprimido boolean`.

Invariantes, checadas linha a linha pelo materializador (`ContratoViolado`, sempre fatal):

1. `agregado_id` igual ao `@id`.
2. `dimK_nome` não nulo ⟺ `dimK_valor` não nulo; dimensões preenchem da 1 para a 2.
3. O conjunto de `dimK_nome` bate com `@dimensao` e o de `medida` com `@medida`.
4. `suprimido = true` ⟹ `valor` e `valor_texto` nulos; `suprimido = false` ⟹ exatamente um deles não nulo, **ou** ambos nulos com `n = 0` (grupo vazio legítimo do domínio completo).
5. `(dim1_valor, dim2_valor, medida)` é único.
6. `ordem` é `1..N`, sem repetição e sem lacuna, de `row_number()` sobre um `ORDER BY` explícito.
7. Nenhum `valor` é `NaN` ou `±Infinity` (`allow_nan=False` na escrita).

Mais: teto de 2.500 linhas (a projeção carrega as 2.111 da base) e 300 KB por arquivo. A projeção de pontos tem invariantes próprias: contagem igual à da tabela, `imc` conferido contra `peso / (altura × altura)`, nenhum nulo, `nivel` no domínio.

No JSON, as dimensões viram chaves nomeadas e **valor de dimensão é sempre string**; o `tipo` em `dimensoes` é o que autoriza o front a converter `"0"` para número no eixo (eixo pelo inteiro, rótulo pelo texto).

## Regras que valem em todo `.sql` (e no pandas que os reproduz)

- Cast para `double precision` **na coluna, no CTE mais interno**, antes de qualquer agregação (`avg(numeric)` acumula em decimal e não reproduz `float64`).
- `n = count(<coluna da medida>)`, nunca `count(*)`, nas médias.
- Domínio explícito: `LEFT JOIN` contra um CTE de domínio (ou contra `dados.rotulos_escala`), para grupo ausente virar `n = 0`.
- `ORDER BY` explícito; texto com `COLLATE "C"` (= ordenação por código de ponto do Python).
- `nullif(denominador, 0)`: base vazia dá `NULL`, não `division_by_zero`.
- `altura * altura`, não `altura ^ 2`: um único arredondamento, idêntico ao `x*x` do numpy.
- **Nenhum `round(`**: arredondar é apresentação e mora em `format/ptBR.ts` (lint do CI).
- A sessão de agregação roda com `timezone = 'UTC'`, `extra_float_digits = 3` e `max_parallel_workers_per_gather = 0`.

## Duas correções sobre o SQL do plano

Ao executar as queries exemplares do plano contra o Postgres 16, duas delas não rodavam; os arquivos deste repositório trazem a forma corrigida, e o teste de paridade cobre as duas:

| Query | Defeito | Correção |
|---|---|---|
| `por-nivel.sql` | `sum(n) OVER ()` dentro de `VALUES` — função de janela não é permitida em `VALUES` | o total sai por janela no CTE `completo` (`sum(coalesce(c.n, 0)) OVER () AS total`) e o `VALUES` só o consome |
| `por-nivel.sql` | `ORDER BY ord, m.ord` ambíguo (o CTE e a lista de medidas tinham `ord`) | `completo.ord` qualificado e a coluna de medida renomeada para `ordem_medida` |

Também: o exemplo do plano emitia colunas sem alias (`SELECT 'x'::text, ...`); o Postgres devolve `?column?` e o contrato exige os nomes — todo arquivo aliás as 11 colunas.

## Tolerância e divergências

`abs = 1e-9`, sem componente relativa, para `media_limitada` e `proporcao`; igualdade exata para `contagem` e `texto`. Com magnitude máxima 200 e n = 2.111, o pior caso da soma sequencial do Postgres é ≈ 9×10⁻¹¹; `1e-9` dá dez vezes de folga. As 15 causas de divergência SQL × pandas e o lado em que cada uma se ajusta estão na §10.9.1 do plano e são o critério de revisão: proibido aumentar a tolerância, `xfail` por id ou comentar asserção.

| `@divergencia` | Agregado | ADR | Situação |
|---|---|---|---|
| — | — | — | nenhuma divergência aceita até agora |
