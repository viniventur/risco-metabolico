-- @id:              prevalencia-por-idade
-- @titulo:          Prevalência de diabetes por faixa etária
-- @mede:            Para cada faixa etária de 5 anos: quantas respostas, quanto isso representa do
--                   total, quantas são de quem tem diabetes e a fração com diabetes dentro da faixa
--                   (a prevalência na base), sobre a base inteira.
-- @origem:          study/02_triagem_de_diabetes.ipynb, seção "Exploração" (prevalência por faixa
--                   etária); gráfico de prevalência por idade da Visão Geral de diabetes
-- @fonte:           dados.registros_diabetes
-- @dimensao:        faixa_etaria:inteiro
-- @medida:          contagem:contagem
-- @medida:          pct:proporcao
-- @medida:          n_diabetes:contagem
-- @medida:          prevalencia:proporcao
-- @amostra_minima:  15
-- @suprime_quando:  n < 15 (só a prevalencia)
-- @divergencia:     -

WITH dominio AS (
    -- As 13 faixas de app/diabetes/dominio/regras.py::DOMINIOS["Faixa_Etaria"], na ordem da escala.
    -- O rótulo ("18 a 24 anos") NÃO entra: o contrato não carrega rótulo de dimensão (docs/agregados.md).
    -- tests/diabetes/test_dominios_sql_diabetes.py confere estes literais.
    SELECT *
    FROM (
        VALUES
        (1),
        (2),
        (3),
        (4),
        (5),
        (6),
        (7),
        (8),
        (9),
        (10),
        (11),
        (12),
        (13)
    ) AS d (faixa_etaria)
),

contagem AS (
    SELECT
        faixa_etaria,
        count(*) AS n,
        count(*) FILTER (WHERE diabetes = 'Sim') AS n_diabetes
    FROM dados.registros_diabetes
    GROUP BY faixa_etaria
),

completo AS (
    -- LEFT JOIN contra o domínio: uma faixa ausente vira linha com n=0, não linha faltante.
    SELECT
        d.faixa_etaria,
        coalesce(c.n, 0) AS n,
        coalesce(c.n_diabetes, 0) AS n_diabetes,
        sum(coalesce(c.n, 0)) OVER () AS total
    FROM dominio AS d
    LEFT JOIN contagem AS c ON d.faixa_etaria = c.faixa_etaria
)

SELECT
    'prevalencia-por-idade'::text AS agregado_id,
    (row_number() OVER (ORDER BY completo.faixa_etaria, m.ordem_medida))::integer AS ordem,
    'faixa_etaria'::text AS dim1_nome,
    completo.faixa_etaria::text AS dim1_valor,
    NULL::text AS dim2_nome,
    NULL::text AS dim2_valor,
    m.nome AS medida,
    m.valor AS valor,
    NULL::text AS valor_texto,
    m.n::bigint AS n,
    m.suprimido AS suprimido
FROM completo
CROSS JOIN LATERAL (
    VALUES
    ('contagem', completo.n::double precision, completo.n, FALSE, 1),
    (
        'pct',
        100.0 * completo.n::double precision / nullif(completo.total, 0)::double precision,
        completo.n, FALSE, 2
    ),
    ('n_diabetes', completo.n_diabetes::double precision, completo.n_diabetes, FALSE, 3),
    (
        'prevalencia',
        CASE
            WHEN completo.n >= 15
                THEN 100.0 * completo.n_diabetes::double precision / completo.n::double precision
        END,
        completo.n, (completo.n < 15), 4
    )
) AS m (nome, valor, n, suprimido, ordem_medida)
ORDER BY completo.faixa_etaria, m.ordem_medida;
