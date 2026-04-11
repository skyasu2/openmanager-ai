-- Enable pgvector extension
CREATE EXTENSION IF NOT EXISTS vector;

-- Add embedding columns to existing tables (using smaller dimensions for free tier)
ALTER TABLE incident_reports 
ADD COLUMN IF NOT EXISTS embedding vector(384),
ADD COLUMN IF NOT EXISTS embedding_model VARCHAR(50) DEFAULT 'text-embedding-004',
ADD COLUMN IF NOT EXISTS embedding_updated_at TIMESTAMP DEFAULT NOW();

-- Create index for vector similarity search
CREATE INDEX IF NOT EXISTS idx_incident_reports_embedding 
ON incident_reports 
USING ivfflat (embedding vector_cosine_ops)
WITH (lists = 100);

-- Create a lightweight knowledge base table for RAG
CREATE TABLE IF NOT EXISTS knowledge_base (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    content TEXT NOT NULL,
    metadata JSONB DEFAULT '{}',
    embedding vector(384),
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    category VARCHAR(50),
    relevance_score FLOAT DEFAULT 1.0
);

-- Index for knowledge base
CREATE INDEX IF NOT EXISTS idx_knowledge_base_embedding 
ON knowledge_base 
USING ivfflat (embedding vector_cosine_ops)
WITH (lists = 50);

-- Create GIN index for metadata search
CREATE INDEX IF NOT EXISTS idx_knowledge_base_metadata 
ON knowledge_base 
USING GIN (metadata);

-- Create text search index
CREATE INDEX IF NOT EXISTS idx_knowledge_base_content 
ON knowledge_base 
USING GIN (to_tsvector('english', content));

-- Function for hybrid search (combining vector and keyword search)
CREATE OR REPLACE FUNCTION hybrid_search(
    query_embedding vector(384),
    query_text TEXT,
    match_count INT DEFAULT 5,
    similarity_threshold FLOAT DEFAULT 0.7
)
RETURNS TABLE (
    id UUID,
    content TEXT,
    similarity FLOAT,
    relevance FLOAT,
    metadata JSONB
)
LANGUAGE plpgsql
AS $$
BEGIN
    RETURN QUERY
    WITH vector_results AS (
        SELECT 
            kb.id,
            kb.content,
            kb.metadata,
            1 - (kb.embedding <=> query_embedding) AS similarity,
            kb.relevance_score
        FROM knowledge_base kb
        WHERE kb.embedding IS NOT NULL
        AND 1 - (kb.embedding <=> query_embedding) > similarity_threshold
        ORDER BY kb.embedding <=> query_embedding
        LIMIT match_count * 2
    ),
    text_results AS (
        SELECT 
            kb.id,
            kb.content,
            kb.metadata,
            0.5 AS similarity, -- Lower weight for text search
            kb.relevance_score
        FROM knowledge_base kb
        WHERE to_tsvector('english', kb.content) @@ plainto_tsquery('english', query_text)
        LIMIT match_count
    )
    SELECT DISTINCT ON (id)
        id,
        content,
        MAX(similarity) AS similarity,
        MAX(relevance_score) AS relevance,
        metadata
    FROM (
        SELECT * FROM vector_results
        UNION ALL
        SELECT * FROM text_results
    ) combined
    GROUP BY id, content, metadata
    ORDER BY id, MAX(similarity * relevance_score) DESC
    LIMIT match_count;
END;
$$;

-- Function to search similar incidents
CREATE OR REPLACE FUNCTION search_similar_incidents(
    query_embedding vector(384),
    match_count INT DEFAULT 5,
    similarity_threshold FLOAT DEFAULT 0.7
)
RETURNS TABLE (
    id UUID,
    title TEXT,
    description TEXT,
    resolution TEXT,
    similarity FLOAT,
    created_at TIMESTAMP
)
LANGUAGE plpgsql
AS $$
BEGIN
    RETURN QUERY
    SELECT 
        ir.id,
        ir.title,
        ir.description,
        ir.resolution,
        1 - (ir.embedding <=> query_embedding) AS similarity,
        ir.created_at
    FROM incident_reports ir
    WHERE ir.embedding IS NOT NULL
    AND 1 - (ir.embedding <=> query_embedding) > similarity_threshold
    ORDER BY ir.embedding <=> query_embedding
    LIMIT match_count;
END;
$$;

-- Function to clean up old embeddings (for free tier optimization)
CREATE OR REPLACE FUNCTION cleanup_old_embeddings()
RETURNS void AS $$
BEGIN
    -- Remove embeddings from incidents older than 90 days with low relevance
    UPDATE incident_reports 
    SET embedding = NULL
    WHERE created_at < NOW() - INTERVAL '90 days'
    AND id NOT IN (
        SELECT DISTINCT incident_id 
        FROM incident_resolutions 
        WHERE created_at > NOW() - INTERVAL '30 days'
    );
    
    -- Remove old knowledge base entries with low relevance
    DELETE FROM knowledge_base
    WHERE created_at < NOW() - INTERVAL '90 days'
    AND relevance_score < 0.5;
    
    -- Vacuum to reclaim space
    VACUUM ANALYZE incident_reports;
    VACUUM ANALYZE knowledge_base;
END;
$$ LANGUAGE plpgsql;

-- Create a view for active embeddings (monitoring)
CREATE OR REPLACE VIEW embedding_stats AS
SELECT 
    'incident_reports' as table_name,
    COUNT(*) as total_records,
    COUNT(embedding) as records_with_embedding,
    ROUND(COUNT(embedding)::numeric / NULLIF(COUNT(*), 0) * 100, 2) as embedding_coverage_percent,
    pg_size_pretty(
        pg_column_size(embedding) * COUNT(embedding)
    ) as estimated_embedding_size
FROM incident_reports
UNION ALL
SELECT 
    'knowledge_base' as table_name,
    COUNT(*) as total_records,
    COUNT(embedding) as records_with_embedding,
    ROUND(COUNT(embedding)::numeric / NULLIF(COUNT(*), 0) * 100, 2) as embedding_coverage_percent,
    pg_size_pretty(
        pg_column_size(embedding) * COUNT(embedding)
    ) as estimated_embedding_size
FROM knowledge_base;

-- Grant permissions (adjust based on your RLS policies)
GRANT SELECT ON knowledge_base TO authenticated;
GRANT INSERT, UPDATE ON knowledge_base TO authenticated;
GRANT EXECUTE ON FUNCTION hybrid_search TO authenticated;
GRANT EXECUTE ON FUNCTION search_similar_incidents TO authenticated;
GRANT SELECT ON embedding_stats TO authenticated;

-- Add RLS policies for knowledge_base
ALTER TABLE knowledge_base ENABLE ROW LEVEL SECURITY;

-- Policy: Users can read all knowledge base entries
CREATE POLICY "Knowledge base entries are viewable by authenticated users" 
ON knowledge_base FOR SELECT 
TO authenticated 
USING (true);

-- Policy: Users can create knowledge base entries
CREATE POLICY "Authenticated users can create knowledge base entries" 
ON knowledge_base FOR INSERT 
TO authenticated 
WITH CHECK (true);

-- Policy: Users can update their own entries (if metadata contains user_id)
CREATE POLICY "Users can update their own knowledge base entries" 
ON knowledge_base FOR UPDATE 
TO authenticated 
USING (metadata->>'user_id' = auth.uid()::text)
WITH CHECK (metadata->>'user_id' = auth.uid()::text);

-- Add comment for documentation
COMMENT ON TABLE knowledge_base IS 'Stores embedded documents for RAG (Retrieval-Augmented Generation) with pgvector support';
COMMENT ON FUNCTION hybrid_search IS 'v1.0 - Performs hybrid search combining vector similarity and text search (Target: knowledge_base)';
COMMENT ON FUNCTION cleanup_old_embeddings IS 'Removes old embeddings to optimize storage for free tier';