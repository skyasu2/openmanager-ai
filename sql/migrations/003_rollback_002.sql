-- 002_mcp_performance_indexes.sql 롤백 스크립트
-- 목적: 인덱스 생성 실패 또는 성능 저하 시 복구
-- 작성: 2025-10-02
-- 기반: Gemini 운영 안정성 제안
--
-- 사용 시나리오:
-- 1. 인덱스 생성 실패로 인한 롤백
-- 2. 예상치 못한 성능 저하 발견
-- 3. 디스크 공간 부족으로 인한 복구
--
-- 적용 방법:
-- 1. Supabase 대시보드 SQL Editor에서 실행
-- 또는
-- 2. supabase CLI: psql $DATABASE_URL < sql/migrations/003_rollback_002.sql

-- 롤백 시작 메시지
DO $$
BEGIN
  RAISE NOTICE '🔄 002_mcp_performance_indexes.sql 롤백 시작...';
END $$;

-- 1. ml_training_results 테이블 인덱스 삭제
DROP INDEX IF EXISTS idx_ml_training_server_id;
DROP INDEX IF EXISTS idx_ml_training_created_at;
DROP INDEX IF EXISTS idx_ml_training_type;
DROP INDEX IF EXISTS idx_ml_training_server_created;

-- 2. command_vectors 테이블 인덱스 삭제
DROP INDEX IF EXISTS idx_command_vectors_created_at;

-- 롤백 확인 쿼리
SELECT
  COUNT(*) as remaining_mcp_indexes,
  CASE
    WHEN COUNT(*) = 0 THEN '✅ 모든 MCP 인덱스 삭제 완료'
    ELSE '⚠️ 일부 인덱스 남아있음 - 수동 확인 필요'
  END as rollback_status
FROM pg_indexes
WHERE tablename IN ('ml_training_results', 'command_vectors')
  AND indexname IN (
    'idx_ml_training_server_id',
    'idx_ml_training_created_at',
    'idx_ml_training_type',
    'idx_ml_training_server_created',
    'idx_command_vectors_created_at'
  );

-- 테이블 크기 변화 확인
SELECT
  'ml_training_results' AS table_name,
  pg_size_pretty(pg_total_relation_size('ml_training_results')) AS total_size,
  pg_size_pretty(pg_table_size('ml_training_results')) AS table_size,
  pg_size_pretty(pg_indexes_size('ml_training_results')) AS indexes_size
UNION ALL
SELECT
  'command_vectors' AS table_name,
  pg_size_pretty(pg_total_relation_size('command_vectors')) AS total_size,
  pg_size_pretty(pg_table_size('command_vectors')) AS table_size,
  pg_size_pretty(pg_indexes_size('command_vectors')) AS indexes_size;

-- 성공 메시지
DO $$
BEGIN
  RAISE NOTICE '✅ 롤백 완료';
  RAISE NOTICE '   • 삭제된 인덱스: 5개';
  RAISE NOTICE '   • ml_training_results: 4개 인덱스 제거';
  RAISE NOTICE '   • command_vectors: 1개 인덱스 제거';
  RAISE NOTICE '📊 테이블 크기 및 나머지 인덱스 확인 완료';
END $$;

-- 롤백 후 재적용 방법
DO $$
BEGIN
  RAISE NOTICE '';
  RAISE NOTICE '💡 롤백 후 재적용 방법:';
  RAISE NOTICE '   1. 문제 원인 파악 및 해결';
  RAISE NOTICE '   2. 002_mcp_performance_indexes.sql 재실행';
  RAISE NOTICE '   3. 성능 벤치마크로 개선 확인 (sql/benchmarks/002_performance_test.sql)';
END $$;
