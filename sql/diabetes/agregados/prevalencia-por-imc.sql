-- @id:              prevalencia-por-imc
-- @titulo:          Prevalência de diabetes por faixa de IMC
-- @mede:            Para cada faixa de IMC da OMS (abaixo do peso, peso ideal, sobrepeso, obesidade
--                   graus I, II e III): quantas respostas, quanto isso representa do total, quantas
--                   são de quem tem diabetes e a fração com diabetes dentro da faixa, sobre a base
--                   inteira.
-- @origem:          study/02_triagem_de_diabetes.ipynb, seção "Exploração" (prevalência por faixa de
--                   IMC da OMS); gráfico de prevalência por IMC da Visão Geral de diabetes
-- @fonte:           dados.registros_diabetes
-- @dimensao:        faixa_imc:texto
-- @medida:          contagem:contagem
-- @medida:          pct:proporcao
-- @medida:          n_diabetes:contagem
-- @medida:          prevalencia:proporcao
-- @amostra_minima:  15
-- @suprime_quando:  n < 15 (só a prevalencia)
-- @divergencia:     -

WITH base AS (
    -- Os cortes e os nomes são os de app/dominio/regras.py::classificar_imc, o vocabulário de tela
    -- que a resposta da predição já usa (faixa_imc): fronteira inclusiva à esquerda, 25,0 já é
    -- Sobrepeso. O IMC da base é inteiro; o teste de paridade passa por todas as fronteiras.
    SELECT
        diabetes,
        CASE
            WHEN imc < 18.5 THEN 'Abaixo do Peso'
            WHEN imc < 25.0 THEN 'Peso Ideal'
            WHEN imc < 30.0 THEN 'Sobrepeso'
            WHEN imc < 35.0 THEN 'Obesidade Grau I'
            WHEN imc < 40.0 THEN 'Obesidade Grau II'
            ELSE 'Obesidade Grau III'
        END AS faixa_imc
    FROM dados.registros_diabetes
),

dominio AS (
    -- A ordem é a da escala (app/dominio/regras.py::FaixaImc), não a alfabética: ordenar por nome
    -- poria "Obesidade Grau I" antes de "Peso Ideal". tests/diabetes/test_dominios_sql_diabetes.py
    -- confere estes literais.
    SELECT *
    FROM (
        VALUES
        ('Abaixo do Peso', 1),
        ('Peso Ideal', 2),
        ('Sobrepeso', 3),
        ('Obesidade Grau I', 4),
        ('Obesidade Grau II', 5),
        ('Obesidade Grau III', 6)
    ) AS d (faixa_imc, ord)
),

contagem AS (
    SELECT
        faixa_imc,
        count(*) AS n,
        count(*) FILTER (WHERE diabetes = 'Sim') AS n_diabetes
    FROM base
    GROUP BY faixa_imc
),

completo AS (
    SELECT
        d.faixa_imc,
        d.ord,
        coalesce(c.n, 0) AS n,
        coalesce(c.n_diabetes, 0) AS n_diabetes,
        sum(coalesce(c.n, 0)) OVER () AS total
    FROM dominio AS d
    LEFT JOIN contagem AS c ON d.faixa_imc = c.faixa_imc
)

SELECT
    'prevalencia-por-imc'::text AS agregado_id,
    (row_number() OVER (ORDER BY completo.ord, m.ordem_medida))::integer AS ordem,
    'faixa_imc'::text AS dim1_nome,
    completo.faixa_imc AS dim1_valor,
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
ORDER BY completo.ord, m.ordem_medida;
