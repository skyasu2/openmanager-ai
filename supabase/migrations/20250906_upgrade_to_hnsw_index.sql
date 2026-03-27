-- ====================================================================
-- HNSW 인덱스 업그레이드 마이그레이션
-- 날짜: 2025-09-06
-- 목적: ivfflat → HNSW 인덱스로 업그레이드하여 70% 성능 향상
-- 예상 효과: 272ms → 50-100ms 응답시간 단축
-- ====================================================================

-- 1. 기존 ivfflat 인덱스 삭제
DROP INDEX IF EXISTS idx_incident_reports_embedding;
DROP INDEX IF EXISTS idx_knowledge_base_embedding;
DROP INDEX IF EXISTS command_vectors_embedding_idx;

-- 2. HNSW 인덱스 생성 - incident_reports 테이블
-- m=16: 각 노드의 최대 연결 수 (품질과 성능의 균형)
-- ef_construction=64: 생성 시 품질 파라미터 (높을수록 정확하지만 느림)
CREATE INDEX IF NOT EXISTS idx_incident_reports_embedding_hnsw 
ON incident_reports 
USING hnsw (embedding vector_cosine_ops)
WITH (m = 16, ef_construction = 64);

-- 3. HNSW 인덱스 생성 - knowledge_base 테이블
CREATE INDEX IF NOT EXISTS idx_knowledge_base_embedding_hnsw 
ON knowledge_base 
USING hnsw (embedding vector_cosine_ops)
WITH (m = 16, ef_construction = 64);

-- 4. HNSW 인덱스 생성 - command_vectors 테이블 (있는 경우)
CREATE INDEX IF NOT EXISTS idx_command_vectors_embedding_hnsw 
ON command_vectors 
USING hnsw (embedding vector_cosine_ops)
WITH (m = 16, ef_construction = 64);

-- 5. 검색 성능 최적화를 위한 런타임 설정
-- ef_search: 검색 시 품질 파라미터 (기본값 40, 더 높으면 정확하지만 느림)
-- 성능과 정확도의 균형을 위해 80으로 설정
ALTER DATABASE postgres SET hnsw.ef_search = 80;

-- 6. 인덱스 통계 업데이트
ANALYZE incident_reports;
ANALYZE knowledge_base;
ANALYZE command_vectors;

-- 7. 성능 검증을 위한 테스트 쿼리 (주석 처리됨)
/*
-- 테스트 임베딩 벡터 (384차원)
SELECT 
  id, 
  content,
  1 - (embedding <=> '[0.1,0.2,0.3,0.4,0.5,0.6,0.7,0.8,0.9,0.0,...]'::vector) as similarity
FROM knowledge_base
WHERE embedding IS NOT NULL
ORDER BY embedding <=> '[0.1,0.2,0.3,0.4,0.5,0.6,0.7,0.8,0.9,0.0,...]'::vector
LIMIT 5;
*/

-- ====================================================================
-- 마이그레이션 완료 로그
-- ====================================================================
DO $$
BEGIN
  RAISE NOTICE '✅ HNSW 인덱스 마이그레이션 완료!';
  RAISE NOTICE '📈 예상 성능 향상: 272ms → 50-100ms (70%% 향상)';
  RAISE NOTICE '🎯 ef_search = 80 (성능과 정확도 균형)';
  RAISE NOTICE '🔍 인덱스: ivfflat → HNSW (m=16, ef_construction=64)';
END $$;