-- Drop legacy vector/graph RAG RPC functions after Knowledge Retrieval Lite
-- became the only runtime retrieval path.
--
-- Deliberately preserved:
-- - public.search_knowledge_text(text, integer, text): current KRL BM25 RPC
-- - public.knowledge_base: current knowledge corpus
-- - public.command_vectors / public.knowledge_relationships: historical data and
--   service-role maintenance inventory; table cleanup needs a separate data plan
--
-- Use explicit RESTRICT so this migration fails instead of silently dropping
-- dependent objects if any unexpected dependency still exists.

DO $$
DECLARE
    legacy_function regprocedure;
BEGIN
    FOREACH legacy_function IN ARRAY ARRAY[
        to_regprocedure('public.search_knowledge_base(extensions.vector,double precision,integer,text,text)'),
        to_regprocedure('public.hybrid_graph_vector_search(extensions.vector,double precision,integer,integer,integer)'),
        to_regprocedure('public.hybrid_search_vectors(extensions.vector,text,double precision,integer)'),
        to_regprocedure('public.hybrid_search_with_text(extensions.vector,text,double precision,double precision,double precision,double precision,integer,integer,integer,integer,text)'),
        to_regprocedure('public.match_documents(extensions.vector,integer,jsonb)'),
        to_regprocedure('public.match_knowledge_base(text,double precision,integer)')
    ]::regprocedure[]
    LOOP
        IF legacy_function IS NULL THEN
            CONTINUE;
        END IF;

        EXECUTE format('DROP FUNCTION %s RESTRICT', legacy_function);
    END LOOP;
END $$;
