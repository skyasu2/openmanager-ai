-- 🚀 pgvector 네이티브 함수들
-- 성능 최적화를 위한 PostgreSQL 함수 모음

-- 1. 기본 코사인 유사도 검색 함수
CREATE OR REPLACE FUNCTION search_similar_vectors(
  query_embedding vector(384),
  similarity_threshold float DEFAULT 0.3,
  max_results int DEFAULT 10
)
RETURNS TABLE (
  id uuid,
  content text,
  metadata jsonb,
  similarity float
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    cv.id,
    cv.content,
    cv.metadata,
    1 - (cv.embedding <=> query_embedding) as similarity
  FROM command_vectors cv
  WHERE cv.embedding IS NOT NULL
    AND 1 - (cv.embedding <=> query_embedding) >= similarity_threshold
  ORDER BY cv.embedding <=> query_embedding
  LIMIT max_results;
END;
$$;

-- 2. 카테고리별 벡터 검색 함수
CREATE OR REPLACE FUNCTION search_vectors_by_category(
  query_embedding vector(384),
  search_category text,
  similarity_threshold float DEFAULT 0.3,
  max_results int DEFAULT 10
)
RETURNS TABLE (
  id uuid,
  content text,
  metadata jsonb,
  similarity float
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    cv.id,
    cv.content,
    cv.metadata,
    1 - (cv.embedding <=> query_embedding) as similarity
  FROM command_vectors cv
  WHERE cv.embedding IS NOT NULL
    AND cv.metadata->>'category' = search_category
    AND 1 - (cv.embedding <=> query_embedding) >= similarity_threshold
  ORDER BY cv.embedding <=> query_embedding
  LIMIT max_results;
END;
$$;

-- 3. 하이브리드 검색 (벡터 + 텍스트)
CREATE OR REPLACE FUNCTION hybrid_search_vectors(
  query_embedding vector(384),
  text_query text,
  similarity_threshold float DEFAULT 0.3,
  max_results int DEFAULT 10
)
RETURNS TABLE (
  id uuid,
  content text,
  metadata jsonb,
  similarity float,
  text_rank float
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  WITH vector_search AS (
    -- 벡터 유사도 검색
    SELECT 
      cv.id,
      cv.content,
      cv.metadata,
      1 - (cv.embedding <=> query_embedding) as vector_similarity
    FROM command_vectors cv
    WHERE cv.embedding IS NOT NULL
      AND 1 - (cv.embedding <=> query_embedding) >= similarity_threshold
  ),
  text_search AS (
    -- 텍스트 검색 (to_tsvector가 없으면 LIKE 사용)
    SELECT 
      cv.id,
      CASE 
        WHEN cv.content ILIKE '%' || text_query || '%' THEN 0.8
        WHEN cv.metadata::text ILIKE '%' || text_query || '%' THEN 0.5
        ELSE 0.0
      END as text_score
    FROM command_vectors cv
    WHERE text_query IS NOT NULL AND text_query != ''
  )
  SELECT 
    vs.id,
    vs.content,
    vs.metadata,
    vs.vector_similarity as similarity,
    COALESCE(ts.text_score, 0.0) as text_rank
  FROM vector_search vs
  LEFT JOIN text_search ts ON vs.id = ts.id
  ORDER BY 
    -- 가중 평균: 벡터 70%, 텍스트 30%
    (vs.vector_similarity * 0.7 + COALESCE(ts.text_score, 0.0) * 0.3) DESC
  LIMIT max_results;
END;
$$;

-- 4. 벡터 통계 함수
CREATE OR REPLACE FUNCTION get_vector_stats()
RETURNS TABLE (
  total_documents bigint,
  total_categories bigint,
  avg_content_length float,
  null_embeddings bigint
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    COUNT(*)::bigint as total_documents,
    COUNT(DISTINCT metadata->>'category')::bigint as total_categories,
    AVG(LENGTH(content))::float as avg_content_length,
    COUNT(*) FILTER (WHERE embedding IS NULL)::bigint as null_embeddings
  FROM command_vectors;
END;
$$;

-- 5. 메타데이터 필터링 검색
CREATE OR REPLACE FUNCTION search_vectors_with_filters(
  query_embedding vector(384),
  metadata_filter jsonb DEFAULT '{}',
  similarity_threshold float DEFAULT 0.3,
  max_results int DEFAULT 10
)
RETURNS TABLE (
  id uuid,
  content text,
  metadata jsonb,
  similarity float
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    cv.id,
    cv.content,
    cv.metadata,
    1 - (cv.embedding <=> query_embedding) as similarity
  FROM command_vectors cv
  WHERE cv.embedding IS NOT NULL
    AND 1 - (cv.embedding <=> query_embedding) >= similarity_threshold
    AND (
      metadata_filter = '{}'::jsonb 
      OR cv.metadata @> metadata_filter
    )
  ORDER BY cv.embedding <=> query_embedding
  LIMIT max_results;
END;
$$;

-- 권한 부여 (필요한 경우)
GRANT EXECUTE ON FUNCTION search_similar_vectors TO anon, authenticated;
GRANT EXECUTE ON FUNCTION search_vectors_by_category TO anon, authenticated;
GRANT EXECUTE ON FUNCTION hybrid_search_vectors TO anon, authenticated;
GRANT EXECUTE ON FUNCTION get_vector_stats TO anon, authenticated;
GRANT EXECUTE ON FUNCTION search_vectors_with_filters TO anon, authenticated;

-- 인덱스가 없으면 생성
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes 
    WHERE indexname = 'command_vectors_embedding_idx'
  ) THEN
    CREATE INDEX command_vectors_embedding_idx 
    ON command_vectors 
    USING ivfflat (embedding vector_cosine_ops)
    WITH (lists = 27);  -- sqrt(714) 최적화
  END IF;
END $$;