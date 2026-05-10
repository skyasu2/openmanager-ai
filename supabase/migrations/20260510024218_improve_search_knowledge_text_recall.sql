-- Improve Knowledge Retrieval Lite recall for multi-token operational queries.
--
-- The previous RPC used plainto_tsquery only. That made queries like
-- "cpu high load" or "disk space cleanup" too narrow because every token had
-- to match a document. Keep exact/full query matches first, but add a relaxed
-- token-prefix OR query as a deterministic fallback inside the same RPC.

CREATE OR REPLACE FUNCTION public.search_knowledge_text(
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
    severity TEXT,
    related_server_types TEXT[],
    metadata JSONB,
    text_rank FLOAT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions, pg_temp
AS $$
DECLARE
    query_tsquery tsquery;
    relaxed_tsquery tsquery;
BEGIN
    query_tsquery := plainto_tsquery('simple', COALESCE(p_query_text, ''));

    SELECT to_tsquery('simple', string_agg(token || ':*', ' | '))
      INTO relaxed_tsquery
      FROM (
        SELECT DISTINCT regexp_replace(raw_token, '[^a-z0-9가-힣]+', '', 'g') AS token
          FROM unnest(
            regexp_split_to_array(lower(COALESCE(p_query_text, '')), '[^a-z0-9가-힣]+')
          ) AS raw_token
      ) normalized_tokens
     WHERE length(token) >= 2;

    RETURN QUERY
    WITH ranked AS (
        SELECT
            kb.id,
            kb.title,
            kb.content,
            kb.category,
            COALESCE(kb.tags, '{}'::text[]) AS tags,
            COALESCE(kb.severity, 'info') AS severity,
            COALESCE(kb.related_server_types, '{}'::text[]) AS related_server_types,
            COALESCE(kb.metadata, '{}'::jsonb) AS metadata,
            (kb.search_vector @@ query_tsquery) AS primary_match,
            ts_rank_cd(kb.search_vector, query_tsquery, 32)::FLOAT AS primary_rank,
            CASE
                WHEN relaxed_tsquery IS NULL THEN 0::FLOAT
                ELSE ts_rank_cd(kb.search_vector, relaxed_tsquery, 32)::FLOAT
            END AS relaxed_rank
        FROM public.knowledge_base kb
        WHERE (
            kb.search_vector @@ query_tsquery
            OR (
                relaxed_tsquery IS NOT NULL
                AND kb.search_vector @@ relaxed_tsquery
            )
        )
          AND (
              p_filter_category IS NULL
              OR kb.category = p_filter_category
              OR (
                  p_filter_category IN ('incident', 'troubleshooting')
                  AND kb.category IN ('incident', 'troubleshooting', 'best_practice')
              )
          )
    )
    SELECT
        ranked.id,
        ranked.title,
        ranked.content,
        ranked.category,
        ranked.tags,
        ranked.severity,
        ranked.related_server_types,
        ranked.metadata,
        GREATEST(ranked.primary_rank, ranked.relaxed_rank * 0.65)::FLOAT AS text_rank
    FROM ranked
    ORDER BY
        ranked.primary_match DESC,
        GREATEST(ranked.primary_rank, ranked.relaxed_rank * 0.65) DESC,
        ranked.title ASC
    LIMIT p_max_results;
END;
$$;

COMMENT ON FUNCTION public.search_knowledge_text(TEXT, INT, TEXT) IS
  'Knowledge Retrieval Lite BM25 text search with metadata fields, incident/runbook adjacency, and relaxed token-prefix recall fallback';
