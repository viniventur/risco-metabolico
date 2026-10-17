-- @id:              caloricos
-- @titulo:          Consumo frequente de alimentos calóricos
-- @mede:            Quantos registros declaram consumo frequente de alimentos muito calóricos
--                   (Sim/Não), e quanto cada resposta representa do total.
-- @origem:          docs/agregados.md, seção "Visão Geral"; visual <DonutCaloricos> (7.3)
-- @fonte:           dados.registros_triagem
-- @dimensao:        caloricos:texto
-- @medida:          contagem:contagem
-- @medida:          pct:proporcao
-- @amostra_minima:  -
-- @divergencia:     -

WITH dominio AS (
    SELECT *
    FROM (
        VALUES
        ('Não', 1),
        ('Sim', 2)
    ) AS d (caloricos, ord)
),

contagem AS (
    SELECT
        consumo_calorico_frequente AS caloricos,
        count(*) AS n
    FROM dados.registros_triagem
    GROUP BY consumo_calorico_frequente
),

completo AS (
    SELECT
        d.caloricos,
        d.ord,
        coalesce(c.n, 0) AS n,
        sum(coalesce(c.n, 0)) OVER () AS total
    FROM dominio AS d
    LEFT JOIN contagem AS c ON d.caloricos = c.caloricos
)

SELECT
    'caloricos'::text AS agregado_id,
    (row_number() OVER (ORDER BY completo.ord, m.ordem_medida))::integer AS ordem,
    'caloricos'::text AS dim1_nome,
    completo.caloricos AS dim1_valor,
    NULL::text AS dim2_nome,
    NULL::text AS dim2_valor,
    m.nome AS medida,
    m.valor AS valor,
    NULL::text AS valor_texto,
    completo.n::bigint AS n,
    FALSE AS suprimido
FROM completo
CROSS JOIN LATERAL (
    VALUES
    ('contagem', completo.n::double precision, 1),
    ('pct', 100.0 * completo.n::double precision / nullif(completo.total, 0)::double precision, 2)
) AS m (nome, valor, ordem_medida)
ORDER BY completo.ord, m.ordem_medida;
