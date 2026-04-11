-- 20250806_pgvector_native_functions.sql
-- Canonical bootstrap for public.command_vectors helper functions (remote-schema rewrite)
-- Purpose: align local function bootstrap with the current hosted command_vectors helpers.
-- Notes:
-- - authoritative signatures follow the current remote schema (`id text`, generic `vector` arg)
-- - remote history stubs `20250805061846~20250805114205` preserve the split execution trail
-- - this file is the fresh-bootstrap canonical pack only

CREATE OR REPLACE FUNCTION public.search_similar_vectors(
  query_embedding vector,
  similarity_threshold double precision DEFAULT 0.3,
  max_results integer DEFAULT 10
)
RETURNS TABLE (
  id text,
  content text,
  metadata jsonb,
  similarity double precision
)
LANGUAGE plpgsql
SET search_path TO 'public', 'pg_catalog'
AS $function$
BEGIN
  RETURN QUERY
  SELECT
    cv.id,
    cv.content,
    cv.metadata,
    1 - (cv.embedding <=> query_embedding) AS similarity
  FROM public.command_vectors cv
  WHERE cv.embedding IS NOT NULL
    AND 1 - (cv.embedding <=> query_embedding) >= similarity_threshold
  ORDER BY cv.embedding <=> query_embedding
  LIMIT max_results;
END;
$function$;

CREATE OR REPLACE FUNCTION public.search_vectors_by_category(
  query_embedding vector,
  search_category text,
  similarity_threshold double precision DEFAULT 0.3,
  max_results integer DEFAULT 10
)
RETURNS TABLE (
  id text,
  content text,
  metadata jsonb,
  similarity double precision
)
LANGUAGE plpgsql
SET search_path TO 'public', 'pg_catalog'
AS $function$
BEGIN
  RETURN QUERY
  SELECT
    cv.id,
    cv.content,
    cv.metadata,
    1 - (cv.embedding <=> query_embedding) AS similarity
  FROM public.command_vectors cv
  WHERE cv.embedding IS NOT NULL
    AND cv.metadata->>'category' = search_category
    AND 1 - (cv.embedding <=> query_embedding) >= similarity_threshold
  ORDER BY cv.embedding <=> query_embedding
  LIMIT max_results;
END;
$function$;

CREATE OR REPLACE FUNCTION public.hybrid_search_vectors(
  query_embedding vector,
  text_query text,
  similarity_threshold double precision DEFAULT 0.3,
  max_results integer DEFAULT 10
)
RETURNS TABLE (
  id text,
  content text,
  metadata jsonb,
  similarity double precision,
  text_rank double precision
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_catalog'
AS $function$
BEGIN
  RETURN QUERY
  WITH vector_search AS (
    SELECT
      cv.id,
      cv.content,
      cv.metadata,
      (1 - (cv.embedding <=> query_embedding))::double precision AS vector_similarity
    FROM public.command_vectors cv
    WHERE cv.embedding IS NOT NULL
      AND 1 - (cv.embedding <=> query_embedding) >= similarity_threshold
  ),
  text_search AS (
    SELECT
      cv.id,
      CASE
        WHEN cv.content ILIKE '%' || text_query || '%' THEN 0.8::double precision
        WHEN cv.metadata::text ILIKE '%' || text_query || '%' THEN 0.5::double precision
        ELSE 0.0::double precision
      END AS text_score
    FROM public.command_vectors cv
    WHERE text_query IS NOT NULL AND text_query != ''
  )
  SELECT
    vs.id,
    vs.content,
    vs.metadata,
    vs.vector_similarity AS similarity,
    COALESCE(ts.text_score, 0.0::double precision) AS text_rank
  FROM vector_search vs
  LEFT JOIN text_search ts ON vs.id = ts.id
  ORDER BY (vs.vector_similarity * 0.7 + COALESCE(ts.text_score, 0.0) * 0.3) DESC
  LIMIT max_results;
END;
$function$;

CREATE OR REPLACE FUNCTION public.get_vector_stats()
RETURNS TABLE (
  total_documents bigint,
  total_categories bigint,
  avg_content_length double precision,
  null_embeddings bigint
)
LANGUAGE plpgsql
SET search_path TO 'public', 'pg_catalog'
AS $function$
BEGIN
  RETURN QUERY
  SELECT
    COUNT(*)::bigint AS total_documents,
    COUNT(DISTINCT metadata->>'category')::bigint AS total_categories,
    AVG(LENGTH(content))::float AS avg_content_length,
    COUNT(*) FILTER (WHERE embedding IS NULL)::bigint AS null_embeddings
  FROM public.command_vectors;
END;
$function$;

CREATE OR REPLACE FUNCTION public.search_vectors_with_filters(
  query_embedding vector,
  metadata_filter jsonb DEFAULT '{}'::jsonb,
  similarity_threshold double precision DEFAULT 0.3,
  max_results integer DEFAULT 10
)
RETURNS TABLE (
  id text,
  content text,
  metadata jsonb,
  similarity double precision
)
LANGUAGE plpgsql
SET search_path TO 'public', 'pg_catalog'
AS $function$
BEGIN
  RETURN QUERY
  SELECT
    cv.id,
    cv.content,
    cv.metadata,
    1 - (cv.embedding <=> query_embedding) AS similarity
  FROM public.command_vectors cv
  WHERE cv.embedding IS NOT NULL
    AND 1 - (cv.embedding <=> query_embedding) >= similarity_threshold
    AND (
      metadata_filter = '{}'::jsonb
      OR cv.metadata @> metadata_filter
    )
  ORDER BY cv.embedding <=> query_embedding
  LIMIT max_results;
END;
$function$;
