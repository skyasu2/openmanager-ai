-- =============================================================================
-- BM25 Text Search: Full-Text Search Enhancement for RAG
-- =============================================================================
-- Purpose: Add PostgreSQL full-text search (tsvector/ts_rank) to knowledge_base
--          for hybrid Vector + Text + Graph search capabilities.
--
-- Best Practice: 2025 RAG trends recommend combining:
--   1. Vector similarity (semantic meaning)
--   2. BM25/Keyword search (exact term matching)
--   3. Graph traversal (relationship understanding)
--
-- Cost Impact: $0 (uses existing PostgreSQL capabilities)
-- =============================================================================

-- 1. Add tsvector column for full-text search
ALTER TABLE knowledge_base
ADD COLUMN IF NOT EXISTS search_vector tsvector;

-- 2. Create GIN index for efficient full-text search
CREATE INDEX IF NOT EXISTS idx_knowledge_base_search_vector
ON knowledge_base USING GIN (search_vector);

-- 3. Function to generate weighted tsvector from title + content
-- Title gets weight 'A' (highest), content gets weight 'B'
CREATE OR REPLACE FUNCTION generate_knowledge_search_vector(
    p_title TEXT,
    p_content TEXT,
    p_tags TEXT[] DEFAULT '{}'
)
RETURNS tsvector AS $$
DECLARE
    tags_text TEXT;
BEGIN
    -- Convert tags array to space-separated string
    tags_text := COALESCE(array_to_string(p_tags, ' '), '');

    RETURN (
        setweight(to_tsvector('simple', COALESCE(p_title, '')), 'A') ||
        setweight(to_tsvector('simple', tags_text), 'A') ||
        setweight(to_tsvector('simple', COALESCE(p_content, '')), 'B')
    );
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- 4. Trigger to auto-update search_vector on INSERT/UPDATE
CREATE OR REPLACE FUNCTION update_knowledge_search_vector()
RETURNS TRIGGER AS $$
BEGIN
    NEW.search_vector := generate_knowledge_search_vector(
        NEW.title,
        NEW.content,
        NEW.tags
    );
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_update_knowledge_search_vector ON knowledge_base;
CREATE TRIGGER trigger_update_knowledge_search_vector
    BEFORE INSERT OR UPDATE OF title, content, tags ON knowledge_base
    FOR EACH ROW
    EXECUTE FUNCTION update_knowledge_search_vector();

-- 5. Backfill existing rows with search vectors
UPDATE knowledge_base
SET search_vector = generate_knowledge_search_vector(title, content, tags)
WHERE search_vector IS NULL;

-- 6. Create hybrid search function with text search support
-- Combines: Vector similarity + BM25 text search + Graph traversal
-- NOTE: metadata column removed (not in knowledge_base schema)
CREATE OR REPLACE FUNCTION hybrid_search_with_text(
    p_query_embedding vector(1024),  -- Updated: 384 → 1024 (Mistral mistral-embed)
    p_query_text TEXT DEFAULT NULL,
    p_similarity_threshold FLOAT DEFAULT 0.5,
    p_text_weight FLOAT DEFAULT 0.3,
    p_vector_weight FLOAT DEFAULT 0.5,
    p_graph_weight FLOAT DEFAULT 0.2,
    p_max_vector_results INT DEFAULT 5,
    p_max_text_results INT DEFAULT 5,
    p_max_graph_hops INT DEFAULT 2,
    p_max_total_results INT DEFAULT 15,
    p_filter_category TEXT DEFAULT NULL
)
RETURNS TABLE (
    id UUID,
    content TEXT,
    title TEXT,
    category TEXT,
    score FLOAT,
    vector_score FLOAT,
    text_score FLOAT,
    graph_score FLOAT,
    source_type TEXT,
    hop_distance INT
) AS $$
DECLARE
    query_tsquery tsquery;
BEGIN
    -- Parse query text to tsquery if provided
    IF p_query_text IS NOT NULL AND p_query_text != '' THEN
        query_tsquery := plainto_tsquery('simple', p_query_text);
    ELSE
        query_tsquery := NULL;
    END IF;

    RETURN QUERY
    WITH
    -- Step 1: Vector similarity search
    vector_results AS (
        SELECT
            kb.id,
            kb.content,
            kb.title,
            kb.category,
            (1 - (kb.embedding <=> p_query_embedding))::FLOAT as v_score,
            0::FLOAT as t_score
        FROM knowledge_base kb
        WHERE kb.embedding IS NOT NULL
          AND 1 - (kb.embedding <=> p_query_embedding) >= p_similarity_threshold
          AND (p_filter_category IS NULL OR kb.category = p_filter_category)
        ORDER BY kb.embedding <=> p_query_embedding
        LIMIT p_max_vector_results
    ),

    -- Step 2: Text search (BM25-style using ts_rank)
    text_results AS (
        SELECT
            kb.id,
            kb.content,
            kb.title,
            kb.category,
            COALESCE(1 - (kb.embedding <=> p_query_embedding), 0)::FLOAT as v_score,
            ts_rank_cd(kb.search_vector, query_tsquery, 32)::FLOAT as t_score
        FROM knowledge_base kb
        WHERE query_tsquery IS NOT NULL
          AND kb.search_vector @@ query_tsquery
          AND kb.id NOT IN (SELECT vr.id FROM vector_results vr)
          AND (p_filter_category IS NULL OR kb.category = p_filter_category)
        ORDER BY ts_rank_cd(kb.search_vector, query_tsquery, 32) DESC
        LIMIT p_max_text_results
    ),

    -- Step 3: Combined initial results for graph expansion
    initial_results AS (
        SELECT * FROM vector_results
        UNION ALL
        SELECT * FROM text_results
    ),

    -- Step 4: Graph expansion from initial results
    graph_results AS (
        SELECT DISTINCT
            tkg.node_id,
            tkg.node_table,
            tkg.hop_distance,
            tkg.path_weight
        FROM initial_results ir
        CROSS JOIN LATERAL traverse_knowledge_graph(
            ir.id,
            'knowledge_base',
            p_max_graph_hops,
            NULL,
            10
        ) tkg
        WHERE tkg.node_id NOT IN (SELECT ir2.id FROM initial_results ir2)
    ),

    -- Step 5: Fetch graph node details
    graph_details AS (
        SELECT
            kb.id,
            kb.content,
            kb.title,
            kb.category,
            COALESCE(1 - (kb.embedding <=> p_query_embedding), 0)::FLOAT as v_score,
            CASE WHEN query_tsquery IS NOT NULL AND kb.search_vector IS NOT NULL
                 THEN ts_rank_cd(kb.search_vector, query_tsquery, 32)::FLOAT
                 ELSE 0::FLOAT
            END as t_score,
            gr.hop_distance,
            gr.path_weight::FLOAT
        FROM graph_results gr
        JOIN knowledge_base kb ON kb.id = gr.node_id AND gr.node_table = 'knowledge_base'
    )

    -- Final: Combine all results with weighted scoring
    SELECT
        r.id,
        r.content,
        r.title,
        r.category,
        (r.v_score * p_vector_weight + r.t_score * p_text_weight)::FLOAT as score,
        r.v_score::FLOAT as vector_score,
        r.t_score::FLOAT as text_score,
        0::FLOAT as graph_score,
        'hybrid'::TEXT as source_type,
        0 as hop_distance
    FROM initial_results r

    UNION ALL

    SELECT
        gd.id,
        gd.content,
        gd.title,
        gd.category,
        (gd.path_weight * p_graph_weight + gd.v_score * p_vector_weight * 0.5 + gd.t_score * p_text_weight * 0.5)::FLOAT as score,
        gd.v_score::FLOAT as vector_score,
        gd.t_score::FLOAT as text_score,
        gd.path_weight::FLOAT as graph_score,
        'graph'::TEXT as source_type,
        gd.hop_distance
    FROM graph_details gd

    ORDER BY score DESC, hop_distance ASC
    LIMIT p_max_total_results;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 7. Simple text-only search function (for fallback/testing)
CREATE OR REPLACE FUNCTION search_knowledge_text(
    p_query_text TEXT,
    p_max_results INT DEFAULT 10,
    p_filter_category TEXT DEFAULT NULL
)
RETURNS TABLE (
    id UUID,
    title TEXT,
    content TEXT,
    category TEXT,
    tags TEXT[],
    text_rank FLOAT
) AS $$
DECLARE
    query_tsquery tsquery;
BEGIN
    query_tsquery := plainto_tsquery('simple', p_query_text);

    RETURN QUERY
    SELECT
        kb.id,
        kb.title,
        kb.content,
        kb.category,
        kb.tags,
        ts_rank_cd(kb.search_vector, query_tsquery, 32)::FLOAT as text_rank
    FROM knowledge_base kb
    WHERE kb.search_vector @@ query_tsquery
      AND (p_filter_category IS NULL OR kb.category = p_filter_category)
    ORDER BY ts_rank_cd(kb.search_vector, query_tsquery, 32) DESC
    LIMIT p_max_results;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 8. Add comments
COMMENT ON COLUMN knowledge_base.search_vector IS 'Full-text search vector (tsvector) for BM25-style keyword matching';
COMMENT ON FUNCTION hybrid_search_with_text IS 'Hybrid RAG search combining Vector + Text (BM25) + Graph traversal';
COMMENT ON FUNCTION search_knowledge_text IS 'Text-only search using PostgreSQL full-text search (ts_rank)';
COMMENT ON FUNCTION generate_knowledge_search_vector IS 'Generates weighted tsvector from title (A) + tags (A) + content (B)';
