-- =============================================================================
-- Migrate Knowledge Base to Mistral Embeddings (1024 dimensions)
-- =============================================================================
-- Purpose: Replace Google Gemini embeddings (384d) with Mistral embeddings (1024d)
--
-- Changes:
-- 1. Clear existing knowledge_base data (embeddings incompatible)
-- 2. Change embedding column from vector(384) to vector(1024)
-- 3. Recreate HNSW index
-- 4. Update search_knowledge_base function
-- 5. Update hybrid_graph_vector_search function
--
-- Note: command_vectors remains at 384d (uses separate embedding source)
-- =============================================================================

-- Step 1: Clear existing knowledge_base data (embeddings will be regenerated)
TRUNCATE TABLE knowledge_base CASCADE;

-- Step 2: Clear knowledge_relationships (references knowledge_base)
TRUNCATE TABLE knowledge_relationships CASCADE;

-- Step 3: Drop existing HNSW index
DROP INDEX IF EXISTS idx_knowledge_base_embedding_hnsw;

-- Step 4: Alter embedding column from 384 to 1024 dimensions
ALTER TABLE knowledge_base
    ALTER COLUMN embedding TYPE vector(1024);

-- Step 5: Recreate HNSW index with new dimension
-- Using same parameters as before (m=16, ef_construction=64)
CREATE INDEX idx_knowledge_base_embedding_hnsw
ON knowledge_base
USING hnsw (embedding vector_cosine_ops)
WITH (m = 16, ef_construction = 64);

-- Step 6: Update search_knowledge_base function (384 → 1024)
CREATE OR REPLACE FUNCTION search_knowledge_base(
    query_embedding vector(1024),
    similarity_threshold float DEFAULT 0.3,
    max_results int DEFAULT 5,
    filter_category text DEFAULT NULL,
    filter_severity text DEFAULT NULL
)
RETURNS TABLE (
    id uuid,
    title text,
    content text,
    category text,
    tags text[],
    severity text,
    similarity float
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    RETURN QUERY
    SELECT
        kb.id,
        kb.title,
        kb.content,
        kb.category,
        kb.tags,
        kb.severity,
        1 - (kb.embedding <=> query_embedding) as similarity
    FROM knowledge_base kb
    WHERE kb.embedding IS NOT NULL
      AND 1 - (kb.embedding <=> query_embedding) >= similarity_threshold
      AND (filter_category IS NULL OR kb.category = filter_category)
      AND (filter_severity IS NULL OR kb.severity = filter_severity)
    ORDER BY kb.embedding <=> query_embedding
    LIMIT max_results;
END;
$$;

-- Step 7: Update hybrid_graph_vector_search function (384 → 1024)
CREATE OR REPLACE FUNCTION hybrid_graph_vector_search(
    p_query_embedding vector(1024),
    p_similarity_threshold FLOAT DEFAULT 0.7,
    p_max_vector_results INT DEFAULT 5,
    p_max_graph_hops INT DEFAULT 2,
    p_max_total_results INT DEFAULT 15
)
RETURNS TABLE (
    id UUID,
    content TEXT,
    title TEXT,
    score FLOAT,
    source_type TEXT,
    hop_distance INT,
    metadata JSONB
) AS $$
BEGIN
    RETURN QUERY
    WITH
    -- Step 1: Vector similarity search
    vector_results AS (
        SELECT
            kb.id,
            kb.content,
            kb.title,
            1 - (kb.embedding <=> p_query_embedding) as similarity,
            kb.metadata
        FROM knowledge_base kb
        WHERE 1 - (kb.embedding <=> p_query_embedding) >= p_similarity_threshold
        ORDER BY kb.embedding <=> p_query_embedding
        LIMIT p_max_vector_results
    ),
    -- Step 2: Graph expansion from vector results
    graph_results AS (
        SELECT DISTINCT
            tkg.node_id,
            tkg.node_table,
            tkg.hop_distance,
            tkg.path_weight
        FROM vector_results vr
        CROSS JOIN LATERAL traverse_knowledge_graph(
            vr.id,
            'knowledge_base',
            p_max_graph_hops,
            NULL,
            10
        ) tkg
    )
    -- Combine results
    SELECT
        vr.id,
        vr.content,
        vr.title,
        vr.similarity as score,
        'vector'::TEXT as source_type,
        0 as hop_distance,
        vr.metadata
    FROM vector_results vr

    UNION ALL

    SELECT
        kb.id,
        kb.content,
        kb.title,
        gr.path_weight * 0.8 as score,
        'graph'::TEXT as source_type,
        gr.hop_distance,
        kb.metadata
    FROM graph_results gr
    JOIN knowledge_base kb ON kb.id = gr.node_id AND gr.node_table = 'knowledge_base'
    WHERE gr.node_id NOT IN (SELECT vr.id FROM vector_results vr)

    ORDER BY score DESC, hop_distance ASC
    LIMIT p_max_total_results;
END;
$$ LANGUAGE plpgsql;

-- Step 8: Update column comment
COMMENT ON COLUMN knowledge_base.embedding IS 'Mistral mistral-embed (1024d)';
COMMENT ON FUNCTION search_knowledge_base IS 'RAG search using Mistral embeddings (1024d)';
COMMENT ON FUNCTION hybrid_graph_vector_search IS 'Hybrid GraphRAG search using Mistral embeddings (1024d)';

-- Step 9: Log migration
DO $$
BEGIN
    RAISE NOTICE '✅ Migration complete: knowledge_base now uses Mistral embeddings (1024 dimensions)';
    RAISE NOTICE '⚠️ Run seed-knowledge-base.ts to regenerate embeddings';
END $$;
