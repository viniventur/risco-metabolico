-- sql/diabetes/deriva/02_contagem_por_faixa.sql — contagem por faixa, log da vertente diabetes contra
-- o treino. O desenho é o de sql/deriva/02 sobre as referências operacao.diabetes_*: numérica em
-- faixa fechada à esquerda e aberta à direita (>= inf AND < sup), sobre o valor ARREDONDADO (o IMC
-- que o modelo vê); categórica por igualdade exata do rótulo, e a faixa NULL captura chave ausente.
--
-- Parâmetros: :janela_dias, :'versao_modelo', :'versao_dados'
-- O bloco entre INICIO/FIM CTE COMPARTILHADA é byte a byte IGUAL ao de 03 (test_cte_identica da
-- vertente), e a classificação dentro dele é a da view operacao.diabetes_v_deriva_faixa, que a
-- consolidação do log usa: duas classificações divergem em uma semana.
-- INICIO CTE COMPARTILHADA
WITH amostra AS (
    SELECT l.entrada
    FROM operacao.log_predicao AS l
    WHERE
        l.criado_em >= now() - make_interval(days => :janela_dias)
        AND l.rota LIKE '/diabetes/%'          -- a vertente diabetes, como na consolidação
        AND l.origem IN ('painel', 'api')     -- lote/teste/carga distorcem a distribuição
        AND l.status_http = 200
        AND l.versao_modelo = :'versao_modelo'
        AND l.versao_dados = :'versao_dados'
),

observado AS (
    SELECT
        f.feature,
        f.faixa_idx,
        count(*) AS n
    FROM amostra AS a
    INNER JOIN operacao.diabetes_distribuicao_treino_faixa AS f ON TRUE
    WHERE
        CASE
            WHEN f.tipo = 'numerica'
                THEN
                    jsonb_typeof(a.entrada -> f.feature) = 'number'
                    AND round((a.entrada -> f.feature)::text::double precision) >= f.limite_inf
                    AND round((a.entrada -> f.feature)::text::double precision) < f.limite_sup
            -- IS NOT DISTINCT FROM é deliberado: chave ausente vira NULL e NULL = 'Feminino'
            -- seria NULL, isto é, a linha sumiria da contagem em silêncio. Assim a faixa NULL
            -- captura os ausentes.
            ELSE a.entrada ->> f.feature IS NOT DISTINCT FROM f.faixa_rotulo
        END
    GROUP BY f.feature, f.faixa_idx
),

totais AS (
    SELECT
        feature,
        sum(n) AS n_total
    FROM observado
    GROUP BY feature
)
-- FIM CTE COMPARTILHADA

SELECT
    f.feature,
    f.faixa_idx,
    f.tipo,
    f.faixa_rotulo,
    f.limite_inf,
    f.limite_sup,
    coalesce(o.n, 0) AS n_log,
    coalesce(o.n, 0)::double precision / nullif(t.n_total, 0)::double precision AS prop_log,
    f.proporcao_treino,
    f.n_treino,
    coalesce(t.n_total, 0) AS n_total_log
FROM operacao.diabetes_distribuicao_treino_faixa AS f
LEFT JOIN observado AS o ON f.feature = o.feature AND f.faixa_idx = o.faixa_idx
LEFT JOIN totais AS t ON f.feature = t.feature
ORDER BY f.feature, f.faixa_idx;
