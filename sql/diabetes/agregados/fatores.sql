-- @id:              fatores
-- @titulo:          Fatores associados: a fração com diabetes em cada resposta
-- @mede:            Para cada uma das 16 variáveis categóricas da base (as 13 de sim ou não, a
--                   saúde geral, a escolaridade e a renda) e cada resposta: quantas respostas,
--                   quanto isso representa do total, quantas são de quem tem diabetes e a fração
--                   com diabetes entre quem deu aquela resposta, sobre a base inteira.
-- @origem:          study/02_triagem_de_diabetes.ipynb, seção "Exploração" (prevalência por resposta
--                   e por nível); gráfico de fatores da Visão Geral de diabetes
-- @fonte:           dados.registros_diabetes
-- @dimensao:        fator:texto
-- @dimensao:        resposta:texto
-- @medida:          contagem:contagem
-- @medida:          pct:proporcao
-- @medida:          n_diabetes:contagem
-- @medida:          prevalencia:proporcao
-- @amostra_minima:  15
-- @suprime_quando:  n < 15 (só a prevalencia)
-- @divergencia:     -

-- Idade, sexo e IMC têm gráfico próprio; os dois "dias de saúde ruim" (0 a 30) ficam na Consulta.
-- O fator é o nome da coluna no banco, o mesmo `campo` de /diabetes/painel/por-categoria; o
-- rótulo de exibição ("Pressão alta", "Excelente") é do front, via app/diabetes/dominio/regras.py.
WITH respostas AS (
    -- Uma linha por (resposta, fator): as 16 colunas viram duas. As escalas viram texto aqui,
    -- porque valor de dimensão é sempre string no contrato (docs/agregados.md).
    SELECT
        f.fator,
        f.resposta,
        r.diabetes
    FROM dados.registros_diabetes AS r
    CROSS JOIN LATERAL (
        VALUES
        ('pressao_alta', r.pressao_alta),
        ('colesterol_alto', r.colesterol_alto),
        ('exame_colesterol_5_anos', r.exame_colesterol_5_anos),
        ('fumou_100_cigarros', r.fumou_100_cigarros),
        ('teve_avc', r.teve_avc),
        ('doenca_coronariana_ou_infarto', r.doenca_coronariana_ou_infarto),
        ('atividade_fisica_30_dias', r.atividade_fisica_30_dias),
        ('fruta_diaria', r.fruta_diaria),
        ('verdura_diaria', r.verdura_diaria),
        ('consumo_pesado_alcool', r.consumo_pesado_alcool),
        ('cobertura_saude', r.cobertura_saude),
        ('deixou_medico_por_custo', r.deixou_medico_por_custo),
        ('saude_geral', r.saude_geral::text),
        ('dificuldade_caminhar', r.dificuldade_caminhar),
        ('escolaridade', r.escolaridade::text),
        ('faixa_renda', r.faixa_renda::text)
    ) AS f (fator, resposta)
),

dominio AS (
    -- Os fatores na ordem canônica das colunas (app/diabetes/dominio/features.py::COLUNAS_MAP) e,
    -- dentro de cada um, as respostas na ordem de regras.DOMINIOS. tests/diabetes/
    -- test_dominios_sql_diabetes.py confere cada tripla contra o domínio.
    SELECT *
    FROM (
        VALUES
        ('pressao_alta', 'Não', 1),
        ('pressao_alta', 'Sim', 2),
        ('colesterol_alto', 'Não', 3),
        ('colesterol_alto', 'Sim', 4),
        ('exame_colesterol_5_anos', 'Não', 5),
        ('exame_colesterol_5_anos', 'Sim', 6),
        ('fumou_100_cigarros', 'Não', 7),
        ('fumou_100_cigarros', 'Sim', 8),
        ('teve_avc', 'Não', 9),
        ('teve_avc', 'Sim', 10),
        ('doenca_coronariana_ou_infarto', 'Não', 11),
        ('doenca_coronariana_ou_infarto', 'Sim', 12),
        ('atividade_fisica_30_dias', 'Não', 13),
        ('atividade_fisica_30_dias', 'Sim', 14),
        ('fruta_diaria', 'Não', 15),
        ('fruta_diaria', 'Sim', 16),
        ('verdura_diaria', 'Não', 17),
        ('verdura_diaria', 'Sim', 18),
        ('consumo_pesado_alcool', 'Não', 19),
        ('consumo_pesado_alcool', 'Sim', 20),
        ('cobertura_saude', 'Não', 21),
        ('cobertura_saude', 'Sim', 22),
        ('deixou_medico_por_custo', 'Não', 23),
        ('deixou_medico_por_custo', 'Sim', 24),
        ('saude_geral', '1', 25),
        ('saude_geral', '2', 26),
        ('saude_geral', '3', 27),
        ('saude_geral', '4', 28),
        ('saude_geral', '5', 29),
        ('dificuldade_caminhar', 'Não', 30),
        ('dificuldade_caminhar', 'Sim', 31),
        ('escolaridade', '1', 32),
        ('escolaridade', '2', 33),
        ('escolaridade', '3', 34),
        ('escolaridade', '4', 35),
        ('escolaridade', '5', 36),
        ('escolaridade', '6', 37),
        ('faixa_renda', '1', 38),
        ('faixa_renda', '2', 39),
        ('faixa_renda', '3', 40),
        ('faixa_renda', '4', 41),
        ('faixa_renda', '5', 42),
        ('faixa_renda', '6', 43),
        ('faixa_renda', '7', 44),
        ('faixa_renda', '8', 45)
    ) AS d (fator, resposta, ord)
),

contagem AS (
    SELECT
        fator,
        resposta,
        count(*) AS n,
        count(*) FILTER (WHERE diabetes = 'Sim') AS n_diabetes
    FROM respostas
    GROUP BY fator, resposta
),

completo AS (
    -- O total é o de cada fator (todas as respostas da base, que não tem nulo): o pct de "Sim"
    -- diz quanto da base respondeu sim àquela pergunta.
    SELECT
        d.fator,
        d.resposta,
        d.ord,
        coalesce(c.n, 0) AS n,
        coalesce(c.n_diabetes, 0) AS n_diabetes,
        sum(coalesce(c.n, 0)) OVER (PARTITION BY d.fator) AS total
    FROM dominio AS d
    LEFT JOIN contagem AS c ON d.fator = c.fator AND d.resposta = c.resposta
)

SELECT
    'fatores'::text AS agregado_id,
    (row_number() OVER (ORDER BY completo.ord, m.ordem_medida))::integer AS ordem,
    'fator'::text AS dim1_nome,
    completo.fator AS dim1_valor,
    'resposta'::text AS dim2_nome,
    completo.resposta AS dim2_valor,
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
