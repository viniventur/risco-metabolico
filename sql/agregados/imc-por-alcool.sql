-- @id:              imc-por-alcool
-- @titulo:          IMC médio por consumo de álcool
-- @mede:            Média do IMC (peso dividido pela altura ao quadrado) de cada nível de
--                   consumo de álcool, sobre a base inteira. Grupos com menos de 15 registros
--                   são suprimidos ("Sempre" tem 1).
-- @origem:          docs/agregados.md, seção "Visão Geral"; visual <ImcPorAlcool> (7.3)
-- @fonte:           dados.registros_triagem
-- @dimensao:        alcool:texto
-- @medida:          imc_medio:media_limitada
-- @amostra_minima:  15
-- @suprime_quando:  n < 15
-- @divergencia:     -

WITH base AS (
    SELECT
        consumo_alcool AS alcool,
        peso::double precision / nullif(altura::double precision * altura::double precision, 0) AS imc
    FROM dados.registros_triagem
),

dominio AS (
    -- A ordem é a lexicográfica por código de ponto (COLLATE "C"), a mesma de
    -- dominio/regras.py::DOMINIOS; o gráfico reordena por valor, o dado não.
    SELECT *
    FROM (
        VALUES
        ('Frequentemente', 1),
        ('Não', 2),
        ('Sempre', 3),
        ('Às vezes', 4)
    ) AS d (alcool, ord)
),

agrupado AS (
    SELECT
        alcool,
        avg(imc) AS imc_medio,
        count(imc) AS n
    FROM base
    GROUP BY alcool
)

SELECT
    'imc-por-alcool'::text AS agregado_id,
    (row_number() OVER (ORDER BY d.ord))::integer AS ordem,
    'alcool'::text AS dim1_nome,
    d.alcool AS dim1_valor,
    NULL::text AS dim2_nome,
    NULL::text AS dim2_valor,
    'imc_medio'::text AS medida,
    CASE WHEN coalesce(a.n, 0) >= 15 THEN a.imc_medio END AS valor,
    NULL::text AS valor_texto,
    coalesce(a.n, 0)::bigint AS n,
    (coalesce(a.n, 0) < 15) AS suprimido
FROM dominio AS d
LEFT JOIN agrupado AS a ON d.alcool = a.alcool
ORDER BY d.ord;
