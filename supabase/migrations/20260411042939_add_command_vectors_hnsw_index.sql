-- =============================================================================
-- Add HNSW index for public.command_vectors
-- =============================================================================
-- Purpose:
-- - command_vectors is still present in the hosted schema and helper functions.
-- - The table currently has only the primary key index.
-- - Add the missing embedding HNSW index without touching global DB settings.
-- =============================================================================

CREATE INDEX IF NOT EXISTS idx_command_vectors_embedding_hnsw
ON public.command_vectors
USING hnsw (embedding vector_cosine_ops)
WITH (m = 16, ef_construction = 64);

ANALYZE public.command_vectors;
