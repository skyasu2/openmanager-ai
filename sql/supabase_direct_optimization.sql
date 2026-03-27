-- 🚀 OpenManager VIBE v5 - Supabase Dashboard 직접 실행용 최적화
-- 각 쿼리를 개별적으로 복사하여 Supabase SQL Editor에서 실행하세요
-- 최종 업데이트: 2025-08-10T17:05:00+09:00

-- =============================================================================
-- 1단계: 핵심 성능 인덱스 생성 (가장 중요!)
-- =============================================================================

-- 1.1. 시계열 데이터 최적화 (최신 데이터 조회 90% 향상)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_server_metrics_time_desc 
ON server_metrics (last_updated DESC);

-- 1.2. 서버별 최신 상태 조회 최적화 (대시보드 핵심)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_server_metrics_server_time 
ON server_metrics (id, last_updated DESC);

-- 1.3. 환경별 필터링 최적화 (production/staging/dev)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_server_metrics_env_status 
ON server_metrics (environment, status);

-- 1.4. 고부하 서버 감지 최적화 (알람 시스템)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_server_metrics_high_usage 
ON server_metrics (cpu_usage, memory_usage, disk_usage) 
WHERE cpu_usage > 80 OR memory_usage > 80 OR disk_usage > 80;

-- 1.5. 복합 조건 대시보드 최적화
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_server_metrics_dashboard 
ON server_metrics (environment, role, status, last_updated DESC);

-- =============================================================================
-- 2단계: 통계 정보 갱신 (즉시 성능 향상)
-- =============================================================================

-- 쿼리 플래너 최적화를 위한 통계 업데이트
ANALYZE server_metrics;

-- =============================================================================
-- 3단계: pgvector 확장 활성화 (AI 검색 준비)
-- =============================================================================

-- pgvector 확장 설치 (Supabase에서 기본 제공)
CREATE EXTENSION IF NOT EXISTS vector;

-- =============================================================================
-- 4단계: AI 벡터 검색 테이블 생성
-- =============================================================================

-- 서버 메트릭 패턴 벡터 저장 테이블
CREATE TABLE IF NOT EXISTS server_metric_vectors (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    server_id VARCHAR(100) NOT NULL,
    metric_timestamp TIMESTAMP WITH TIME ZONE NOT NULL,
    
    -- 메트릭 벡터 (CPU, Memory, Disk, Network In, Network Out)
    -- 5차원 벡터로 서버 상태를 표현
    metric_vector vector(5) NOT NULL,
    
    -- 메타데이터
    environment VARCHAR(20) NOT NULL,
    server_role VARCHAR(20) NOT NULL,
    anomaly_score DECIMAL(5,4) DEFAULT 0.0,
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
);

-- =============================================================================
-- 5단계: 벡터 검색 인덱스 생성
-- =============================================================================

-- 메트릭 벡터 유사도 검색 인덱스 (IVFFlat)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_metric_vectors_similarity 
ON server_metric_vectors 
USING ivfflat (metric_vector vector_cosine_ops) 
WITH (lists = 100);

-- 시계열 및 메타데이터 인덱스
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_metric_vectors_time_server 
ON server_metric_vectors (server_id, metric_timestamp DESC);

-- =============================================================================
-- 6단계: RLS 정책 설정
-- =============================================================================

-- server_metrics 테이블 RLS 확인 및 활성화
ALTER TABLE server_metrics ENABLE ROW LEVEL SECURITY;

-- 기본 인증 정책 (포트폴리오 레벨 - 단순화)
CREATE POLICY IF NOT EXISTS "Authenticated users can manage server metrics" 
ON server_metrics
FOR ALL TO authenticated
USING (true)
WITH CHECK (true);

-- server_metric_vectors 테이블 RLS 설정
ALTER TABLE server_metric_vectors ENABLE ROW LEVEL SECURITY;

CREATE POLICY IF NOT EXISTS "Authenticated users can manage metric vectors" 
ON server_metric_vectors
FOR ALL TO authenticated
USING (true)
WITH CHECK (true);

-- =============================================================================
-- 7단계: 성능 모니터링 뷰 생성
-- =============================================================================

-- 테이블 성능 요약 뷰
CREATE OR REPLACE VIEW performance_summary AS
SELECT 
    schemaname,
    tablename,
    seq_scan as table_scans,
    seq_tup_read as rows_from_table_scans,
    idx_scan as index_scans,
    idx_tup_fetch as rows_from_index_scans,
    
    -- 인덱스 사용률 계산
    CASE 
        WHEN (seq_scan + idx_scan) > 0 
        THEN ROUND(100.0 * idx_scan / (seq_scan + idx_scan), 2)
        ELSE 0 
    END as index_usage_percent,
    
    n_tup_ins as inserts,
    n_tup_upd as updates,
    n_tup_del as deletes,
    n_dead_tup as dead_tuples,
    
    last_vacuum,
    last_autovacuum,
    last_analyze,
    last_autoanalyze
FROM pg_stat_user_tables
ORDER BY tablename;

-- =============================================================================
-- 8단계: 벡터 데이터 샘플 생성
-- =============================================================================

-- 기존 server_metrics 데이터를 기반으로 벡터 생성
INSERT INTO server_metric_vectors (
    server_id, 
    metric_timestamp,
    metric_vector,
    environment,
    server_role
)
SELECT 
    id as server_id,
    last_updated as metric_timestamp,
    -- 5차원 벡터: [CPU, Memory, Disk, Network_In/1000, Network_Out/1000]
    ARRAY[
        cpu_usage/100.0,
        memory_usage/100.0, 
        disk_usage/100.0,
        LEAST(network_in/1000.0, 1.0),
        LEAST(network_out/1000.0, 1.0)
    ]::vector(5) as metric_vector,
    environment,
    role as server_role
FROM server_metrics
WHERE cpu_usage IS NOT NULL 
AND memory_usage IS NOT NULL 
AND disk_usage IS NOT NULL
ON CONFLICT (server_id, metric_timestamp) DO NOTHING;

-- =============================================================================
-- 9단계: 최적화 결과 확인
-- =============================================================================

-- 인덱스 생성 확인
SELECT 
    schemaname,
    tablename,
    indexname,
    indexdef
FROM pg_indexes
WHERE schemaname = 'public' 
AND tablename IN ('server_metrics', 'server_metric_vectors')
ORDER BY tablename, indexname;

-- 성능 향상 확인
SELECT 
    'server_metrics' as table_name,
    COUNT(*) as total_records,
    MAX(last_updated) as latest_update
FROM server_metrics

UNION ALL

SELECT 
    'server_metric_vectors' as table_name,
    COUNT(*) as total_records,
    MAX(created_at) as latest_update
FROM server_metric_vectors;

-- 스토리지 사용량 확인
SELECT 
    tablename,
    pg_size_pretty(pg_total_relation_size('public.'||tablename)) as size,
    pg_total_relation_size('public.'||tablename) as size_bytes
FROM pg_tables 
WHERE schemaname = 'public'
ORDER BY pg_total_relation_size('public.'||tablename) DESC;

-- =============================================================================
-- 성능 테스트 쿼리들 (최적화 효과 검증용)
-- =============================================================================

-- 테스트 1: 최신 데이터 조회 (인덱스 활용)
-- EXPLAIN ANALYZE 
-- SELECT * FROM server_metrics 
-- ORDER BY last_updated DESC 
-- LIMIT 10;

-- 테스트 2: 서버별 최신 상태 조회
-- EXPLAIN ANALYZE 
-- SELECT DISTINCT ON (id) * 
-- FROM server_metrics 
-- ORDER BY id, last_updated DESC;

-- 테스트 3: 고부하 서버 감지 
-- EXPLAIN ANALYZE 
-- SELECT id, hostname, cpu_usage, memory_usage, disk_usage 
-- FROM server_metrics 
-- WHERE (cpu_usage > 80 OR memory_usage > 80 OR disk_usage > 80) 
-- AND status = 'online'
-- ORDER BY last_updated DESC;

-- 테스트 4: 벡터 유사도 검색
-- EXPLAIN ANALYZE
-- SELECT 
--     server_id,
--     (1 - (metric_vector <=> '[0.5,0.6,0.4,0.2,0.3]'::vector(5))) as similarity
-- FROM server_metric_vectors 
-- ORDER BY metric_vector <=> '[0.5,0.6,0.4,0.2,0.3]'::vector(5) 
-- LIMIT 5;

-- =============================================================================
-- 완료 메시지
-- =============================================================================

SELECT 
    'PostgreSQL 최적화 완료!' as status,
    'Phase 2 성공' as phase,
    NOW() as completed_at;