-- Restore extension schema lookup for RAG/vector RPCs after moving vector and
-- pg_trgm into the dedicated extensions schema.
--
-- The affected functions intentionally pin search_path for security, but the
-- previous path omitted extensions. That makes pgvector operators and pg_trgm
-- similarity() unavailable at runtime.

DO $$
BEGIN
    IF to_regprocedure('public.hybrid_graph_vector_search(extensions.vector,double precision,integer,integer,integer)') IS NOT NULL THEN
        EXECUTE 'ALTER FUNCTION public.hybrid_graph_vector_search(extensions.vector, double precision, integer, integer, integer) SET search_path = public, extensions, pg_temp';
    END IF;

    IF to_regprocedure('public.hybrid_search_with_text(extensions.vector,text,double precision,double precision,double precision,double precision,integer,integer,integer,integer,text)') IS NOT NULL THEN
        EXECUTE 'ALTER FUNCTION public.hybrid_search_with_text(extensions.vector, text, double precision, double precision, double precision, double precision, integer, integer, integer, integer, text) SET search_path = public, extensions, pg_temp';
    END IF;

    IF to_regprocedure('public.match_documents(extensions.vector,integer,jsonb)') IS NOT NULL THEN
        EXECUTE 'ALTER FUNCTION public.match_documents(extensions.vector, integer, jsonb) SET search_path = public, extensions, pg_temp';
    END IF;

    IF to_regprocedure('public.match_knowledge_base(text,double precision,integer)') IS NOT NULL THEN
        EXECUTE 'ALTER FUNCTION public.match_knowledge_base(text, double precision, integer) SET search_path = public, extensions, pg_temp';
    END IF;

    IF to_regprocedure('public.search_knowledge_base(extensions.vector,double precision,integer,text,text)') IS NOT NULL THEN
        EXECUTE 'ALTER FUNCTION public.search_knowledge_base(extensions.vector, double precision, integer, text, text) SET search_path = public, extensions, pg_temp';
    END IF;

    IF to_regprocedure('public.hybrid_search_vectors(extensions.vector,text,double precision,integer)') IS NOT NULL THEN
        EXECUTE 'ALTER FUNCTION public.hybrid_search_vectors(extensions.vector, text, double precision, integer) SET search_path = public, extensions, pg_catalog';
    END IF;

    IF to_regprocedure('public.search_all_commands(extensions.vector,integer)') IS NOT NULL THEN
        EXECUTE 'ALTER FUNCTION public.search_all_commands(extensions.vector, integer) SET search_path = public, extensions, pg_catalog';
    END IF;

    IF to_regprocedure('public.search_similar_commands(extensions.vector,double precision,integer)') IS NOT NULL THEN
        EXECUTE 'ALTER FUNCTION public.search_similar_commands(extensions.vector, double precision, integer) SET search_path = public, extensions, pg_catalog';
    END IF;

    IF to_regprocedure('public.search_similar_vectors(extensions.vector,double precision,integer)') IS NOT NULL THEN
        EXECUTE 'ALTER FUNCTION public.search_similar_vectors(extensions.vector, double precision, integer) SET search_path = public, extensions, pg_catalog';
    END IF;

    IF to_regprocedure('public.search_vectors_by_category(extensions.vector,text,double precision,integer)') IS NOT NULL THEN
        EXECUTE 'ALTER FUNCTION public.search_vectors_by_category(extensions.vector, text, double precision, integer) SET search_path = public, extensions, pg_catalog';
    END IF;

    IF to_regprocedure('public.search_vectors_with_filters(extensions.vector,jsonb,double precision,integer)') IS NOT NULL THEN
        EXECUTE 'ALTER FUNCTION public.search_vectors_with_filters(extensions.vector, jsonb, double precision, integer) SET search_path = public, extensions, pg_catalog';
    END IF;
END $$;
