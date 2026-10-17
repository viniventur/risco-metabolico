-- sql/deriva/01_distribuicao_numerica.sql — média, desvio, mediana e faixa das features numéricas
-- no log de predição contra as do snapshot de treino, com o deslocamento padronizado (§6.8.5).
--
-- Parâmetros: :janela_dias, :'versao_modelo', :'versao_dados'
-- Os textuais levam aspas no psql; a tradução para $1..$n é de nucleo/sql_param.py. Nenhum .sql
-- do projeto usa interpolação de string: parâmetro é parâmetro nos dois caminhos.
--
--   psql "$BANCO_URL" -v ON_ERROR_STOP=1 -v janela_dias=30 -v versao_modelo=2.0.0 \
--        -v versao_dados=f3b7296728f8 -f sql/deriva/01_distribuicao_numerica.sql
WITH amostra AS (
    SELECT l.entrada
    FROM operacao.log_predicao AS l
    WHERE
        l.criado_em >= now() - make_interval(days => :janela_dias)
        AND l.origem IN ('painel', 'api')     -- lote/teste/carga distorcem a distribuição
        AND l.status_http = 200
        AND l.versao_modelo = :'versao_modelo'
        AND l.versao_dados = :'versao_dados'
),

valores AS (
    SELECT
        c.feature,
        CASE
            WHEN jsonb_typeof(a.entrada -> c.feature) = 'number'
                THEN (a.entrada -> c.feature)::text::double precision
        END AS valor                      -- chave ausente ou não numérica -> NULL
    FROM amostra AS a
    CROSS JOIN operacao.feature_catalogo AS c
    WHERE c.tipo = 'numerica'
),

observado AS (
    SELECT
        feature,
        count(*) AS n_linhas,
        count(valor) AS n_validos,
        count(*) - count(valor) AS n_nulos,
        avg(valor) AS media,
        stddev_samp(valor) AS desvio,
        percentile_cont(0.50) WITHIN GROUP (ORDER BY valor) AS p50,
        min(valor) AS minimo,
        max(valor) AS maximo
    FROM valores
    GROUP BY feature
)

SELECT
    t.feature,
    o.n_linhas,
    o.n_validos,
    o.n_nulos,
    o.media AS media_log,
    t.media AS media_treino,
    o.desvio AS desvio_log,
    t.desvio AS desvio_treino,
    o.p50 AS p50_log,
    t.p50 AS p50_treino,
    o.minimo AS minimo_log,
    o.maximo AS maximo_log,
    t.minimo AS minimo_treino,
    t.maximo AS maximo_treino,
    -- NULLIF evita divisão por zero em feature constante no treino: vira NULL, não infinito.
    (o.media - t.media) / nullif(t.desvio, 0.0) AS deslocamento_desvios,
    (o.minimo < t.minimo OR o.maximo > t.maximo) AS extrapolou_faixa_de_treino
FROM operacao.distribuicao_treino_numerica AS t
LEFT JOIN observado AS o ON t.feature = o.feature      -- LEFT: feature sem tráfego aparece com NULL
ORDER BY abs(coalesce((o.media - t.media) / nullif(t.desvio, 0.0), 0)) DESC, t.feature;
