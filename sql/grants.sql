-- sql/grants.sql — roda logo depois de schema.sql, nos DOIS ambientes (plano, §4.3.4).
-- Não há usuário, então não há política a escrever. RLS aqui não decide "quem vê o quê": é a
-- rede embaixo do trapézio, para o caso de alguém expor um schema por engano.

-- Laço EXECUTÁVEL, não comentário: toda tabela de dados. e de operacao. ganha a rede —
-- inclusive as criadas depois.
DO $$
DECLARE t record;
BEGIN
  FOR t IN SELECT schemaname, tablename FROM pg_tables
           WHERE schemaname IN ('dados', 'operacao') LOOP
    EXECUTE format('ALTER TABLE %I.%I ENABLE ROW LEVEL SECURITY', t.schemaname, t.tablename);
    EXECUTE format('ALTER TABLE %I.%I FORCE ROW LEVEL SECURITY', t.schemaname, t.tablename);
  END LOOP;
END $$;

-- NENHUMA POLICY É CRIADA. RLS ligada sem policy = negação total para qualquer papel que não
-- tenha BYPASSRLS. Não existe "policy de leitura pública" aqui.
REVOKE ALL ON SCHEMA dados, operacao FROM public;
REVOKE ALL ON ALL TABLES IN SCHEMA dados, operacao FROM public;

-- Os papéis do provedor gerenciado não existem no compose local: bloco condicional, para o
-- MESMO arquivo rodar nos dois ambientes sem erro.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
    EXECUTE 'REVOKE ALL ON SCHEMA dados, operacao FROM anon, authenticated';
    EXECUTE 'REVOKE ALL ON ALL TABLES IN SCHEMA dados FROM anon, authenticated';
    EXECUTE 'REVOKE ALL ON ALL TABLES IN SCHEMA operacao FROM anon, authenticated';
    EXECUTE 'ALTER DEFAULT PRIVILEGES IN SCHEMA dados
             REVOKE ALL ON TABLES FROM anon, authenticated';
    EXECUTE 'ALTER DEFAULT PRIVILEGES IN SCHEMA operacao
             REVOKE ALL ON TABLES FROM anon, authenticated';
  END IF;
END $$;
