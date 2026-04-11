-- =============================================================================
-- Migrate command_vectors to Mistral Embeddings (1024 dimensions)
-- =============================================================================
-- Purpose: Replace Google AI embeddings (384d) with Mistral embeddings (1024d)
--
-- Changes:
-- 1. Clear existing command_vectors data (embeddings incompatible)
-- 2. Change embedding column from vector(384) to vector(1024)
-- 3. Recreate HNSW index
--
-- Note: This completes the Google AI → Mistral migration
-- =============================================================================

-- Step 1: Clear existing command_vectors data
TRUNCATE TABLE command_vectors CASCADE;

-- Step 2: Drop existing HNSW index
DROP INDEX IF EXISTS idx_command_vectors_embedding_hnsw;

-- Step 3: Alter embedding column from 384 to 1024 dimensions
ALTER TABLE command_vectors
    ALTER COLUMN embedding TYPE vector(1024);

-- Step 4: Recreate HNSW index with new dimension
CREATE INDEX idx_command_vectors_embedding_hnsw
ON command_vectors
USING hnsw (embedding vector_cosine_ops)
WITH (m = 16, ef_construction = 64);

-- Step 5: Update column comment
COMMENT ON TABLE command_vectors IS 'RAG 시스템을 위한 명령어 벡터 저장소 (1024차원 - Mistral)';
COMMENT ON COLUMN command_vectors.embedding IS 'Mistral mistral-embed 임베딩 벡터 (1024d)';

-- Step 6: Log migration
DO $$
BEGIN
    RAISE NOTICE '✅ Migration complete: command_vectors now uses Mistral embeddings (1024 dimensions)';
END $$;
