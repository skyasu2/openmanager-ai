-- 🚀 OpenManager VIBE v5 - server_metrics 테이블 최적화
-- Phase 2: 성능 병목 해결 및 인덱스 최적화
-- 최종 업데이트: 2025-08-10T16:55:00+09:00

-- =============================================
-- 1. 성능 최적화 인덱스 생성
-- =============================================

-- 1.1. 최신 데이터 조회 최적화 (시계열 데이터의 핵심)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_server_metrics_time_desc 
ON server_metrics (last_updated DESC);

-- 1.2. 서버별 최신 상태 조회 최적화
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_server_metrics_server_time 
ON server_metrics (id, last_updated DESC);

-- 1.3. 환경별 서버 필터링 최적화
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_server_metrics_env_status 
ON server_metrics (environment, status) 
WHERE environment IN ('production', 'staging', 'development');

-- 1.4. 고부하 서버 감지 최적화 (알람 시스템용)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_server_metrics_high_usage 
ON server_metrics (cpu_usage, memory_usage, disk_usage) 
WHERE cpu_usage > 80 OR memory_usage > 80 OR disk_usage > 80;

-- 1.5. 복합 조건 검색 최적화 (대시보드용)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_server_metrics_dashboard 
ON server_metrics (environment, role, status, last_updated DESC);

-- =============================================
-- 2. 부분 인덱스로 스토리지 효율성 향상
-- =============================================

-- 2.1. 활성 서버만 인덱싱 (90% 쿼리는 활성 서버 대상)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_server_metrics_active_servers 
ON server_metrics (id, last_updated DESC, cpu_usage, memory_usage) 
WHERE status = 'online';

-- 2.2. 프로덕션 환경 최적화 (가장 중요한 데이터)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_server_metrics_production 
ON server_metrics (role, last_updated DESC, cpu_usage, memory_usage, disk_usage) 
WHERE environment = 'production' AND status = 'online';

-- =============================================
-- 3. 쿼리 성능 검증
-- =============================================

-- 3.1. 최신 데이터 조회 성능 테스트
-- EXPLAIN ANALYZE 
-- SELECT * FROM server_metrics 
-- ORDER BY last_updated DESC 
-- LIMIT 10;

-- 3.2. 서버별 최신 상태 조회 성능 테스트
-- EXPLAIN ANALYZE 
-- SELECT DISTINCT ON (id) * 
-- FROM server_metrics 
-- ORDER BY id, last_updated DESC;

-- 3.3. 고부하 서버 감지 성능 테스트
-- EXPLAIN ANALYZE 
-- SELECT id, hostname, cpu_usage, memory_usage, disk_usage 
-- FROM server_metrics 
-- WHERE (cpu_usage > 80 OR memory_usage > 80 OR disk_usage > 80) 
-- AND status = 'online'
-- ORDER BY last_updated DESC;

-- =============================================
-- 4. 테이블 통계 업데이트
-- =============================================

-- 통계 정보 갱신으로 쿼리 플래너 최적화
ANALYZE server_metrics;

-- =============================================
-- 5. 성능 모니터링 쿼리
-- =============================================

-- 5.1. 인덱스 사용률 확인
-- SELECT 
--   schemaname,
--   tablename,
--   indexname,
--   idx_scan as index_scans,
--   idx_tup_read as tuples_read,
--   idx_tup_fetch as tuples_fetched
-- FROM pg_stat_user_indexes 
-- WHERE tablename = 'server_metrics'
-- ORDER BY idx_scan DESC;

-- 5.2. 테이블 스캔 vs 인덱스 스캔 비율
-- SELECT 
--   relname as table_name,
--   seq_scan as table_scans,
--   seq_tup_read as tuples_from_table_scans,
--   idx_scan as index_scans,
--   idx_tup_fetch as tuples_from_index_scans,
--   ROUND(100.0 * idx_scan / NULLIF(seq_scan + idx_scan, 0), 2) as index_usage_percent
-- FROM pg_stat_user_tables 
-- WHERE relname = 'server_metrics';

-- =============================================
-- 6. 자동 VACUUM 최적화 설정
-- =============================================

-- 시계열 데이터 특성에 맞는 VACUUM 설정
-- ALTER TABLE server_metrics SET (
--   autovacuum_vacuum_scale_factor = 0.1,
--   autovacuum_analyze_scale_factor = 0.05,
--   autovacuum_vacuum_threshold = 100,
--   autovacuum_analyze_threshold = 50
-- );

-- 성능 최적화 완료 확인
SELECT 
  'server_metrics 테이블 최적화 완료' as status,
  COUNT(*) as total_records,
  MAX(last_updated) as latest_update
FROM server_metrics;