-- @id:              imc-por-genero
-- @titulo:          IMC médio por gênero
-- @mede:            Média do IMC (peso dividido pela altura ao quadrado) de cada gênero, sobre
--                   a base inteira, sem filtro.
-- @origem:          docs/agregados.md, seção "Visão Geral"; visual <ImcPorGenero> (7.3)
-- @fonte:           dados.registros_triagem
-- @dimensao:        genero:texto
-- @medida:          imc_medio:media_limitada
-- @amostra_minima:  15
-- @suprime_quando:  n < 15
-- @divergencia:     -

-- O visual estava sem título no painel de referência; aqui é "IMC Médio por Gênero" (7.3).
WITH base AS (
    -- altura * altura, não altura ^ 2: um único arredondamento, idêntico ao x*x do numpy.
    SELECT
        genero,
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
        avg(imc) AS imc_medio,
        -- count(imc), não count(*): n é o número de observações que entraram na média.
        count(imc) AS n
    FROM base
    GROUP BY genero
)

SELECT
    'imc-por-genero'::text AS agregado_id,
    (row_number() OVER (ORDER BY d.ord))::integer AS ordem,
    'genero'::text AS dim1_nome,
    d.genero AS dim1_valor,
    NULL::text AS dim2_nome,
    NULL::text AS dim2_valor,
    'imc_medio'::text AS medida,
    CASE WHEN coalesce(a.n, 0) >= 15 THEN a.imc_medio END AS valor,
    NULL::text AS valor_texto,
    coalesce(a.n, 0)::bigint AS n,
    (coalesce(a.n, 0) < 15) AS suprimido
FROM dominio AS d
LEFT JOIN agrupado AS a ON d.genero = a.genero
ORDER BY d.ord;
