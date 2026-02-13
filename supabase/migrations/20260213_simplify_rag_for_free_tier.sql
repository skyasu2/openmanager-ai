-- =============================================================================
-- Simplify RAG Footprint for Supabase Free Tier
-- =============================================================================
-- Purpose:
-- 1) Keep runtime retrieval centered on knowledge_base
-- 2) Backfill command_vectors into knowledge_base as command documents
-- 3) Drop non-essential command_vectors indexes to reduce storage/maintenance
-- =============================================================================

DO $$
BEGIN
    IF to_regclass('public.command_vectors') IS NOT NULL
       AND to_regclass('public.knowledge_base') IS NOT NULL THEN

        -- Backfill command vectors into knowledge_base (idempotent)
        INSERT INTO public.knowledge_base (
            title,
            content,
            embedding,
            category,
            tags,
            severity,
            source,
            related_server_types,
            metadata
        )
        SELECT
            COALESCE(
                CASE
                    WHEN jsonb_typeof(cv.metadata -> 'commands') = 'array'
                    THEN cv.metadata -> 'commands' ->> 0
                    ELSE NULL
                END,
                cv.id
            ) AS title,
            cv.content,
            cv.embedding,
            'command'::text AS category,
            (
                CASE
                    WHEN jsonb_typeof(cv.metadata -> 'tags') = 'array'
                    THEN ARRAY(SELECT jsonb_array_elements_text(cv.metadata -> 'tags'))
                    ELSE ARRAY[]::text[]
                END
            ) || ARRAY['from_command_vectors', 'cv:' || cv.id] AS tags,
            'info'::text AS severity,
            'command_vectors_migration'::text AS source,
            ARRAY[]::text[] AS related_server_types,
            jsonb_build_object(
                'origin', 'command_vectors',
                'command_vector_id', cv.id,
                'category', cv.metadata ->> 'category',
                'difficulty', cv.metadata ->> 'difficulty',
                'commands', cv.metadata -> 'commands'
            ) AS metadata
        FROM public.command_vectors cv
        WHERE cv.embedding IS NOT NULL
          AND NOT EXISTS (
              SELECT 1
              FROM public.knowledge_base kb
              WHERE kb.source = 'command_vectors_migration'
                AND kb.metadata ->> 'command_vector_id' = cv.id
          );

        -- command_vectors is not part of the current runtime retrieval path.
        -- Keep table, but remove heavy optional indexes for free-tier efficiency.
        DROP INDEX IF EXISTS public.command_vectors_embedding_idx;
        DROP INDEX IF EXISTS public.idx_command_vectors_embedding_hnsw;
        DROP INDEX IF EXISTS public.command_vectors_content_gin_idx;
        DROP INDEX IF EXISTS public.command_vectors_category_idx;
        DROP INDEX IF EXISTS public.command_vectors_created_at_idx;

        ANALYZE public.knowledge_base;
        ANALYZE public.command_vectors;
    END IF;
END $$;

