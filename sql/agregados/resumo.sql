-- @id:              resumo
-- @titulo:          Resumo do recorte
-- @mede:            Quantos registros a base tem, as médias de idade, altura e peso, e a faixa
--                   predominante — a MODA, com desempate por nome — sobre a base inteira.
-- @origem:          docs/agregados.md, seção "Visão Geral"; faixa de KPIs <FaixaKpis> (7.3)
-- @fonte:           dados.registros_triagem
-- @medida:          total_registros:contagem
-- @medida:          idade_media:media_limitada
-- @medida:          altura_media:media_limitada
-- @medida:          peso_medio:media_limitada
-- @medida:          nivel_predominante:texto
-- @medida:          n_predominante:contagem
-- @amostra_minima:  -
-- @divergencia:     -

-- O KPI "nível predominante" era Max + TopN no painel de referência, o que não é moda. Aqui a
-- moda é uma função de janela e fica visível; o desempate por nome com COLLATE "C" é obrigatório:
-- sem ele, duas faixas empatadas fariam a moda alternar entre execuções e o KPI "mudar sozinho".
-- "Altura média" e "Peso médio" eram Sum() no original; "Qtd" contava uma coluna: aqui é count(*).
WITH base AS (
    -- O cast para double precision acontece AQUI, na coluna, ANTES de qualquer agregação:
    -- avg(numeric) acumula em decimal e não reproduz float64 (10.9.1, divergência 7).
    SELECT
        idade::double precision AS idade,
        altura::double precision AS altura,
        peso::double precision AS peso,
        nivel_obesidade
    FROM dados.registros_triagem
),

totais AS (
    SELECT
        count(*) AS n,
        avg(idade) AS idade_media,
        count(idade) AS n_idade,
        avg(altura) AS altura_media,
        count(altura) AS n_altura,
        avg(peso) AS peso_medio,
        count(peso) AS n_peso
    FROM base
),

modas AS (
    SELECT
        nivel_obesidade,
        count(*) AS n,
        row_number() OVER (ORDER BY count(*) DESC, nivel_obesidade COLLATE "C") AS posicao
    FROM base
    GROUP BY nivel_obesidade
),

moda AS (
    SELECT
        nivel_obesidade,
        n
    FROM modas
    WHERE posicao = 1
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
    m.valor_texto AS valor_texto,
    m.n::bigint AS n,
    FALSE AS suprimido
FROM totais AS t
CROSS JOIN moda AS mo
CROSS JOIN LATERAL (
    VALUES
    (1, 'total_registros', t.n::double precision, NULL::text, t.n),
    (2, 'idade_media', t.idade_media, NULL::text, t.n_idade),
    (3, 'altura_media', t.altura_media, NULL::text, t.n_altura),
    (4, 'peso_medio', t.peso_medio, NULL::text, t.n_peso),
    (5, 'nivel_predominante', NULL::double precision, mo.nivel_obesidade, mo.n),
    (6, 'n_predominante', mo.n::double precision, NULL::text, mo.n)
) AS m (ordem, nome, valor, valor_texto, n)
ORDER BY m.ordem;
