-- RAG 시스템 벡터 인덱스 추가
-- 목적: command_vectors 테이블 벡터 검색 최적화
-- 작성: 2025-10-02
-- 기반: Gemini 아키텍처 제안
--
-- 적용 방법:
-- 1. Supabase 대시보드 접속: https://supabase.com/dashboard
-- 2. SQL Editor에서 이 파일 내용 실행
-- 또는
-- 3. supabase CLI: supabase db push

-- pgvector 확장 확인 및 활성화
CREATE EXTENSION IF NOT EXISTS vector;

-- command_vectors 테이블 구조 확인 메시지
DO $$
BEGIN
  RAISE NOTICE '✅ pgvector 확장 활성화 완료';
  RAISE NOTICE '📊 command_vectors 테이블 벡터 인덱스 생성 시작...';
END $$;

-- IVFFlat 벡터 인덱스 생성 (빠른 근사 검색)
-- embedding 컬럼이 vector 타입이라고 가정
-- lists = 100: 클러스터 개수 (테이블 크기에 따라 조정 가능)
CREATE INDEX IF NOT EXISTS idx_command_vectors_embedding_ivfflat
  ON command_vectors
  USING ivfflat (embedding vector_cosine_ops)
  WITH (lists = 100);

-- 대안: HNSW 인덱스 (더 빠르지만 메모리 많이 사용)
-- 주석 해제하여 사용 가능
-- CREATE INDEX IF NOT EXISTS idx_command_vectors_embedding_hnsw
--   ON command_vectors
--   USING hnsw (embedding vector_cosine_ops)
--   WITH (m = 16, ef_construction = 64);

-- 성능 측정 예시 쿼리
-- 주의: 실제 embedding 값으로 교체 필요
EXPLAIN ANALYZE
SELECT command,
       embedding <=> '[0.1, 0.2, 0.3]'::vector AS distance
FROM command_vectors
ORDER BY embedding <=> '[0.1, 0.2, 0.3]'::vector
LIMIT 10;

-- 인덱스 크기 확인
SELECT
  schemaname,
  tablename,
  indexname,
  pg_size_pretty(pg_relation_size(indexrelid)) AS index_size
FROM pg_indexes
JOIN pg_class ON pg_indexes.indexname = pg_class.relname
WHERE tablename = 'command_vectors'
  AND indexname LIKE 'idx_%'
ORDER BY indexname;

-- 테이블 전체 크기 확인
SELECT
  pg_size_pretty(pg_total_relation_size('command_vectors')) AS total_size,
  pg_size_pretty(pg_table_size('command_vectors')) AS table_size,
  pg_size_pretty(pg_indexes_size('command_vectors')) AS indexes_size;

-- 성공 메시지
DO $$
BEGIN
  RAISE NOTICE '✅ RAG 벡터 인덱스 생성 완료';
  RAISE NOTICE '   • command_vectors: IVFFlat 인덱스 (vector_cosine_ops)';
  RAISE NOTICE '   • 예상 효과: 벡터 유사도 검색 95%% 개선';
  RAISE NOTICE '   • Full Table Scan → Index Scan';
  RAISE NOTICE '   • 2000ms → 100ms (예상)';
END $$;
