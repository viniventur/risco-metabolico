-- sql/schema.sql — DDL único do projeto (plano, §4.3.3, §6.8.4, §6.8.6).
-- Fonte única: o que não está neste arquivo não existe. Nada é criado pelo painel do provedor.
-- Idempotente (IF NOT EXISTS / OR REPLACE): roda no initdb do compose local E por
-- `psql "$BANCO_URL" -v ON_ERROR_STOP=1 -f sql/schema.sql` na instância publicada.

CREATE SCHEMA IF NOT EXISTS dados;      -- a base semeada
CREATE SCHEMA IF NOT EXISTS operacao;   -- cargas, snapshots, log, referências de deriva

-- Nenhum objeto vive em "public". A API REST do provedor expõe por padrão apenas "public":
-- ficar fora dele já retira estas tabelas da superfície pública ANTES de qualquer política.
-- É a primeira das três camadas (schema fora do exposto, grants revogados, RLS sem policy).

-- ============ operacao.carga_fonte ============
-- Auditoria de semeadura: é o que torna o seed idempotente e o que responde "de qual arquivo
-- esta tabela nasceu" sem guardar o arquivo. Carrega também o ponteiro de proveniência de §3.2
-- — o ponteiro e o hash, nunca a citação em si.
CREATE TABLE IF NOT EXISTS operacao.carga_fonte (
    id               bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    tabela_destino   text        NOT NULL,
    arquivo_origem   text        NOT NULL,   -- SÓ o nome: 'obesity.csv'
    sha256_arquivo   char(64)    NOT NULL,
    fonte_ref        text        NOT NULL DEFAULT 'data/bruto/FONTE.md',
    sha256_fonte_md  char(64)    NOT NULL,   -- amarra a citação ao dado (§3.2)
    linhas_arquivo   integer     NOT NULL CHECK (linhas_arquivo > 0),
    linhas_inseridas integer     NOT NULL,
    executado_em     timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT carga_unica        UNIQUE (tabela_destino, sha256_arquivo),
    CONSTRAINT carga_linhas_batem CHECK (linhas_inseridas = linhas_arquivo),
    -- Caminho absoluto é item da lista negra (§3.3). O banco recusa na origem.
    CONSTRAINT carga_sem_caminho  CHECK (arquivo_origem !~ '[\\/]')
);

-- ============ dados.registros_triagem ============
-- O CSV público não tem chave natural: a ORDEM NO ARQUIVO é a única chave, e é ela que torna
-- o SELECT do snapshot determinístico (§4.3.6).
CREATE TABLE IF NOT EXISTS dados.registros_triagem (
    linha_origem integer PRIMARY KEY,
    -- INICIO-GERADO: as 17 colunas de docs/dicionario-de-dados.md, na ordem de colunas_map,
    -- em snake_case minúsculo, com os TIPOS de dominio/features.py::TIPOS_SQL
    -- (double precision / smallint / text; numeric e real são proibidos).
    -- Escrito por `python -m app.dados.schema --gerar`. NÃO editar à mão.
    genero                             text             NOT NULL,
    idade                              double precision NOT NULL,
    altura                             double precision NOT NULL,
    peso                               double precision NOT NULL,
    historico_familiar_sobrepeso       text             NOT NULL,
    consumo_calorico_frequente         text             NOT NULL,
    consumo_vegetais                   smallint         NOT NULL,
    numero_refeicoes_principais        smallint         NOT NULL,
    consumo_alimentos_entre_refeicoes  text             NOT NULL,
    fumante                            text             NOT NULL,
    consumo_agua_diario                smallint         NOT NULL,
    monitoramento_calorias             text             NOT NULL,
    atividade_fisica_frequencia        smallint         NOT NULL,
    tempo_dispositivos_tecnologicos    smallint         NOT NULL,
    consumo_alcool                     text             NOT NULL,
    meio_transporte                    text             NOT NULL,
    nivel_obesidade                    text             NOT NULL,
    -- FIM-GERADO
    carga_id     bigint NOT NULL REFERENCES operacao.carga_fonte (id)
);

COMMENT ON TABLE dados.registros_triagem IS
  'Base pública de triagem metabólica. Os registros são fictícios/sintéticos e '
  'nenhum corresponde a pessoa real. Proveniência completa em '
  'data/bruto/FONTE.md, entre <!-- citacao-inicio --> e <!-- citacao-fim -->. '
  'Nenhum nome de autor é copiado para o banco.';

-- ============ dados.rotulos_escala ============
-- Semeada a partir de dominio/regras.py::ROTULOS_ESCALA. Existe por dois motivos: declarar o
-- DOMÍNIO completo das escalas no SQL (o LEFT JOIN que garante grupo com n=0, §10.9/#6) e
-- alimentar as colunas *_rotulo de base_painel.parquet. A EXIBIÇÃO do rótulo é do front (§7.3);
-- o contrato de §6.7.2 não carrega rótulo de dimensão.
CREATE TABLE IF NOT EXISTS dados.rotulos_escala (
    coluna text     NOT NULL,
    valor  smallint NOT NULL,
    rotulo text     NOT NULL,
    ordem  smallint NOT NULL,
    CONSTRAINT rotulos_pk PRIMARY KEY (coluna, valor)
);

-- ============ operacao.snapshot_treino ============
-- O registro do que o CLI congelou. É a resposta formal a "com quais dados este modelo foi
-- treinado" — uma tabela mutável não responderia isso.
CREATE TABLE IF NOT EXISTS operacao.snapshot_treino (
    sha256_arquivo  char(64)    PRIMARY KEY,       -- hash do .parquet gravado
    versao_dados    char(12)    NOT NULL UNIQUE,   -- vai para o manifest
    sha256_conteudo char(64)    NOT NULL,          -- hash do conteúdo canônico
    tabela_origem   text        NOT NULL,
    consulta_sql    text        NOT NULL,          -- o SELECT literal, com ORDER BY
    linhas          integer     NOT NULL CHECK (linhas > 0),
    colunas         integer     NOT NULL CHECK (colunas > 0),
    perfil_numerico jsonb       NOT NULL,          -- {coluna: {n, media, desvio, p01, p50, p99}}
    sha256_carga    char(64)    NOT NULL,          -- o sha256_arquivo da carga que originou
                                                   -- estas linhas (operacao.carga_fonte). É o
                                                   -- que §6.7.4 confere quando `agregados` roda
                                                   -- isolado de `congelar`.
    versao_modelo   text,                          -- preenchido pelo CLI de treino
    gerado_em       timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT snapshot_prefixo CHECK (versao_dados = left(sha256_arquivo, 12)),
    CONSTRAINT snapshot_perfil  CHECK (jsonb_typeof(perfil_numerico) = 'object')
);

-- ====== referências de deriva: as três tabelas que as consultas 01/02/03 leem ======
-- Materializadas de artifacts/distribuicao_treino.json por
-- scripts/carregar-distribuicao-treino.ps1 (§6.8.4).
CREATE TABLE IF NOT EXISTS operacao.feature_catalogo (
    feature text     PRIMARY KEY,
    tipo    text     NOT NULL CHECK (tipo IN ('numerica', 'categorica')),
    ordem   smallint NOT NULL
);

CREATE TABLE IF NOT EXISTS operacao.distribuicao_treino_numerica (
    feature  text   PRIMARY KEY REFERENCES operacao.feature_catalogo (feature),
    n_treino bigint NOT NULL,
    media    double precision,
    desvio   double precision,
    p50      double precision,
    minimo   double precision,
    maximo   double precision
);

CREATE TABLE IF NOT EXISTS operacao.distribuicao_treino_faixa (
    feature          text   NOT NULL REFERENCES operacao.feature_catalogo (feature),
    faixa_idx        int    NOT NULL,
    tipo             text   NOT NULL,
    faixa_rotulo     text,
    limite_inf       double precision,
    limite_sup       double precision,
    n_treino         bigint NOT NULL,
    proporcao_treino double precision NOT NULL,
    PRIMARY KEY (feature, faixa_idx)
);

-- ============ operacao.log_predicao ============
-- Append-only. NENHUMA FK para snapshot_treino, de propósito: uma FK faria a gravação falhar
-- quando o modelo servido não tivesse linha de snapshot, e um log que falha não pode existir num
-- caminho que não pode falhar (§6.8).
CREATE TABLE IF NOT EXISTS operacao.log_predicao (
    id              bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    criado_em       timestamptz NOT NULL DEFAULT now(),
    rota            text        NOT NULL,
    origem          text        NOT NULL,
    id_correlacao   uuid        NOT NULL,   -- um lote de N itens gera N linhas com o mesmo id
    entrada         jsonb       NOT NULL,   -- SÓ as 16 features, por allowlist (§6.8)
    saida           jsonb       NOT NULL,   -- RespostaTriagem serializada
    rotulo_saida    text        NOT NULL,   -- classe_prevista, projetada para não abrir JSONB
    risco_acumulado double precision,
    versao_modelo   text        NOT NULL,
    versao_dados    char(12)    NOT NULL,
    versao_api      text        NOT NULL,
    latencia_ms     double precision NOT NULL CHECK (latencia_ms >= 0.0),
    status_http     smallint    NOT NULL DEFAULT 200,
    CONSTRAINT log_origem         CHECK (origem IN ('painel', 'api', 'lote', 'teste', 'carga')),
    CONSTRAINT log_risco          CHECK (risco_acumulado IS NULL
                                         OR risco_acumulado BETWEEN 0.0 AND 1.0),
    CONSTRAINT log_entrada_objeto CHECK (jsonb_typeof(entrada) = 'object'),
    CONSTRAINT log_saida_objeto   CHECK (jsonb_typeof(saida) = 'object')
);

-- BRIN em criado_em: a tabela é append-only e correlacionada com a ordem física, então o índice
-- fica em kilobytes contra megabytes de um btree — e o plano gratuito cobra disco. É o filtro de
-- TODA consulta de deriva.
CREATE INDEX IF NOT EXISTS log_criado_idx
    ON operacao.log_predicao USING brin (criado_em) WITH (pages_per_range = 32);
CREATE INDEX IF NOT EXISTS log_versoes_idx
    ON operacao.log_predicao (versao_modelo, versao_dados, criado_em DESC);
CREATE INDEX IF NOT EXISTS log_origem_idx
    ON operacao.log_predicao (origem, criado_em DESC);
CREATE INDEX IF NOT EXISTS log_entrada_idx
    ON operacao.log_predicao USING gin (entrada jsonb_path_ops);

-- ============ operacao.v_deriva_faixa ============
-- O log já classificado nas faixas de operacao.distribuicao_treino_faixa. Existe para que a
-- consolidação de §6.8.6 e a consulta 02 usem literalmente a MESMA classificação — duas
-- classificações divergem em uma semana.
CREATE OR REPLACE VIEW operacao.v_deriva_faixa AS
SELECT l.criado_em, f.feature, f.faixa_idx
FROM operacao.log_predicao AS l
INNER JOIN operacao.distribuicao_treino_faixa AS f
    ON (
        CASE
            WHEN f.tipo = 'numerica' THEN
                jsonb_typeof(l.entrada -> f.feature) = 'number'
                AND (l.entrada -> f.feature)::text::double precision >= f.limite_inf
                AND (l.entrada -> f.feature)::text::double precision < f.limite_sup
            ELSE
                l.entrada ->> f.feature IS NOT DISTINCT FROM f.faixa_rotulo
        END
    );

-- ============ operacao.deriva_diaria + operacao.manutencao_log (§6.8.6) ============
-- Série histórica consolidada por dia e faixa: sobrevive à retenção do log bruto.
CREATE TABLE IF NOT EXISTS operacao.deriva_diaria (
    dia       date   NOT NULL,
    feature   text   NOT NULL,
    faixa_idx int    NOT NULL,
    n         bigint NOT NULL,
    PRIMARY KEY (dia, feature, faixa_idx)
);

-- Três regras, uma função só, chamada pela Action semanal de keep-alive (§4.3.8).
CREATE OR REPLACE FUNCTION operacao.manutencao_log(p_dias int, p_teto bigint)
RETURNS TABLE (consolidadas bigint, removidas bigint) LANGUAGE plpgsql AS $$
DECLARE
    v_corte date := (now() - make_interval(days => p_dias))::date;
    v_extra bigint;
BEGIN
    -- 1. Consolida ANTES de apagar: a série histórica de deriva sobrevive sem a carga bruta,
    --    que é justamente a parte com risco de dado identificável.
    INSERT INTO operacao.deriva_diaria (dia, feature, faixa_idx, n)
    SELECT criado_em::date, feature, faixa_idx, count(*)
    FROM operacao.v_deriva_faixa
    WHERE criado_em::date < v_corte
    GROUP BY 1, 2, 3
    ON CONFLICT (dia, feature, faixa_idx) DO UPDATE SET n = EXCLUDED.n;
    GET DIAGNOSTICS consolidadas = ROW_COUNT;

    -- 2. Apaga por idade.
    DELETE FROM operacao.log_predicao WHERE criado_em::date < v_corte;
    GET DIAGNOSTICS removidas = ROW_COUNT;

    -- 3. Teto absoluto de linhas: defesa contra rajada DENTRO da janela. O ROW_COUNT deste
    --    DELETE SOMA ao anterior: sem isso a função relata menos remoções do que fez.
    DELETE FROM operacao.log_predicao
    WHERE id IN (SELECT id FROM operacao.log_predicao ORDER BY id DESC OFFSET p_teto);
    GET DIAGNOSTICS v_extra = ROW_COUNT;
    removidas := removidas + v_extra;
    RETURN NEXT;
END $$;
