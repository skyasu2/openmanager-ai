-- =============================================================================
-- GraphRAG: Knowledge Relationships Table
-- =============================================================================
-- Purpose: Store relationships (edges) between knowledge nodes for graph-based
--          retrieval augmented generation.
--
-- This enables:
-- - Cause-effect relationship traversal
-- - Related concept discovery
-- - Multi-hop reasoning
--
-- Cost Impact: $0 (uses existing Supabase PostgreSQL)
-- =============================================================================

-- Create enum for relationship types
DO $$ BEGIN
    CREATE TYPE knowledge_relationship_type AS ENUM (
        'causes',           -- A causes B (원인-결과)
        'solves',           -- A solves B (해결책)
        'related_to',       -- A is related to B (관련)
        'prerequisite',     -- A is prerequisite for B (선행조건)
        'part_of',          -- A is part of B (구성요소)
        'similar_to',       -- A is similar to B (유사)
        'contradicts',      -- A contradicts B (상충)
        'follows',          -- A follows B (순서)
        'depends_on'        -- A depends on B (의존)
    );
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- Create knowledge_relationships table (edges in the graph)
CREATE TABLE IF NOT EXISTS knowledge_relationships (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    -- Source and target nodes (references to knowledge_base or command_vectors)
    source_id UUID NOT NULL,
    target_id UUID NOT NULL,
    source_table TEXT NOT NULL DEFAULT 'knowledge_base',  -- 'knowledge_base' or 'command_vectors'
    target_table TEXT NOT NULL DEFAULT 'knowledge_base',

    -- Relationship metadata
    relationship_type knowledge_relationship_type NOT NULL,
    weight FLOAT DEFAULT 1.0,  -- Relationship strength (0.0 to 1.0)
    description TEXT,          -- Human-readable description

    -- Bidirectional flag
    bidirectional BOOLEAN DEFAULT false,

    -- Metadata
    metadata JSONB DEFAULT '{}'::jsonb,

    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),

    -- Constraints
    CONSTRAINT valid_weight CHECK (weight >= 0.0 AND weight <= 1.0),
    CONSTRAINT no_self_reference CHECK (source_id != target_id OR source_table != target_table),
    CONSTRAINT valid_source_table CHECK (source_table IN ('knowledge_base', 'command_vectors')),
    CONSTRAINT valid_target_table CHECK (target_table IN ('knowledge_base', 'command_vectors'))
);

-- Create indexes for efficient traversal
CREATE INDEX IF NOT EXISTS idx_kr_source ON knowledge_relationships(source_id, source_table);
CREATE INDEX IF NOT EXISTS idx_kr_target ON knowledge_relationships(target_id, target_table);
CREATE INDEX IF NOT EXISTS idx_kr_type ON knowledge_relationships(relationship_type);
CREATE INDEX IF NOT EXISTS idx_kr_weight ON knowledge_relationships(weight DESC);

-- Composite index for common query pattern
CREATE INDEX IF NOT EXISTS idx_kr_source_type ON knowledge_relationships(source_id, relationship_type);

-- Updated_at trigger
CREATE OR REPLACE FUNCTION update_knowledge_relationships_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_knowledge_relationships_updated_at ON knowledge_relationships;
CREATE TRIGGER trigger_knowledge_relationships_updated_at
    BEFORE UPDATE ON knowledge_relationships
    FOR EACH ROW
    EXECUTE FUNCTION update_knowledge_relationships_updated_at();

-- =============================================================================
-- Graph Traversal Functions
-- =============================================================================

-- Function: Get direct neighbors of a node
CREATE OR REPLACE FUNCTION get_knowledge_neighbors(
    p_node_id UUID,
    p_node_table TEXT DEFAULT 'knowledge_base',
    p_relationship_types knowledge_relationship_type[] DEFAULT NULL,
    p_max_results INT DEFAULT 10
)
RETURNS TABLE (
    neighbor_id UUID,
    neighbor_table TEXT,
    relationship_type knowledge_relationship_type,
    weight FLOAT,
    direction TEXT
) AS $$
BEGIN
    RETURN QUERY
    -- Outgoing relationships
    SELECT
        kr.target_id as neighbor_id,
        kr.target_table as neighbor_table,
        kr.relationship_type,
        kr.weight,
        'outgoing'::TEXT as direction
    FROM knowledge_relationships kr
    WHERE kr.source_id = p_node_id
      AND kr.source_table = p_node_table
      AND (p_relationship_types IS NULL OR kr.relationship_type = ANY(p_relationship_types))

    UNION ALL

    -- Incoming relationships (or bidirectional)
    SELECT
        kr.source_id as neighbor_id,
        kr.source_table as neighbor_table,
        kr.relationship_type,
        kr.weight,
        CASE WHEN kr.bidirectional THEN 'bidirectional' ELSE 'incoming' END::TEXT as direction
    FROM knowledge_relationships kr
    WHERE kr.target_id = p_node_id
      AND kr.target_table = p_node_table
      AND (p_relationship_types IS NULL OR kr.relationship_type = ANY(p_relationship_types))

    ORDER BY weight DESC
    LIMIT p_max_results;
END;
$$ LANGUAGE plpgsql;

-- Function: Multi-hop graph traversal (BFS up to N hops)
CREATE OR REPLACE FUNCTION traverse_knowledge_graph(
    p_start_id UUID,
    p_start_table TEXT DEFAULT 'knowledge_base',
    p_max_hops INT DEFAULT 2,
    p_relationship_types knowledge_relationship_type[] DEFAULT NULL,
    p_max_results INT DEFAULT 20
)
RETURNS TABLE (
    node_id UUID,
    node_table TEXT,
    hop_distance INT,
    path_weight FLOAT,
    relationship_path TEXT[]
) AS $$
BEGIN
    RETURN QUERY
    WITH RECURSIVE graph_traverse AS (
        -- Base case: start node
        SELECT
            p_start_id as node_id,
            p_start_table as node_table,
            0 as hop_distance,
            1.0::FLOAT as path_weight,
            ARRAY[]::TEXT[] as relationship_path,
            ARRAY[p_start_id] as visited

        UNION ALL

        -- Recursive case: traverse neighbors
        SELECT
            CASE
                WHEN kr.source_id = gt.node_id AND kr.source_table = gt.node_table
                THEN kr.target_id
                ELSE kr.source_id
            END as node_id,
            CASE
                WHEN kr.source_id = gt.node_id AND kr.source_table = gt.node_table
                THEN kr.target_table
                ELSE kr.source_table
            END as node_table,
            gt.hop_distance + 1,
            gt.path_weight * kr.weight,
            gt.relationship_path || kr.relationship_type::TEXT,
            gt.visited || CASE
                WHEN kr.source_id = gt.node_id AND kr.source_table = gt.node_table
                THEN kr.target_id
                ELSE kr.source_id
            END
        FROM graph_traverse gt
        JOIN knowledge_relationships kr ON (
            (kr.source_id = gt.node_id AND kr.source_table = gt.node_table)
            OR (kr.target_id = gt.node_id AND kr.target_table = gt.node_table AND kr.bidirectional)
        )
        WHERE gt.hop_distance < p_max_hops
          AND (p_relationship_types IS NULL OR kr.relationship_type = ANY(p_relationship_types))
          AND NOT (
              CASE
                  WHEN kr.source_id = gt.node_id AND kr.source_table = gt.node_table
                  THEN kr.target_id
                  ELSE kr.source_id
              END = ANY(gt.visited)
          )
    )
    SELECT DISTINCT ON (gt.node_id, gt.node_table)
        gt.node_id,
        gt.node_table,
        gt.hop_distance,
        gt.path_weight,
        gt.relationship_path
    FROM graph_traverse gt
    WHERE gt.hop_distance > 0  -- Exclude start node
    ORDER BY gt.node_id, gt.node_table, gt.path_weight DESC, gt.hop_distance ASC
    LIMIT p_max_results;
END;
$$ LANGUAGE plpgsql;

-- Function: Combined vector + graph search
CREATE OR REPLACE FUNCTION hybrid_graph_vector_search(
    p_query_embedding vector(384),
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
    source_type TEXT,  -- 'vector' or 'graph'
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
        gr.path_weight * 0.8 as score,  -- Graph results weighted lower
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

-- =============================================================================
-- Sample Seed Data (Server Monitoring Domain)
-- =============================================================================

-- Note: Run this only if knowledge_base has data
-- INSERT INTO knowledge_relationships (source_id, target_id, relationship_type, weight, description)
-- SELECT
--     kb1.id, kb2.id, 'causes'::knowledge_relationship_type, 0.9, 'High CPU causes memory pressure'
-- FROM knowledge_base kb1, knowledge_base kb2
-- WHERE kb1.title ILIKE '%CPU%' AND kb2.title ILIKE '%memory%'
-- LIMIT 1;

-- =============================================================================
-- RLS Policies (if needed)
-- =============================================================================

-- Enable RLS
ALTER TABLE knowledge_relationships ENABLE ROW LEVEL SECURITY;

-- Allow read access for authenticated users
CREATE POLICY "Allow read access for all" ON knowledge_relationships
    FOR SELECT USING (true);

-- Allow insert/update for service role only
CREATE POLICY "Allow write for service role" ON knowledge_relationships
    FOR ALL USING (auth.role() = 'service_role');

COMMENT ON TABLE knowledge_relationships IS 'GraphRAG: Stores relationships between knowledge nodes for graph-based retrieval';
