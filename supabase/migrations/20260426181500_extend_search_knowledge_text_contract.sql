-- Extend Knowledge Retrieval Lite text-search RPC contract.
--
-- Runtime boost logic reads severity, related_server_types, and metadata from
-- search_knowledge_text rows. The original fallback RPC only returned
-- id/title/content/category/tags/text_rank, so those boosts were ineffective.
-- Incident-oriented searches should also see troubleshooting runbooks because
-- runbooks are operational evidence, not a separate user-facing domain.

DROP FUNCTION IF EXISTS public.search_knowledge_text(TEXT, INT, TEXT);

CREATE FUNCTION public.search_knowledge_text(
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
BEGIN
    query_tsquery := plainto_tsquery('simple', p_query_text);

    RETURN QUERY
    SELECT
        kb.id,
        kb.title,
        kb.content,
        kb.category,
        COALESCE(kb.tags, '{}'::text[]) AS tags,
        COALESCE(kb.severity, 'info') AS severity,
        COALESCE(kb.related_server_types, '{}'::text[]) AS related_server_types,
        COALESCE(kb.metadata, '{}'::jsonb) AS metadata,
        ts_rank_cd(kb.search_vector, query_tsquery, 32)::FLOAT AS text_rank
    FROM public.knowledge_base kb
    WHERE kb.search_vector @@ query_tsquery
      AND (
          p_filter_category IS NULL
          OR kb.category = p_filter_category
          OR (
              p_filter_category IN ('incident', 'troubleshooting')
              AND kb.category IN ('incident', 'troubleshooting', 'best_practice')
          )
      )
    ORDER BY ts_rank_cd(kb.search_vector, query_tsquery, 32) DESC
    LIMIT p_max_results;
END;
$$;

COMMENT ON FUNCTION public.search_knowledge_text(TEXT, INT, TEXT) IS
  'Knowledge Retrieval Lite BM25 text search with runtime boost metadata and incident/runbook category adjacency';
