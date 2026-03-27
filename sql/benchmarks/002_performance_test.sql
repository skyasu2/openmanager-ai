-- MCP 성능 최적화 인덱스 벤치마크 테스트
-- 목적: 002_mcp_performance_indexes.sql 적용 전후 성능 비교
-- 작성: 2025-10-02
-- 기반: Codex "40% 개선 증거 제공" 요구사항
--
-- 사용 방법:
-- 1. 인덱스 적용 전: 이 스크립트 실행하여 Before 성능 기록
-- 2. 002_mcp_performance_indexes.sql 실행
-- 3. 인덱스 적용 후: 다시 이 스크립트 실행하여 After 성능 비교
--
-- 예상 결과:
-- • 쿼리 응답속도: 300ms → 180ms (40% 개선)
-- • Full Table Scan → Index Scan

-- 테스트 시작 메시지
DO $$
BEGIN
  RAISE NOTICE '🧪 MCP 성능 벤치마크 테스트 시작...';
  RAISE NOTICE '   • 대상: ml_training_results, command_vectors';
  RAISE NOTICE '   • 목표: 40%% 성능 개선 검증';
END $$;

-- ============================================
-- 1. ml_training_results 테이블 성능 테스트
-- ============================================

DO $$
BEGIN
  RAISE NOTICE '';
  RAISE NOTICE '📊 1. ml_training_results 성능 테스트';
END $$;

-- 1-1. server_id 필터링 쿼리 (가장 빈번한 쿼리)
EXPLAIN (ANALYZE, BUFFERS, FORMAT TEXT)
SELECT id, server_id, training_type, created_at
FROM ml_training_results
WHERE server_id = 'srv-001'
ORDER BY created_at DESC
LIMIT 10;

-- 1-2. 날짜 범위 필터링 쿼리
EXPLAIN (ANALYZE, BUFFERS, FORMAT TEXT)
SELECT id, server_id, training_type, created_at
FROM ml_training_results
WHERE created_at >= NOW() - INTERVAL '7 days'
ORDER BY created_at DESC
LIMIT 100;

-- 1-3. training_type 별 집계 쿼리
EXPLAIN (ANALYZE, BUFFERS, FORMAT TEXT)
SELECT training_type, COUNT(*) as count
FROM ml_training_results
WHERE created_at >= NOW() - INTERVAL '30 days'
GROUP BY training_type;

-- 1-4. 복합 인덱스 활용 쿼리 (server_id + created_at)
EXPLAIN (ANALYZE, BUFFERS, FORMAT TEXT)
SELECT id, server_id, training_type, created_at
FROM ml_training_results
WHERE server_id = 'srv-001'
  AND created_at >= NOW() - INTERVAL '24 hours'
ORDER BY created_at DESC
LIMIT 50;

-- ============================================
-- 2. command_vectors 테이블 성능 테스트
-- ============================================

DO $$
BEGIN
  RAISE NOTICE '';
  RAISE NOTICE '📊 2. command_vectors 성능 테스트';
END $$;

-- 2-1. 최근 명령어 조회 (created_at 인덱스 활용)
EXPLAIN (ANALYZE, BUFFERS, FORMAT TEXT)
SELECT id, command, created_at
FROM command_vectors
WHERE created_at >= NOW() - INTERVAL '1 day'
ORDER BY created_at DESC
LIMIT 20;

-- 2-2. 날짜 범위 집계 쿼리
EXPLAIN (ANALYZE, BUFFERS, FORMAT TEXT)
SELECT DATE(created_at) as date, COUNT(*) as count
FROM command_vectors
WHERE created_at >= NOW() - INTERVAL '30 days'
GROUP BY DATE(created_at)
ORDER BY date DESC;

-- ============================================
-- 3. 인덱스 사용 여부 확인
-- ============================================

DO $$
BEGIN
  RAISE NOTICE '';
  RAISE NOTICE '🔍 3. 인덱스 사용 여부 확인';
END $$;

-- 3-1. ml_training_results 인덱스 목록
SELECT
  schemaname,
  tablename,
  indexname,
  indexdef
FROM pg_indexes
WHERE tablename = 'ml_training_results'
ORDER BY indexname;

-- 3-2. command_vectors 인덱스 목록
SELECT
  schemaname,
  tablename,
  indexname,
  indexdef
FROM pg_indexes
WHERE tablename = 'command_vectors'
ORDER BY indexname;

-- ============================================
-- 4. 인덱스 크기 및 효율성 분석
-- ============================================

DO $$
BEGIN
  RAISE NOTICE '';
  RAISE NOTICE '📏 4. 인덱스 크기 및 효율성 분석';
END $$;

-- 4-1. 테이블 및 인덱스 크기
SELECT
  'ml_training_results' AS table_name,
  pg_size_pretty(pg_total_relation_size('ml_training_results')) AS total_size,
  pg_size_pretty(pg_table_size('ml_training_results')) AS table_size,
  pg_size_pretty(pg_indexes_size('ml_training_results')) AS indexes_size,
  ROUND(100.0 * pg_indexes_size('ml_training_results') / NULLIF(pg_total_relation_size('ml_training_results'), 0), 2) AS index_ratio_pct
UNION ALL
SELECT
  'command_vectors' AS table_name,
  pg_size_pretty(pg_total_relation_size('command_vectors')) AS total_size,
  pg_size_pretty(pg_table_size('command_vectors')) AS table_size,
  pg_size_pretty(pg_indexes_size('command_vectors')) AS indexes_size,
  ROUND(100.0 * pg_indexes_size('command_vectors') / NULLIF(pg_total_relation_size('command_vectors'), 0), 2) AS index_ratio_pct;

-- 4-2. 각 인덱스별 크기
SELECT
  schemaname,
  tablename,
  indexname,
  pg_size_pretty(pg_relation_size(indexrelid)) AS index_size
FROM pg_indexes
JOIN pg_class ON pg_indexes.indexname = pg_class.relname
WHERE tablename IN ('ml_training_results', 'command_vectors')
  AND indexname LIKE 'idx_%'
ORDER BY tablename, indexname;

-- ============================================
-- 5. 인덱스 사용 통계
-- ============================================

DO $$
BEGIN
  RAISE NOTICE '';
  RAISE NOTICE '📈 5. 인덱스 사용 통계';
END $$;

-- 5-1. 인덱스 스캔 횟수 확인
SELECT
  schemaname,
  tablename,
  indexname,
  idx_scan AS index_scans,
  idx_tup_read AS tuples_read,
  idx_tup_fetch AS tuples_fetched
FROM pg_stat_user_indexes
WHERE tablename IN ('ml_training_results', 'command_vectors')
ORDER BY tablename, indexname;

-- ============================================
-- 6. 성능 요약 및 권장사항
-- ============================================

DO $$
DECLARE
  ml_index_count INT;
  cv_index_count INT;
BEGIN
  -- 인덱스 개수 확인
  SELECT COUNT(*) INTO ml_index_count
  FROM pg_indexes
  WHERE tablename = 'ml_training_results'
    AND indexname LIKE 'idx_ml_training_%';

  SELECT COUNT(*) INTO cv_index_count
  FROM pg_indexes
  WHERE tablename = 'command_vectors'
    AND indexname LIKE 'idx_command_vectors_%';

  RAISE NOTICE '';
  RAISE NOTICE '✅ 성능 벤치마크 테스트 완료';
  RAISE NOTICE '   • ml_training_results 인덱스: %개', ml_index_count;
  RAISE NOTICE '   • command_vectors 인덱스: %개', cv_index_count;
  RAISE NOTICE '';
  RAISE NOTICE '💡 결과 분석 방법:';
  RAISE NOTICE '   1. EXPLAIN ANALYZE 출력에서 "Index Scan" 확인';
  RAISE NOTICE '   2. "Seq Scan"이 보이면 인덱스 미사용 (개선 필요)';
  RAISE NOTICE '   3. Execution Time 비교: 인덱스 전후 40%% 개선 예상';
  RAISE NOTICE '   4. Buffers: shared hit 비율이 높을수록 캐시 효율적';
  RAISE NOTICE '';
  RAISE NOTICE '🎯 성능 개선 목표:';
  RAISE NOTICE '   • 평균 쿼리 응답: 300ms → 180ms (40%% 개선)';
  RAISE NOTICE '   • Index Scan 사용률: 0%% → 95%%+';
  RAISE NOTICE '   • Full Table Scan 제거';
END $$;

-- ============================================
-- 7. 간편 성능 비교 쿼리 (복사해서 사용)
-- ============================================

-- 인덱스 적용 전후 실행하여 Execution Time 비교
/*
-- 테스트 쿼리 1: server_id 필터링
EXPLAIN (ANALYZE, BUFFERS)
SELECT * FROM ml_training_results WHERE server_id = 'srv-001' LIMIT 10;

-- 테스트 쿼리 2: 날짜 범위 필터링
EXPLAIN (ANALYZE, BUFFERS)
SELECT * FROM ml_training_results WHERE created_at >= NOW() - INTERVAL '7 days' LIMIT 100;

-- 테스트 쿼리 3: command_vectors 최근 조회
EXPLAIN (ANALYZE, BUFFERS)
SELECT * FROM command_vectors WHERE created_at >= NOW() - INTERVAL '1 day' LIMIT 20;
*/
