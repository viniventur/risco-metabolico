-- @id:              resumo
-- @titulo:          Resumo da base de diabetes
-- @mede:            Quantas respostas a base tem, quantas são de quem já ouviu de um profissional
--                   de saúde que tem diabetes, quanto isso representa do total (a prevalência na
--                   base, não na população) e o IMC médio, sobre a base inteira.
-- @origem:          study/02_triagem_de_diabetes.ipynb, seção "Exploração" (prevalência na base);
--                   faixa de KPIs da Visão Geral de diabetes
-- @fonte:           dados.registros_diabetes
-- @medida:          total_registros:contagem
-- @medida:          n_diabetes:contagem
-- @medida:          prevalencia:proporcao
-- @medida:          imc_medio:media_limitada
-- @amostra_minima:  -
-- @divergencia:     -

-- Como no resumo da vertente de obesidade, o KPI não é suprimido: quem lê o recorte vê o n ao lado.
WITH base AS (
    -- O cast para double precision acontece na coluna, antes de qualquer agregação (docs/agregados.md).
    SELECT
        imc::double precision AS imc,
        diabetes
    FROM dados.registros_diabetes
),

totais AS (
    SELECT
        count(*) AS n,
        count(*) FILTER (WHERE diabetes = 'Sim') AS n_diabetes,
        avg(imc) AS imc_medio,
        count(imc) AS n_imc
    FROM base
)

SELECT
    'resumo'::text AS agregado_id,
    m.ordem::integer AS ordem,
    NULL::text AS dim1_nome,
    NULL::text AS dim1_valor,
    NULL::text AS dim2_nome,
    NULL::text AS dim2_valor,
    m.nome AS medida,
    m.valor AS valor,
    NULL::text AS valor_texto,
    m.n::bigint AS n,
    FALSE AS suprimido
FROM totais AS t
CROSS JOIN LATERAL (
    VALUES
    (1, 'total_registros', t.n::double precision, t.n),
    (2, 'n_diabetes', t.n_diabetes::double precision, t.n_diabetes),
    -- O n da prevalência é o denominador: quantas respostas entraram na fração.
    (3, 'prevalencia', 100.0 * t.n_diabetes::double precision / nullif(t.n, 0)::double precision, t.n),
    (4, 'imc_medio', t.imc_medio, t.n_imc)
) AS m (ordem, nome, valor, n)
ORDER BY m.ordem;
