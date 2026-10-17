-- @id:              genero
-- @titulo:          Divisão por gênero
-- @mede:            Para cada gênero: quantos registros, a fração do total, o IMC médio e a
--                   faixa predominante (moda, desempate por nome), sobre a base inteira.
-- @origem:          docs/agregados.md, seção "Visão Geral"; <PainelGenero> e <AnaliseGenero> (7.3)
-- @fonte:           dados.registros_triagem
-- @dimensao:        genero:texto
-- @medida:          n:contagem
-- @medida:          percentual:proporcao
-- @medida:          imc_medio:media_limitada
-- @medida:          nivel_predominante:texto
-- @amostra_minima:  15
-- @suprime_quando:  n < 15 (só o imc_medio)
-- @divergencia:     -

-- Os dois visuais de HTML customizado do painel de referência (análise por gênero) viram JSON
-- tipado — nunca dangerouslySetInnerHTML (7.3). Uma medida por linha: quatro linhas por gênero.
WITH base AS (
    SELECT
        genero,
        nivel_obesidade,
        peso::double precision / nullif(altura::double precision * altura::double precision, 0) AS imc
    FROM dados.registros_triagem
),

dominio AS (
    SELECT *
    FROM (
        VALUES
        ('Feminino', 1),
        ('Masculino', 2)
    ) AS d (genero, ord)
),

agrupado AS (
    SELECT
        genero,
        count(*) AS n,
        count(imc) AS n_imc,
        avg(imc) AS imc_medio
    FROM base
    GROUP BY genero
),

modas AS (
    SELECT
        genero,
        nivel_obesidade,
        count(*) AS n,
        row_number() OVER (
            PARTITION BY genero
            ORDER BY count(*) DESC, nivel_obesidade COLLATE "C"
        ) AS posicao
    FROM base
    GROUP BY genero, nivel_obesidade
),

completo AS (
    SELECT
        d.genero,
        d.ord,
        coalesce(a.n, 0) AS n,
        coalesce(a.n_imc, 0) AS n_imc,
        a.imc_medio,
        sum(coalesce(a.n, 0)) OVER () AS total,
        mo.nivel_obesidade AS predominante,
        coalesce(mo.n, 0) AS n_predominante
    FROM dominio AS d
    LEFT JOIN agrupado AS a ON d.genero = a.genero
    LEFT JOIN modas AS mo ON d.genero = mo.genero AND mo.posicao = 1
)

SELECT
    'genero'::text AS agregado_id,
    (row_number() OVER (ORDER BY completo.ord, m.ordem_medida))::integer AS ordem,
    'genero'::text AS dim1_nome,
    completo.genero AS dim1_valor,
    NULL::text AS dim2_nome,
    NULL::text AS dim2_valor,
    m.nome AS medida,
    m.valor AS valor,
    m.valor_texto AS valor_texto,
    m.n::bigint AS n,
    m.suprimido AS suprimido
FROM completo
CROSS JOIN LATERAL (
    VALUES
    ('n', completo.n::double precision, NULL::text, completo.n, FALSE, 1),
    (
        'percentual',
        100.0 * completo.n::double precision / nullif(completo.total, 0)::double precision,
        NULL::text, completo.n, FALSE, 2
    ),
    (
        'imc_medio',
        CASE WHEN completo.n_imc >= 15 THEN completo.imc_medio END,
        NULL::text, completo.n_imc, (completo.n_imc < 15), 3
    ),
    ('nivel_predominante', NULL::double precision, completo.predominante, completo.n_predominante, FALSE, 4)
) AS m (nome, valor, valor_texto, n, suprimido, ordem_medida)
ORDER BY completo.ord, m.ordem_medida;
