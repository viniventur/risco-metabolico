-- @id:              por-nivel
-- @titulo:          Distribuição dos registros pelas 7 faixas
-- @mede:            Quantos registros a base tem em cada faixa de composição corporal, e
--                   quanto isso representa do total.
-- @origem:          docs/agregados.md, seção "Visão Geral"; visual <BarrasPorNivel> (7.3)
-- @fonte:           dados.registros_triagem
-- @dimensao:        nivel:texto
-- @medida:          contagem:contagem
-- @medida:          pct:proporcao
-- @amostra_minima:  -
-- @divergencia:     -

WITH dominio AS (
    -- A ordem aqui é a ORDEM CLÍNICA de dominio/regras.py::ORDEM_CLINICA, não a alfabética do
    -- LabelEncoder. Ordenar por nome deixaria "Obesidade I" antes de "Peso Normal" — o gráfico
    -- ficaria bonito e errado (6.3). tests/test_dominios_sql.py confere estes literais.
    SELECT *
    FROM (
        VALUES
        ('Abaixo do Peso', 1),
        ('Peso Normal', 2),
        ('Sobrepeso I', 3),
        ('Sobrepeso II', 4),
        ('Obesidade I', 5),
        ('Obesidade II', 6),
        ('Obesidade III', 7)
    ) AS d (nivel, ord)
),

contagem AS (
    SELECT
        nivel_obesidade AS nivel,
        count(*) AS n
    FROM dados.registros_triagem
    GROUP BY nivel_obesidade
),

completo AS (
    -- LEFT JOIN contra o domínio: uma faixa ausente vira linha com n=0, não linha faltante.
    -- O total sai AQUI, por janela: função de janela não é permitida dentro de VALUES.
    SELECT
        d.nivel,
        d.ord,
        coalesce(c.n, 0) AS n,
        sum(coalesce(c.n, 0)) OVER () AS total
    FROM dominio AS d
    LEFT JOIN contagem AS c ON d.nivel = c.nivel
)

SELECT
    'por-nivel'::text AS agregado_id,
    (row_number() OVER (ORDER BY completo.ord, m.ordem_medida))::integer AS ordem,
    'nivel'::text AS dim1_nome,
    completo.nivel AS dim1_valor,
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
    -- NULLIF no denominador: com base vazia o Postgres levantaria division_by_zero e
    -- derrubaria a agregação inteira; pandas devolveria inf. NULL é a única resposta que
    -- sobrevive ao JSON.
    ('pct', 100.0 * completo.n::double precision / nullif(completo.total, 0)::double precision, 2)
) AS m (nome, valor, ordem_medida)
ORDER BY completo.ord, m.ordem_medida;
