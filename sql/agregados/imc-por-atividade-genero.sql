-- @id:              imc-por-atividade-genero
-- @titulo:          IMC médio por frequência de atividade física e gênero
-- @mede:            Média do IMC (peso dividido pela altura ao quadrado) de cada combinação de
--                   frequência semanal de atividade física e gênero, sobre a base inteira.
-- @origem:          study/01_comparacao_de_modelos.ipynb, célula de agregados; visual <ImcPorAtividade> (7.3)
-- @fonte:           dados.registros_triagem, dados.rotulos_escala
-- @dimensao:        atividade:inteiro
-- @dimensao:        genero:texto
-- @medida:          imc_medio:media_limitada
-- @amostra_minima:  15
-- @suprime_quando:  n < 15
-- @divergencia:     -

-- O eixo era rotulado "soma" no painel de referência; a medida é a MÉDIA do IMC (7.3).
WITH base AS (
    SELECT
        atividade_fisica_frequencia AS atividade,
        genero,
        peso::double precision / nullif(altura::double precision * altura::double precision, 0) AS imc
    FROM dados.registros_triagem
),

dominio AS (
    -- O domínio vem da tabela semeada de dominio/regras.py::ROTULOS_ESCALA. Digitar 0,1,2,3 aqui
    -- criaria a segunda cópia do domínio que 4.3.3 proíbe. `rotulo` NÃO entra: o contrato de
    -- 6.7.2 não carrega rótulo de dimensão; quem exibe o rótulo é o front (7.3).
    SELECT
        e.valor AS atividade,
        e.ordem,
        g.genero,
        g.ord AS ord_genero
    FROM dados.rotulos_escala AS e
    CROSS JOIN (
        VALUES
        ('Feminino', 1),
        ('Masculino', 2)
    ) AS g (genero, ord)
    WHERE e.coluna = 'Atividade_Fisica_Frequencia'
),

agrupado AS (
    SELECT
        atividade,
        genero,
        avg(imc) AS imc_medio,
        count(imc) AS n
    FROM base
    GROUP BY atividade, genero
)

SELECT
    'imc-por-atividade-genero'::text AS agregado_id,
    (row_number() OVER (ORDER BY d.ordem, d.ord_genero))::integer AS ordem,
    'atividade'::text AS dim1_nome,
    d.atividade::text AS dim1_valor,
    'genero'::text AS dim2_nome,
    d.genero AS dim2_valor,
    'imc_medio'::text AS medida,
    CASE WHEN coalesce(a.n, 0) >= 15 THEN a.imc_medio END AS valor,
    NULL::text AS valor_texto,
    coalesce(a.n, 0)::bigint AS n,
    (coalesce(a.n, 0) < 15) AS suprimido
FROM dominio AS d
LEFT JOIN agrupado AS a ON d.atividade = a.atividade AND d.genero = a.genero
ORDER BY d.ordem, d.ord_genero;
