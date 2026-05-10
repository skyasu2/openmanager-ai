-- Tune Knowledge Retrieval Lite ranking precision after relaxed recall fallback.
--
-- The relaxed OR fallback fixes zero-result multi-token operational queries,
-- but a one-token match such as "gateway" can outrank a more relevant web/LB
-- document. Keep recall broad, then prioritize token overlap before raw rank.

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
    query_tokens text[];
BEGIN
    query_tsquery := plainto_tsquery('simple', COALESCE(p_query_text, ''));

    SELECT array_agg(token ORDER BY token)
      INTO query_tokens
      FROM (
        SELECT DISTINCT regexp_replace(raw_token, '[^a-z0-9가-힣]+', '', 'g') AS token
          FROM unnest(
            regexp_split_to_array(lower(COALESCE(p_query_text, '')), '[^a-z0-9가-힣]+')
          ) AS raw_token
      ) normalized_tokens
     WHERE length(token) >= 2;

    IF COALESCE(array_length(query_tokens, 1), 0) > 0 THEN
        SELECT to_tsquery('simple', string_agg(token || ':*', ' | '))
          INTO relaxed_tsquery
          FROM unnest(query_tokens) AS token;
    END IF;

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
            END AS relaxed_rank,
            token_stats.token_match_count
        FROM public.knowledge_base kb
        CROSS JOIN LATERAL (
            SELECT count(*)::INT AS token_match_count
              FROM unnest(COALESCE(query_tokens, ARRAY[]::text[])) AS token
             WHERE lower(concat_ws(
                 ' ',
                 kb.title,
                 kb.content,
                 kb.category,
                 array_to_string(COALESCE(kb.tags, '{}'::text[]), ' '),
                 array_to_string(COALESCE(kb.related_server_types, '{}'::text[]), ' '),
                 COALESCE(kb.metadata, '{}'::jsonb)::TEXT
             )) LIKE '%' || token || '%'
        ) token_stats
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
        (
            GREATEST(ranked.primary_rank, ranked.relaxed_rank * 0.65)
            + LEAST(ranked.token_match_count, 3) * 0.035
        )::FLOAT AS text_rank
    FROM ranked
    ORDER BY
        ranked.primary_match DESC,
        ranked.token_match_count DESC,
        GREATEST(ranked.primary_rank, ranked.relaxed_rank * 0.65) DESC,
        ranked.title ASC
    LIMIT p_max_results;
END;
$$;

COMMENT ON FUNCTION public.search_knowledge_text(TEXT, INT, TEXT) IS
  'Knowledge Retrieval Lite BM25 text search with metadata fields, incident/runbook adjacency, relaxed recall fallback, and token-overlap precision ranking';
