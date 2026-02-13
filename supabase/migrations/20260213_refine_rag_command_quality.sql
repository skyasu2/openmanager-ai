-- =============================================================================
-- Refine RAG Command Quality (Free-tier friendly)
-- =============================================================================
-- Purpose:
-- 1) Remove duplicated migrated command docs by normalized title
-- 2) Mark destructive command entries with metadata/tags for safer downstream usage
-- =============================================================================

-- 1) Deduplicate command_vectors_migration command docs by normalized title
WITH ranked AS (
    SELECT
        id,
        ROW_NUMBER() OVER (
            PARTITION BY lower(trim(title)), category, source
            ORDER BY created_at DESC, id DESC
        ) AS rn
    FROM public.knowledge_base
    WHERE source = 'command_vectors_migration'
      AND category = 'command'
)
DELETE FROM public.knowledge_base kb
USING ranked r
WHERE kb.id = r.id
  AND r.rn > 1;

-- 2) Mark destructive commands so runtime filters/policies can leverage metadata
UPDATE public.knowledge_base
SET
    metadata = COALESCE(metadata, '{}'::jsonb) || jsonb_build_object(
        'risk_level', 'destructive',
        'requires_confirmation', true,
        'updated_by', '20260213_refine_rag_command_quality'
    ),
    tags = CASE
        WHEN tags @> ARRAY['destructive']::text[] THEN tags
        ELSE tags || ARRAY['destructive']::text[]
    END
WHERE source = 'command_vectors_migration'
  AND category = 'command'
  AND lower(trim(title)) IN ('docker system prune');
