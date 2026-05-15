-- Drop legacy GraphRAG/vector inventory after Knowledge Retrieval Lite became
-- the canonical retrieval path.
--
-- Destructive scope:
-- - public.vector_documents_stats view
-- - public.knowledge_relationships table
-- - public.command_vectors table
-- - public.knowledge_base.embedding column
--
-- Keep:
-- - public.knowledge_base: current KRL corpus
-- - public.knowledge_base.search_vector: current BM25 search vector
-- - public.search_knowledge_text(text, integer, text): current KRL RPC
-- - public.generate_knowledge_search_vector(text, text, text[]): current
--   search_vector trigger helper
-- - public.update_knowledge_search_vector(): current trigger function

DO $$
DECLARE
    missing_backfill_count integer := 0;
BEGIN
    IF to_regclass('public.knowledge_base') IS NULL THEN
        RAISE EXCEPTION 'knowledge_base table is required before legacy GraphRAG inventory cleanup';
    END IF;

    IF to_regprocedure('public.search_knowledge_text(text,integer,text)') IS NULL THEN
        RAISE EXCEPTION 'search_knowledge_text must exist before legacy GraphRAG inventory cleanup';
    END IF;

    IF to_regprocedure('public.generate_knowledge_search_vector(text,text,text[])') IS NULL THEN
        RAISE EXCEPTION 'generate_knowledge_search_vector must exist before legacy GraphRAG inventory cleanup';
    END IF;

    IF to_regprocedure('public.update_knowledge_search_vector()') IS NULL THEN
        RAISE EXCEPTION 'update_knowledge_search_vector must exist before legacy GraphRAG inventory cleanup';
    END IF;

    IF to_regclass('public.command_vectors') IS NOT NULL THEN
        EXECUTE $sql$
            SELECT COUNT(*)::integer
            FROM public.command_vectors cv
            WHERE NOT EXISTS (
                SELECT 1
                FROM public.knowledge_base kb
                WHERE kb.source = 'command_vectors_migration'
                  AND kb.tags @> ARRAY['cv:' || cv.id]
            )
            AND NOT EXISTS (
                SELECT 1
                FROM public.knowledge_base kb
                WHERE kb.source = 'command_vectors_migration'
                  AND kb.metadata->>'origin' = 'command_vectors'
                  AND kb.metadata->>'command_id' = cv.id
            )
        $sql$ INTO missing_backfill_count;

        IF missing_backfill_count > 0 THEN
            RAISE EXCEPTION
                'command_vectors still has % rows missing from knowledge_base command_vectors_migration backfill',
                missing_backfill_count;
        END IF;
    END IF;
END;
$$;

DROP VIEW IF EXISTS public.vector_documents_stats;
DROP TABLE IF EXISTS public.knowledge_relationships;
DROP TABLE IF EXISTS public.command_vectors;
ALTER TABLE public.knowledge_base DROP COLUMN IF EXISTS embedding;

DO $$
BEGIN
    IF to_regprocedure('public.search_knowledge_text(text,integer,text)') IS NULL THEN
        RAISE EXCEPTION 'search_knowledge_text must remain after legacy GraphRAG inventory cleanup';
    END IF;

    IF to_regprocedure('public.generate_knowledge_search_vector(text,text,text[])') IS NULL THEN
        RAISE EXCEPTION 'generate_knowledge_search_vector must remain after legacy GraphRAG inventory cleanup';
    END IF;

    IF to_regprocedure('public.update_knowledge_search_vector()') IS NULL THEN
        RAISE EXCEPTION 'update_knowledge_search_vector must remain after legacy GraphRAG inventory cleanup';
    END IF;

    IF to_regclass('public.knowledge_base') IS NULL THEN
        RAISE EXCEPTION 'knowledge_base table must remain after legacy GraphRAG inventory cleanup';
    END IF;

    IF NOT EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'knowledge_base'
          AND column_name = 'search_vector'
    ) THEN
        RAISE EXCEPTION 'knowledge_base.search_vector must remain after legacy GraphRAG inventory cleanup';
    END IF;

    IF EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'knowledge_base'
          AND column_name = 'embedding'
    ) THEN
        RAISE EXCEPTION 'knowledge_base.embedding should be removed after legacy GraphRAG inventory cleanup';
    END IF;

    IF to_regclass('public.vector_documents_stats') IS NOT NULL THEN
        RAISE EXCEPTION 'vector_documents_stats should be removed after legacy GraphRAG inventory cleanup';
    END IF;

    IF to_regclass('public.knowledge_relationships') IS NOT NULL THEN
        RAISE EXCEPTION 'knowledge_relationships should be removed after legacy GraphRAG inventory cleanup';
    END IF;

    IF to_regclass('public.command_vectors') IS NOT NULL THEN
        RAISE EXCEPTION 'command_vectors should be removed after legacy GraphRAG inventory cleanup';
    END IF;
END;
$$;
