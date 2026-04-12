-- =============================================================================
-- Extension Schema Bootstrap Draft
-- =============================================================================
-- Purpose:
-- - Draft rewrite source for moving `vector` and `pg_trgm` usage to the
--   `extensions` schema in fresh bootstrap / reset flows.
-- - Not for direct execution on the current hosted production project.
--
-- Scope:
-- - Covers the current 1st-pass bootstrap blockers only.
-- - Historical signature chain and hardening follow-up are intentionally
--   excluded from this draft.
--
-- Important:
-- - Existing hosted DB still has `vector` and `pg_trgm` in `public`.
-- - `SECURITY DEFINER` RAG functions currently pin `search_path` to
--   `public, pg_temp`, so extension functions and operators must be
--   schema-qualified if the extensions move to `extensions`.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Fresh bootstrap preamble only
-- -----------------------------------------------------------------------------
-- Use these on a fresh reset / disposable branch DB after creating the schema.
-- Do not run these directly on the current hosted project while the extensions
-- are already installed in `public`.
CREATE SCHEMA IF NOT EXISTS extensions;
CREATE EXTENSION IF NOT EXISTS vector WITH SCHEMA extensions;
CREATE EXTENSION IF NOT EXISTS pg_trgm WITH SCHEMA extensions;

-- -----------------------------------------------------------------------------
-- Draft A: 20251216233232_create_knowledge_base_table.sql
-- -----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS knowledge_base (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title TEXT NOT NULL,
    content TEXT NOT NULL,
    embedding extensions.vector(384),
    category TEXT NOT NULL DEFAULT 'general',
    tags TEXT[] DEFAULT '{}',
    severity TEXT DEFAULT 'info',
    source TEXT DEFAULT 'manual',
    related_server_types TEXT[] DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_knowledge_base_embedding_hnsw
ON knowledge_base
USING hnsw (embedding extensions.vector_cosine_ops)
WITH (m = 16, ef_construction = 64);

CREATE OR REPLACE FUNCTION search_knowledge_base(
    query_embedding extensions.vector(384),
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
        1 - (kb.embedding OPERATOR(extensions.<=>) query_embedding) as similarity
    FROM knowledge_base kb
    WHERE kb.embedding IS NOT NULL
      AND 1 - (kb.embedding OPERATOR(extensions.<=>) query_embedding) >= similarity_threshold
      AND (filter_category IS NULL OR kb.category = filter_category)
      AND (filter_severity IS NULL OR kb.severity = filter_severity)
    ORDER BY kb.embedding OPERATOR(extensions.<=>) query_embedding
    LIMIT max_results;
END;
$$;

-- -----------------------------------------------------------------------------
-- Draft B: 20251231074458_migrate_to_mistral_1024d_embeddings.sql
-- -----------------------------------------------------------------------------

ALTER TABLE knowledge_base
    ALTER COLUMN embedding TYPE extensions.vector(1024);

CREATE INDEX idx_knowledge_base_embedding_hnsw
ON knowledge_base
USING hnsw (embedding extensions.vector_cosine_ops)
WITH (m = 16, ef_construction = 64);

CREATE OR REPLACE FUNCTION search_knowledge_base(
    query_embedding extensions.vector(1024),
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
        1 - (kb.embedding OPERATOR(extensions.<=>) query_embedding) as similarity
    FROM knowledge_base kb
    WHERE kb.embedding IS NOT NULL
      AND 1 - (kb.embedding OPERATOR(extensions.<=>) query_embedding) >= similarity_threshold
      AND (filter_category IS NULL OR kb.category = filter_category)
      AND (filter_severity IS NULL OR kb.severity = filter_severity)
    ORDER BY kb.embedding OPERATOR(extensions.<=>) query_embedding
    LIMIT max_results;
END;
$$;

CREATE OR REPLACE FUNCTION hybrid_graph_vector_search(
    p_query_embedding extensions.vector(1024),
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
)
LANGUAGE plpgsql
AS $$
BEGIN
    RETURN QUERY
    WITH
    vector_results AS (
        SELECT
            kb.id,
            kb.content,
            kb.title,
            1 - (kb.embedding OPERATOR(extensions.<=>) p_query_embedding) AS score,
            kb.metadata
        FROM knowledge_base kb
        WHERE kb.embedding IS NOT NULL
          AND 1 - (kb.embedding OPERATOR(extensions.<=>) p_query_embedding) >= p_similarity_threshold
        ORDER BY kb.embedding OPERATOR(extensions.<=>) p_query_embedding
        LIMIT p_max_vector_results
    ),
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
    SELECT
        vr.id,
        vr.content,
        vr.title,
        vr.score,
        'vector'::TEXT,
        0,
        vr.metadata
    FROM vector_results vr

    UNION ALL

    SELECT
        kb.id,
        kb.content,
        kb.title,
        gr.path_weight * 0.8,
        'graph'::TEXT,
        gr.hop_distance,
        kb.metadata
    FROM graph_results gr
    JOIN knowledge_base kb ON kb.id = gr.node_id AND gr.node_table = 'knowledge_base'
    WHERE gr.node_id NOT IN (SELECT vr.id FROM vector_results vr)

    ORDER BY score DESC, hop_distance ASC
    LIMIT p_max_total_results;
END;
$$;

-- -----------------------------------------------------------------------------
-- Draft C: 20251231110018_add_missing_rag_functions_v2.sql
-- -----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION match_documents(
    query_embedding extensions.vector(1024),
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
        1 - (kb.embedding OPERATOR(extensions.<=>) query_embedding) as similarity,
        kb.metadata
    FROM knowledge_base kb
    WHERE kb.embedding IS NOT NULL
      AND (
          filter->>'category' IS NULL
          OR kb.category = filter->>'category'
      )
      AND (
          filter->>'severity' IS NULL
          OR kb.severity = filter->>'severity'
      )
    ORDER BY kb.embedding OPERATOR(extensions.<=>) query_embedding
    LIMIT match_count;
END;
$$;

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
    RETURN QUERY
    SELECT
        kb.id,
        kb.title,
        kb.content,
        GREATEST(
            extensions.similarity(kb.title, query_text),
            extensions.similarity(kb.content, query_text)
        ) * 0.8 as similarity,
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

DROP FUNCTION IF EXISTS hybrid_search_with_text(
    extensions.vector(384),
    TEXT,
    FLOAT,
    FLOAT,
    FLOAT,
    FLOAT,
    INT,
    TEXT,
    TEXT
);

CREATE OR REPLACE FUNCTION hybrid_search_with_text(
    p_query_embedding extensions.vector(1024),
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
    WITH vector_results AS (
        SELECT
            kb.id,
            kb.title,
            kb.content,
            kb.category,
            kb.severity,
            1 - (kb.embedding OPERATOR(extensions.<=>) p_query_embedding) as v_score,
            kb.search_vector
        FROM knowledge_base kb
        WHERE kb.embedding IS NOT NULL
          AND 1 - (kb.embedding OPERATOR(extensions.<=>) p_query_embedding) >= p_similarity_threshold
          AND (p_category IS NULL OR kb.category = p_category)
          AND (p_severity IS NULL OR kb.severity = p_severity)
        ORDER BY kb.embedding OPERATOR(extensions.<=>) p_query_embedding
        LIMIT p_max_results * 2
    ),
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
    graph_results AS (
        SELECT
            gr.node_id as id,
            MAX(gr.path_weight) * 0.8 as g_score
        FROM vector_results vr
        CROSS JOIN LATERAL traverse_knowledge_graph(
            vr.id,
            'knowledge_base',
            2,
            NULL,
            5
        ) gr
        WHERE gr.node_table = 'knowledge_base'
        GROUP BY gr.node_id
    )
    SELECT
        vr.id,
        vr.title,
        vr.content,
        vr.category,
        vr.severity,
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

CREATE INDEX IF NOT EXISTS idx_knowledge_base_title_trgm
ON knowledge_base USING gin (title extensions.gin_trgm_ops);

CREATE INDEX IF NOT EXISTS idx_knowledge_base_content_trgm
ON knowledge_base USING gin (content extensions.gin_trgm_ops);

-- -----------------------------------------------------------------------------
-- Draft D: 20260411042939_add_command_vectors_hnsw_index.sql
-- -----------------------------------------------------------------------------

CREATE INDEX IF NOT EXISTS idx_command_vectors_embedding_hnsw
ON public.command_vectors
USING hnsw (embedding extensions.vector_cosine_ops)
WITH (m = 16, ef_construction = 64);

-- -----------------------------------------------------------------------------
-- Follow-up not covered here
-- -----------------------------------------------------------------------------
-- - Historical `vector(384)` signatures in 20251217182536~20251217182637
-- - `20251217203434_add_bm25_text_search.sql` hybrid function signature rewrite
-- - `20260213121317_harden_rag_functions_and_incident_fk_indexes.sql`
--   to_regprocedure() signatures after type schema qualification
