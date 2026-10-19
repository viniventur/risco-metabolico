-- sql/diabetes/deriva/03_indicador_divergencia.sql — PSI (Population Stability Index) por feature
-- da vertente diabetes, sobre as MESMAS faixas de 02. PSI = SUM((p_log - p_treino) * ln(p_log /
-- p_treino)), com o desenho de sql/deriva/03 sobre as referências operacao.diabetes_*.
--
-- Parâmetros: :janela_dias, :'versao_modelo', :'versao_dados', :n_minimo
-- Os cortes 0,10 e 0,25 são a convenção corrente para PSI (docs/decisoes/0008-limiares-de-psi.md),
-- os mesmos da vertente de obesidade; o :n_minimo é o N_MINIMO_DERIVA_DIABETES, medido para esta
-- vertente pelo método da mesma ADR (artifacts/diabetes/metricas/n-minimo-deriva.json).
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
,

proporcoes AS (
    SELECT
        f.feature,
        -- Epsilon: ln(0) é -Inf e p/0 estoura. 1e-6 é menor que a menor proporção representável
        -- com n_minimo linhas, então não move o PSI.
        greatest(coalesce(o.n, 0)::double precision / nullif(t.n_total, 0)::double precision, 1e-6) AS p_log,
        greatest(f.proporcao_treino, 1e-6) AS p_treino,
        t.n_total
    FROM operacao.diabetes_distribuicao_treino_faixa AS f
    LEFT JOIN observado AS o ON f.feature = o.feature AND f.faixa_idx = o.faixa_idx
    LEFT JOIN totais AS t ON f.feature = t.feature
)

SELECT
    feature,
    max(n_total) AS n_amostra,
    CASE
        WHEN max(n_total) >= :n_minimo
            THEN sum((p_log - p_treino) * ln(p_log / p_treino))
    END AS psi,
    CASE
        WHEN max(n_total) IS NULL OR max(n_total) < :n_minimo THEN 'amostra insuficiente'
        WHEN sum((p_log - p_treino) * ln(p_log / p_treino)) < 0.10 THEN 'estavel'
        WHEN sum((p_log - p_treino) * ln(p_log / p_treino)) < 0.25 THEN 'atencao'
        ELSE 'deriva significativa'
    END AS classificacao
FROM proporcoes
GROUP BY feature
ORDER BY psi DESC NULLS LAST, feature ASC;
