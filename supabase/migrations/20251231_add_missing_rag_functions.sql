-- =============================================================================
-- Add Missing RAG RPC Functions for LlamaIndex Integration
-- =============================================================================
-- Purpose: Create missing RPC functions used by llamaindex-rag-service.ts
--
-- Missing Functions:
-- 1. match_documents - Vector similarity search with embedding input
-- 2. match_knowledge_base - Text-based search (legacy compatibility)
--
-- Also updates:
-- 3. hybrid_search_with_text - Update from 384d to 1024d
-- =============================================================================

-- =============================================================================
-- 1. match_documents (Vector-based search for LlamaIndex)
-- =============================================================================
-- Used by: llamaindex-rag-service.ts hybridGraphSearch()
-- Input: Pre-computed embedding vector (1024d from Mistral)

CREATE OR REPLACE FUNCTION match_documents(
    query_embedding vector(1024),
    match_count INT DEFAULT 10,
    filter JSONB DEFAULT '{}'
)
RETURNS TABLE (
    id UUID,
    title TEXT,
    content TEXT,
    similarity FLOAT,
    metadata JSONB
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
        1 - (kb.embedding <=> query_embedding) as similarity,
        kb.metadata
    FROM knowledge_base kb
    WHERE kb.embedding IS NOT NULL
      -- Optional category filter from JSONB
      AND (
          filter->>'category' IS NULL
          OR kb.category = filter->>'category'
      )
      AND (
          filter->>'severity' IS NULL
          OR kb.severity = filter->>'severity'
      )
    ORDER BY kb.embedding <=> query_embedding
    LIMIT match_count;
END;
$$;

COMMENT ON FUNCTION match_documents IS 'Vector similarity search using Mistral embeddings (1024d) - Used by LlamaIndex';

-- =============================================================================
-- 2. match_knowledge_base (Text query → embedding → search)
-- =============================================================================
-- Used by: llamaindex-rag-service.ts searchKnowledgeBase()
-- Note: This is a compatibility wrapper - actual embedding should happen in Cloud Run
--       This function uses text search as fallback when embedding is not provided

CREATE OR REPLACE FUNCTION match_knowledge_base(
    query_text TEXT,
    match_threshold FLOAT DEFAULT 0.3,
    match_count INT DEFAULT 10
)
RETURNS TABLE (
    id UUID,
    title TEXT,
    content TEXT,
    similarity FLOAT,
    metadata JSONB
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    -- Text-based fallback search using ts_vector if available
    -- For full vector search, use search_knowledge_base with pre-computed embedding
    RETURN QUERY
    SELECT
        kb.id,
        kb.title,
        kb.content,
        -- Use text similarity as score (0.0-1.0)
        GREATEST(
            similarity(kb.title, query_text),
            similarity(kb.content, query_text)
        ) * 0.8 as similarity,  -- Scale to 0.8 max for text search
        kb.metadata
    FROM knowledge_base kb
    WHERE
        kb.title ILIKE '%' || query_text || '%'
        OR kb.content ILIKE '%' || query_text || '%'
        OR (kb.search_vector IS NOT NULL AND kb.search_vector @@ plainto_tsquery('english', query_text))
    ORDER BY similarity DESC
    LIMIT match_count;
END;
$$;

COMMENT ON FUNCTION match_knowledge_base IS 'Text-based search fallback for LlamaIndex - Use search_knowledge_base with vector for better results';

-- =============================================================================
-- 3. Update hybrid_search_with_text to 1024d
-- =============================================================================
-- Previously: vector(384) - Google Gemini
-- Now: vector(1024) - Mistral mistral-embed

DROP FUNCTION IF EXISTS hybrid_search_with_text(vector(384), TEXT, FLOAT, FLOAT, FLOAT, FLOAT, INT, TEXT, TEXT);

CREATE OR REPLACE FUNCTION hybrid_search_with_text(
    p_query_embedding vector(1024),
    p_query_text TEXT DEFAULT NULL,
    p_similarity_threshold FLOAT DEFAULT 0.5,
    p_text_weight FLOAT DEFAULT 0.3,
    p_vector_weight FLOAT DEFAULT 0.5,
    p_graph_weight FLOAT DEFAULT 0.2,
    p_max_results INT DEFAULT 10,
    p_category TEXT DEFAULT NULL,
    p_severity TEXT DEFAULT NULL
)
RETURNS TABLE (
    id UUID,
    title TEXT,
    content TEXT,
    category TEXT,
    severity TEXT,
    combined_score FLOAT,
    vector_score FLOAT,
    text_score FLOAT,
    graph_score FLOAT,
    source_type TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    RETURN QUERY
    WITH
    -- Step 1: Vector similarity search
    vector_results AS (
        SELECT
            kb.id,
            kb.title,
            kb.content,
            kb.category,
            kb.severity,
            1 - (kb.embedding <=> p_query_embedding) as v_score,
            kb.search_vector
        FROM knowledge_base kb
        WHERE kb.embedding IS NOT NULL
          AND 1 - (kb.embedding <=> p_query_embedding) >= p_similarity_threshold
          AND (p_category IS NULL OR kb.category = p_category)
          AND (p_severity IS NULL OR kb.severity = p_severity)
        ORDER BY kb.embedding <=> p_query_embedding
        LIMIT p_max_results * 2
    ),
    -- Step 2: BM25 text search (if query_text provided)
    text_results AS (
        SELECT
            vr.id,
            CASE
                WHEN p_query_text IS NOT NULL AND vr.search_vector IS NOT NULL
                THEN ts_rank_cd(vr.search_vector, plainto_tsquery('english', p_query_text))
                ELSE 0.0
            END as t_score
        FROM vector_results vr
    ),
    -- Step 3: Graph expansion scores
    graph_results AS (
        SELECT
            gr.node_id as id,
            MAX(gr.path_weight) * 0.8 as g_score
        FROM vector_results vr
        CROSS JOIN LATERAL traverse_knowledge_graph(
            vr.id,
            'knowledge_base',
            2,  -- max hops
            NULL,
            5   -- max results per node
        ) gr
        WHERE gr.node_table = 'knowledge_base'
        GROUP BY gr.node_id
    )
    -- Combine all scores
    SELECT
        vr.id,
        vr.title,
        vr.content,
        vr.category,
        vr.severity,
        -- Combined weighted score
        (
            COALESCE(vr.v_score, 0) * p_vector_weight +
            COALESCE(tr.t_score, 0) * p_text_weight +
            COALESCE(gr.g_score, 0) * p_graph_weight
        ) as combined_score,
        COALESCE(vr.v_score, 0)::FLOAT as vector_score,
        COALESCE(tr.t_score, 0)::FLOAT as text_score,
        COALESCE(gr.g_score, 0)::FLOAT as graph_score,
        'hybrid'::TEXT as source_type
    FROM vector_results vr
    LEFT JOIN text_results tr ON vr.id = tr.id
    LEFT JOIN graph_results gr ON vr.id = gr.id
    ORDER BY combined_score DESC
    LIMIT p_max_results;
END;
$$;

COMMENT ON FUNCTION hybrid_search_with_text IS 'Hybrid search combining Vector (1024d Mistral) + BM25 Text + Graph traversal';

-- =============================================================================
-- 4. Create index for text similarity (if not exists)
-- =============================================================================
-- Enable pg_trgm for text similarity functions
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- Create trigram index for faster text search
CREATE INDEX IF NOT EXISTS idx_knowledge_base_title_trgm
ON knowledge_base USING gin (title gin_trgm_ops);

CREATE INDEX IF NOT EXISTS idx_knowledge_base_content_trgm
ON knowledge_base USING gin (content gin_trgm_ops);

-- =============================================================================
-- 5. Log migration
-- =============================================================================
DO $$
BEGIN
    RAISE NOTICE '✅ Migration complete: Added missing RAG RPC functions';
    RAISE NOTICE '   - match_documents (vector 1024d)';
    RAISE NOTICE '   - match_knowledge_base (text fallback)';
    RAISE NOTICE '   - hybrid_search_with_text (updated to 1024d)';
END $$;
