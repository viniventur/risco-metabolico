-- @id:              piramide-idade-sexo
-- @titulo:          Pirâmide etária por sexo, com a fração com diabetes
-- @mede:            Para cada combinação de faixa etária e sexo: quantas respostas, quanto isso
--                   representa do total, quantas são de quem tem diabetes e a fração com diabetes
--                   dentro do grupo, sobre a base inteira.
-- @origem:          study/02_triagem_de_diabetes.ipynb, seção "Exploração" (prevalência por faixa
--                   etária e sexo); pirâmide da Visão Geral de diabetes
-- @fonte:           dados.registros_diabetes
-- @dimensao:        faixa_etaria:inteiro
-- @dimensao:        sexo:texto
-- @medida:          contagem:contagem
-- @medida:          pct:proporcao
-- @medida:          n_diabetes:contagem
-- @medida:          prevalencia:proporcao
-- @amostra_minima:  15
-- @suprime_quando:  n < 15 (só a prevalencia)
-- @divergencia:     -

WITH dominio AS (
    -- As 13 faixas (DOMINIOS["Faixa_Etaria"]) cruzadas com os dois sexos (DOMINIOS["Sexo"]), na
    -- ordem da escala e depois na do sexo. tests/diabetes/test_dominios_sql_diabetes.py confere.
    SELECT
        i.faixa_etaria,
        s.sexo,
        s.ord AS ord_sexo
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
    ) AS i (faixa_etaria)
    CROSS JOIN (
        VALUES
        ('Feminino', 1),
        ('Masculino', 2)
    ) AS s (sexo, ord)
),

contagem AS (
    SELECT
        faixa_etaria,
        sexo,
        count(*) AS n,
        count(*) FILTER (WHERE diabetes = 'Sim') AS n_diabetes
    FROM dados.registros_diabetes
    GROUP BY faixa_etaria, sexo
),

completo AS (
    -- O pct é sobre o TOTAL, não sobre a faixa: é o que uma pirâmide desenha.
    SELECT
        d.faixa_etaria,
        d.sexo,
        d.ord_sexo,
        coalesce(c.n, 0) AS n,
        coalesce(c.n_diabetes, 0) AS n_diabetes,
        sum(coalesce(c.n, 0)) OVER () AS total
    FROM dominio AS d
    LEFT JOIN contagem AS c ON d.faixa_etaria = c.faixa_etaria AND d.sexo = c.sexo
)

SELECT
    'piramide-idade-sexo'::text AS agregado_id,
    (row_number() OVER (ORDER BY completo.faixa_etaria, completo.ord_sexo, m.ordem_medida))::integer AS ordem,
    'faixa_etaria'::text AS dim1_nome,
    completo.faixa_etaria::text AS dim1_valor,
    'sexo'::text AS dim2_nome,
    completo.sexo AS dim2_valor,
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
ORDER BY completo.faixa_etaria, completo.ord_sexo, m.ordem_medida;
