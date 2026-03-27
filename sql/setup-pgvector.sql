-- =========================================
-- 🗄️ Supabase pgvector 설정 스크립트
-- =========================================

-- Verified 2025-12-12
-- Enable pgvector extension
CREATE EXTENSION IF NOT EXISTS vector;

-- 2. 벡터 문서 테이블 생성
CREATE TABLE IF NOT EXISTS vector_documents (
  id TEXT PRIMARY KEY,
  content TEXT NOT NULL,
  embedding vector(384), -- 최적화된 차원 (384)
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. 벡터 유사도 검색을 위한 인덱스 생성
CREATE INDEX IF NOT EXISTS vector_documents_embedding_idx 
ON vector_documents USING ivfflat (embedding vector_cosine_ops) 
WITH (lists = 100);

-- 4. 메타데이터 검색을 위한 GIN 인덱스
CREATE INDEX IF NOT EXISTS vector_documents_metadata_idx 
ON vector_documents USING GIN (metadata);

-- 5. 카테고리별 인덱스 (자주 사용되는 필터)
CREATE INDEX IF NOT EXISTS vector_documents_category_idx 
ON vector_documents ((metadata->>'category'));

-- 6. 업데이트 시간 자동 갱신 함수
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 7. 업데이트 트리거 생성
DROP TRIGGER IF EXISTS update_vector_documents_updated_at ON vector_documents;
CREATE TRIGGER update_vector_documents_updated_at
    BEFORE UPDATE ON vector_documents
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- =========================================
-- 🛠️ 헬퍼 함수들
-- =========================================

-- 벡터 유사도 검색 함수
CREATE OR REPLACE FUNCTION search_documents(
  query_embedding vector(384),
  match_threshold float DEFAULT 0.3,
  match_count int DEFAULT 10,
  metadata_filter jsonb DEFAULT '{}'::jsonb
)
RETURNS TABLE (
  id text,
  content text,
  metadata jsonb,
  similarity float
)
LANGUAGE sql STABLE
AS $$
  SELECT
    vector_documents.id,
    vector_documents.content,
    vector_documents.metadata,
    1 - (vector_documents.embedding <=> query_embedding) AS similarity
  FROM vector_documents
  WHERE 
    (metadata_filter = '{}'::jsonb OR vector_documents.metadata @> metadata_filter)
    AND 1 - (vector_documents.embedding <=> query_embedding) > match_threshold
  ORDER BY vector_documents.embedding <=> query_embedding
  LIMIT match_count;
$$;

-- 카테고리별 검색 함수
CREATE OR REPLACE FUNCTION search_by_category(
  query_embedding vector(384),
  category text,
  match_count int DEFAULT 10
)
RETURNS TABLE (
  id text,
  content text,
  metadata jsonb,
  similarity float
)
LANGUAGE sql STABLE
AS $$
  SELECT
    vector_documents.id,
    vector_documents.content,
    vector_documents.metadata,
    1 - (vector_documents.embedding <=> query_embedding) AS similarity
  FROM vector_documents
  WHERE 
    metadata->>'category' = category
  ORDER BY vector_documents.embedding <=> query_embedding
  LIMIT match_count;
$$;

-- 벡터 삽입/업데이트 함수
CREATE OR REPLACE FUNCTION upsert_document(
  doc_id text,
  doc_content text,
  doc_embedding vector(384),
  doc_metadata jsonb DEFAULT '{}'::jsonb
)
RETURNS void
LANGUAGE plpgsql
AS $$
BEGIN
  INSERT INTO vector_documents (id, content, embedding, metadata)
  VALUES (doc_id, doc_content, doc_embedding, doc_metadata)
  ON CONFLICT (id) 
  DO UPDATE SET
    content = EXCLUDED.content,
    embedding = EXCLUDED.embedding,
    metadata = EXCLUDED.metadata,
    updated_at = NOW();
END;
$$;

-- 문서 삭제 함수
CREATE OR REPLACE FUNCTION delete_document(doc_id text)
RETURNS boolean
LANGUAGE plpgsql
AS $$
DECLARE
  deleted_count int;
BEGIN
  DELETE FROM vector_documents WHERE id = doc_id;
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  RETURN deleted_count > 0;
END;
$$;

-- 카테고리별 문서 개수 조회
CREATE OR REPLACE FUNCTION get_category_stats()
RETURNS TABLE (
  category text,
  document_count bigint
)
LANGUAGE sql STABLE
AS $$
  SELECT 
    metadata->>'category' as category,
    COUNT(*) as document_count
  FROM vector_documents
  WHERE metadata->>'category' IS NOT NULL
  GROUP BY metadata->>'category'
  ORDER BY document_count DESC;
$$;

-- =========================================
-- 🔍 RAG 시스템 지원 함수들
-- =========================================

-- 하이브리드 검색 (벡터 + 텍스트)
CREATE OR REPLACE FUNCTION hybrid_search(
  query_embedding vector(384),
  text_query text,
  match_count int DEFAULT 10
)
RETURNS TABLE (
  id text,
  content text,
  metadata jsonb,
  vector_similarity float,
  text_rank float,
  combined_score float
)
LANGUAGE sql STABLE
AS $$
  WITH vector_results AS (
    SELECT
      id,
      content,
      metadata,
      1 - (embedding <=> query_embedding) AS vector_similarity
    FROM vector_documents
    WHERE embedding IS NOT NULL
    ORDER BY embedding <=> query_embedding
    LIMIT match_count * 2
  ),
  text_results AS (
    SELECT
      id,
      ts_rank_cd(to_tsvector('english', content), plainto_tsquery('english', text_query)) AS text_rank
    FROM vector_documents
    WHERE to_tsvector('english', content) @@ plainto_tsquery('english', text_query)
    LIMIT match_count * 2
  )
  SELECT 
    v.id,
    v.content,
    v.metadata,
    v.vector_similarity,
    COALESCE(t.text_rank, 0) AS text_rank,
    (v.vector_similarity * 0.7 + COALESCE(t.text_rank, 0) * 0.3) AS combined_score
  FROM vector_results v
  LEFT JOIN text_results t ON v.id = t.id
  ORDER BY combined_score DESC
  LIMIT match_count;
$$;

-- =========================================
-- 🚀 초기 데이터 설정
-- =========================================

-- 시스템 카테고리 정의
INSERT INTO vector_documents (id, content, metadata) VALUES
('category_system', '시스템 모니터링 관련 명령어 및 가이드', '{"category": "system", "type": "category_definition"}'),
('category_mysql', 'MySQL 데이터베이스 관련 명령어 및 트러블슈팅', '{"category": "mysql", "type": "category_definition"}'),
('category_kubernetes', 'Kubernetes 및 컨테이너 관련 가이드', '{"category": "kubernetes", "type": "category_definition"}'),
('category_monitoring', '모니터링 도구 및 메트릭 수집 가이드', '{"category": "monitoring", "type": "category_definition"}'),
('category_troubleshooting', '일반적인 문제 해결 가이드', '{"category": "troubleshooting", "type": "category_definition"}')
ON CONFLICT (id) DO NOTHING;

-- =========================================
-- 📊 통계 및 유지보수 뷰
-- =========================================

-- 벡터 문서 통계 뷰
CREATE OR REPLACE VIEW vector_documents_stats AS
SELECT
  COUNT(*) AS total_documents,
  COUNT(DISTINCT metadata->>'category') AS total_categories,
  AVG(length(content)) AS avg_content_length,
  MAX(updated_at) AS last_updated
FROM vector_documents;

-- RLS (Row Level Security) 정책 설정
ALTER TABLE vector_documents ENABLE ROW LEVEL SECURITY;

-- 읽기 권한은 모든 사용자에게
CREATE POLICY "vector_documents_read_policy" ON vector_documents
  FOR SELECT USING (true);

-- 쓰기 권한은 인증된 사용자만
CREATE POLICY "vector_documents_write_policy" ON vector_documents
  FOR ALL USING (auth.role() = 'authenticated');

-- =========================================
-- 🔄 마이그레이션 완료 표시
-- =========================================
INSERT INTO _supabase_migrations (version, name, executed_at) 
VALUES ('v1.0.0', 'setup_pgvector', NOW())
ON CONFLICT DO NOTHING;