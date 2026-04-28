-- Harden Supabase public API surface after Knowledge Retrieval Lite moved to
-- server-side service-role access.
--
-- This migration intentionally keeps legacy tables/functions in place for
-- rollback and auditability. It only removes direct anon/authenticated access
-- and drops unused vector-era indexes that are not part of the current BM25
-- retrieval path.

-- Future public-schema objects should not become public API by default.
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  REVOKE EXECUTE ON FUNCTIONS FROM PUBLIC, anon, authenticated;

ALTER DEFAULT PRIVILEGES IN SCHEMA public
  REVOKE ALL PRIVILEGES ON TABLES FROM PUBLIC, anon, authenticated;

DO $$
DECLARE
    target_function regprocedure;
BEGIN
    FOREACH target_function IN ARRAY ARRAY[
        to_regprocedure('public.search_knowledge_text(text,integer,text)'),
        to_regprocedure('public.search_knowledge_base(extensions.vector,double precision,integer,text,text)'),
        to_regprocedure('public.hybrid_graph_vector_search(extensions.vector,double precision,integer,integer,integer)'),
        to_regprocedure('public.hybrid_search_vectors(extensions.vector,text,double precision,integer)'),
        to_regprocedure('public.hybrid_search_with_text(extensions.vector,text,double precision,double precision,double precision,double precision,integer,integer,integer,integer,text)'),
        to_regprocedure('public.match_documents(extensions.vector,integer,jsonb)'),
        to_regprocedure('public.match_knowledge_base(text,double precision,integer)'),
        to_regprocedure('public.get_approval_history(approval_status,approval_action_type,integer,integer,timestamp with time zone,timestamp with time zone)'),
        to_regprocedure('public.get_approval_stats(integer)'),
        to_regprocedure('public.generate_knowledge_search_vector(text,text,text[])'),
        to_regprocedure('public.get_knowledge_neighbors(uuid,text,knowledge_relationship_type[],integer)'),
        to_regprocedure('public.get_vector_stats()'),
        to_regprocedure('public.search_all_commands(extensions.vector,integer)'),
        to_regprocedure('public.search_all_commands(text)'),
        to_regprocedure('public.search_similar_commands(extensions.vector,double precision,integer)'),
        to_regprocedure('public.search_similar_vectors(extensions.vector,double precision,integer)'),
        to_regprocedure('public.search_vectors_by_category(extensions.vector,text,double precision,integer)'),
        to_regprocedure('public.search_vectors_with_filters(extensions.vector,jsonb,double precision,integer)'),
        to_regprocedure('public.traverse_knowledge_graph(uuid,text,integer,knowledge_relationship_type[],integer)')
    ]::regprocedure[]
    LOOP
        IF target_function IS NULL THEN
            CONTINUE;
        END IF;

        EXECUTE format(
            'REVOKE EXECUTE ON FUNCTION %s FROM PUBLIC, anon, authenticated',
            target_function
        );
        EXECUTE format(
            'GRANT EXECUTE ON FUNCTION %s TO service_role',
            target_function
        );
    END LOOP;
END $$;

-- These relations are used only through Next.js API routes, Cloud Run service
-- role clients, or one-off service-role maintenance scripts.
REVOKE ALL PRIVILEGES ON TABLE public.ai_feedback FROM PUBLIC, anon, authenticated;
GRANT ALL PRIVILEGES ON TABLE public.ai_feedback TO service_role;

REVOKE ALL PRIVILEGES ON TABLE public.approval_history FROM PUBLIC, anon, authenticated;
GRANT ALL PRIVILEGES ON TABLE public.approval_history TO service_role;

REVOKE ALL PRIVILEGES ON TABLE public.command_vectors FROM PUBLIC, anon, authenticated;
GRANT ALL PRIVILEGES ON TABLE public.command_vectors TO service_role;

REVOKE ALL PRIVILEGES ON TABLE public.incident_reports FROM PUBLIC, anon, authenticated;
GRANT ALL PRIVILEGES ON TABLE public.incident_reports TO service_role;

REVOKE ALL PRIVILEGES ON TABLE public.knowledge_base FROM PUBLIC, anon, authenticated;
GRANT ALL PRIVILEGES ON TABLE public.knowledge_base TO service_role;

REVOKE ALL PRIVILEGES ON TABLE public.knowledge_relationships FROM PUBLIC, anon, authenticated;
GRANT ALL PRIVILEGES ON TABLE public.knowledge_relationships TO service_role;

REVOKE ALL PRIVILEGES ON TABLE public.security_audit_logs FROM PUBLIC, anon, authenticated;
GRANT ALL PRIVILEGES ON TABLE public.security_audit_logs TO service_role;

REVOKE ALL PRIVILEGES ON TABLE public.system_rules FROM PUBLIC, anon, authenticated;
GRANT ALL PRIVILEGES ON TABLE public.system_rules TO service_role;

DO $$
BEGIN
    IF to_regclass('public.vector_documents_stats') IS NOT NULL THEN
        EXECUTE 'REVOKE ALL PRIVILEGES ON TABLE public.vector_documents_stats FROM PUBLIC, anon, authenticated';
        EXECUTE 'GRANT ALL PRIVILEGES ON TABLE public.vector_documents_stats TO service_role';
    END IF;
END $$;

-- Keep public.idx_knowledge_base_search_vector: it backs the current KRL BM25
-- search_knowledge_text runtime path.
DROP INDEX IF EXISTS public.idx_knowledge_base_embedding_hnsw;
DROP INDEX IF EXISTS public.idx_knowledge_base_content_trgm;
DROP INDEX IF EXISTS public.idx_command_vectors_embedding_hnsw;
