-- 20260126_update_hybrid_search_vector_dim.sql
-- Canonical bootstrap patch for public.hybrid_search_with_text (remote-schema rewrite)
-- Purpose: align the local patch ledger with the current hosted knowledge_base hybrid search function.
-- Notes:
-- - this is not a command_vectors dimension migration anymore
-- - authoritative definition follows the current remote hybrid_search_with_text function
-- - migrate_to_mistral_1024d_embeddings + add_missing_rag_functions_v2 remain the earlier chain context

CREATE OR REPLACE FUNCTION public.hybrid_search_with_text(
    p_query_embedding vector,
    p_query_text text DEFAULT NULL::text,
    p_similarity_threshold double precision DEFAULT 0.5,
    p_text_weight double precision DEFAULT 0.3,
    p_vector_weight double precision DEFAULT 0.5,
    p_graph_weight double precision DEFAULT 0.2,
    p_max_vector_results integer DEFAULT 5,
    p_max_text_results integer DEFAULT 5,
    p_max_graph_hops integer DEFAULT 2,
    p_max_total_results integer DEFAULT 15,
    p_filter_category text DEFAULT NULL::text
)
RETURNS TABLE(
    id uuid,
    content text,
    title text,
    category text,
    score double precision,
    vector_score double precision,
    text_score double precision,
    graph_score double precision,
    source_type text,
    hop_distance integer
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
    query_tsquery tsquery;
BEGIN
    IF p_query_text IS NOT NULL AND p_query_text != '' THEN
        query_tsquery := plainto_tsquery('simple', p_query_text);
    ELSE
        query_tsquery := NULL;
    END IF;

    RETURN QUERY
    WITH
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
    initial_results AS (
        SELECT * FROM vector_results
        UNION ALL
        SELECT * FROM text_results
    ),
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
$function$;
