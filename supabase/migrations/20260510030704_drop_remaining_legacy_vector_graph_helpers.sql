-- Drop remaining legacy vector/graph helper RPCs after KRL became the only
-- retrieval request path.
--
-- Keep:
-- - public.search_knowledge_text(text, integer, text): current KRL RPC
-- - public.generate_knowledge_search_vector(text, text, text[]): current
--   search_vector trigger helper
-- - public.update_knowledge_search_vector(): current trigger function
-- - public.knowledge_base / command_vectors / knowledge_relationships data

DO $$
DECLARE
    legacy_function regprocedure;
    legacy_functions regprocedure[] := ARRAY[
        to_regprocedure('public.get_knowledge_neighbors(uuid,text,knowledge_relationship_type[],integer)'),
        to_regprocedure('public.get_vector_stats()'),
        to_regprocedure('public.search_all_commands(extensions.vector,integer)'),
        to_regprocedure('public.search_all_commands(text)'),
        to_regprocedure('public.search_similar_commands(extensions.vector,double precision,integer)'),
        to_regprocedure('public.search_similar_vectors(extensions.vector,double precision,integer)'),
        to_regprocedure('public.search_vectors_by_category(extensions.vector,text,double precision,integer)'),
        to_regprocedure('public.search_vectors_with_filters(extensions.vector,jsonb,double precision,integer)'),
        to_regprocedure('public.traverse_knowledge_graph(uuid,text,integer,knowledge_relationship_type[],integer)')
    ];
BEGIN
    FOREACH legacy_function IN ARRAY legacy_functions LOOP
        IF legacy_function IS NULL THEN
            CONTINUE;
        END IF;

        EXECUTE format('DROP FUNCTION %s RESTRICT', legacy_function);
    END LOOP;
END;
$$;

-- This index supported graph traversal by weight ordering. The current KRL
-- request path does not traverse knowledge_relationships.
DROP INDEX IF EXISTS public.idx_kr_weight;

DO $$
BEGIN
    IF to_regprocedure('public.search_knowledge_text(text,integer,text)') IS NULL THEN
        RAISE EXCEPTION 'search_knowledge_text must remain after legacy helper cleanup';
    END IF;

    IF to_regprocedure('public.generate_knowledge_search_vector(text,text,text[])') IS NULL THEN
        RAISE EXCEPTION 'generate_knowledge_search_vector must remain for search_vector trigger updates';
    END IF;

    IF to_regprocedure('public.update_knowledge_search_vector()') IS NULL THEN
        RAISE EXCEPTION 'update_knowledge_search_vector must remain for search_vector trigger updates';
    END IF;

    IF to_regclass('public.knowledge_base') IS NULL THEN
        RAISE EXCEPTION 'knowledge_base table must remain after legacy helper cleanup';
    END IF;

    IF to_regclass('public.command_vectors') IS NULL THEN
        RAISE EXCEPTION 'command_vectors table must remain after legacy helper cleanup';
    END IF;

    IF to_regclass('public.knowledge_relationships') IS NULL THEN
        RAISE EXCEPTION 'knowledge_relationships table must remain after legacy helper cleanup';
    END IF;
END;
$$;
