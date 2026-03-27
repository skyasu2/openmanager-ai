-- MCP 성능 최적화 인덱스 추가
-- 목적: Supabase MCP 응답속도 40% 개선 (300ms → 180ms)
-- 작성: 2025-10-02
-- 기반: Codex 실무 제안
--
-- 적용 방법:
-- 1. Supabase 대시보드 접속: https://supabase.com/dashboard
-- 2. SQL Editor에서 이 파일 내용 실행
-- 또는
-- 3. supabase CLI: supabase db push

-- ml_training_results 테이블 인덱스
CREATE INDEX IF NOT EXISTS idx_ml_training_server_id
  ON ml_training_results(server_id);

CREATE INDEX IF NOT EXISTS idx_ml_training_created_at
  ON ml_training_results(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_ml_training_type
  ON ml_training_results(type);

-- command_vectors 테이블 인덱스 (RAG 성능 개선)
CREATE INDEX IF NOT EXISTS idx_command_vectors_created_at
  ON command_vectors(created_at DESC);

-- 복합 인덱스 (자주 함께 조회되는 컬럼)
CREATE INDEX IF NOT EXISTS idx_ml_training_server_created
  ON ml_training_results(server_id, created_at DESC);

-- 인덱스 생성 확인
SELECT
  schemaname,
  tablename,
  indexname
FROM pg_indexes
WHERE tablename IN ('ml_training_results', 'command_vectors')
ORDER BY tablename, indexname;

-- 성공 메시지
DO $$
BEGIN
  RAISE NOTICE '✅ MCP 성능 최적화 인덱스 생성 완료';
  RAISE NOTICE '   • ml_training_results: 3개 단일 인덱스, 1개 복합 인덱스';
  RAISE NOTICE '   • command_vectors: 1개 인덱스';
  RAISE NOTICE '   • 예상 효과: 쿼리 응답속도 40%% 개선 (300ms → 180ms)';
END $$;
