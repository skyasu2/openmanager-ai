-- 💾 OpenManager VIBE v5 - 스토리지 최적화
-- Supabase 무료 티어 500MB 효율적 활용
-- 최종 업데이트: 2025-08-10T16:58:00+09:00

-- =============================================
-- 1. 데이터 보존 정책 설정
-- =============================================

-- 시계열 데이터 파티셔닝 (PostgreSQL 14+ 지원)
-- server_metrics 테이블을 월별로 파티션 (무료 티어 용량 관리)

-- 기존 테이블 백업 (필요시)
-- CREATE TABLE server_metrics_backup AS SELECT * FROM server_metrics;

-- 파티션 테이블로 변환 (월별 파티셔닝)
CREATE TABLE IF NOT EXISTS server_metrics_partitioned (
    id VARCHAR(100) NOT NULL,
    hostname VARCHAR(200) NOT NULL,
    status VARCHAR(20) DEFAULT 'online',
    cpu_usage DECIMAL(5,2) CHECK (cpu_usage >= 0 AND cpu_usage <= 100),
    memory_usage DECIMAL(5,2) CHECK (memory_usage >= 0 AND memory_usage <= 100),
    disk_usage DECIMAL(5,2) CHECK (disk_usage >= 0 AND disk_usage <= 100),
    network_in BIGINT DEFAULT 0 CHECK (network_in >= 0),
    network_out BIGINT DEFAULT 0 CHECK (network_out >= 0),
    uptime BIGINT DEFAULT 0,
    environment VARCHAR(20) NOT NULL DEFAULT 'development',
    role VARCHAR(20) NOT NULL DEFAULT 'web',
    last_updated TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
    
    -- 파티션 키 (월별)
    partition_date DATE GENERATED ALWAYS AS (DATE_TRUNC('month', last_updated)::date) STORED,
    
    PRIMARY KEY (id, partition_date, last_updated)
) PARTITION BY RANGE (partition_date);

-- 현재 월 파티션 생성
CREATE TABLE IF NOT EXISTS server_metrics_2025_08 PARTITION OF server_metrics_partitioned
FOR VALUES FROM ('2025-08-01') TO ('2025-09-01');

-- 다음 월 파티션 미리 생성
CREATE TABLE IF NOT EXISTS server_metrics_2025_09 PARTITION OF server_metrics_partitioned
FOR VALUES FROM ('2025-09-01') TO ('2025-10-01');

-- =============================================
-- 2. 데이터 압축 및 정리
-- =============================================

-- 2.1. 중복 데이터 제거 (같은 서버의 동일한 메트릭 값)
CREATE OR REPLACE FUNCTION remove_duplicate_metrics()
RETURNS void
LANGUAGE plpgsql
AS $$
BEGIN
    -- 10분 내 동일한 메트릭 값 제거 (스토리지 절약)
    DELETE FROM server_metrics s1
    WHERE EXISTS (
        SELECT 1 FROM server_metrics s2
        WHERE s1.id = s2.id
        AND s1.last_updated > s2.last_updated
        AND s1.last_updated - s2.last_updated < INTERVAL '10 minutes'
        AND ABS(s1.cpu_usage - s2.cpu_usage) < 1.0
        AND ABS(s1.memory_usage - s2.memory_usage) < 1.0
        AND ABS(s1.disk_usage - s2.disk_usage) < 1.0
    );
    
    RAISE NOTICE '중복 메트릭 데이터 정리 완료';
END;
$$;

-- 2.2. 오래된 데이터 자동 삭제 (보존 기간 설정)
CREATE OR REPLACE FUNCTION cleanup_old_metrics(
    retention_days integer DEFAULT 30
)
RETURNS void
LANGUAGE plpgsql
AS $$
DECLARE
    deleted_count integer;
BEGIN
    -- 30일 이상 된 데이터 삭제 (무료 티어 용량 관리)
    DELETE FROM server_metrics 
    WHERE last_updated < NOW() - (retention_days || ' days')::interval;
    
    GET DIAGNOSTICS deleted_count = ROW_COUNT;
    
    -- 벡터 데이터도 동기화 삭제
    DELETE FROM server_metric_vectors smv
    WHERE NOT EXISTS (
        SELECT 1 FROM server_metrics sm 
        WHERE sm.id = smv.server_id 
        AND sm.last_updated = smv.metric_timestamp
    );
    
    RAISE NOTICE '오래된 데이터 % 행 삭제 완료', deleted_count;
END;
$$;

-- 2.3. 데이터 집계 테이블 생성 (스토리지 효율성)
CREATE TABLE IF NOT EXISTS server_metrics_hourly_summary (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    server_id VARCHAR(100) NOT NULL,
    hour_timestamp TIMESTAMP WITH TIME ZONE NOT NULL,
    
    -- 집계 메트릭
    avg_cpu_usage DECIMAL(5,2),
    max_cpu_usage DECIMAL(5,2),
    min_cpu_usage DECIMAL(5,2),
    
    avg_memory_usage DECIMAL(5,2),
    max_memory_usage DECIMAL(5,2),
    min_memory_usage DECIMAL(5,2),
    
    avg_disk_usage DECIMAL(5,2),
    max_disk_usage DECIMAL(5,2),
    
    total_network_in BIGINT,
    total_network_out BIGINT,
    
    -- 메타데이터
    sample_count INTEGER, -- 해당 시간 내 샘플 수
    environment VARCHAR(20),
    server_role VARCHAR(20),
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    UNIQUE(server_id, hour_timestamp)
);

-- 시간별 집계 인덱스
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_hourly_summary_time 
ON server_metrics_hourly_summary (hour_timestamp DESC);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_hourly_summary_server 
ON server_metrics_hourly_summary (server_id, hour_timestamp DESC);

-- =============================================
-- 3. 자동 집계 함수
-- =============================================

-- 실시간 데이터를 시간별로 집계하여 스토리지 절약
CREATE OR REPLACE FUNCTION aggregate_hourly_metrics(
    target_hour timestamp with time zone DEFAULT DATE_TRUNC('hour', NOW() - INTERVAL '1 hour')
)
RETURNS void
LANGUAGE plpgsql
AS $$
BEGIN
    -- 시간별 집계 데이터 생성
    INSERT INTO server_metrics_hourly_summary (
        server_id, hour_timestamp,
        avg_cpu_usage, max_cpu_usage, min_cpu_usage,
        avg_memory_usage, max_memory_usage, min_memory_usage,
        avg_disk_usage, max_disk_usage,
        total_network_in, total_network_out,
        sample_count, environment, server_role
    )
    SELECT 
        id as server_id,
        target_hour,
        ROUND(AVG(cpu_usage), 2) as avg_cpu_usage,
        MAX(cpu_usage) as max_cpu_usage,
        MIN(cpu_usage) as min_cpu_usage,
        ROUND(AVG(memory_usage), 2) as avg_memory_usage,
        MAX(memory_usage) as max_memory_usage,
        MIN(memory_usage) as min_memory_usage,
        ROUND(AVG(disk_usage), 2) as avg_disk_usage,
        MAX(disk_usage) as max_disk_usage,
        SUM(network_in) as total_network_in,
        SUM(network_out) as total_network_out,
        COUNT(*) as sample_count,
        MAX(environment) as environment,
        MAX(role) as server_role
    FROM server_metrics
    WHERE last_updated >= target_hour 
    AND last_updated < target_hour + INTERVAL '1 hour'
    GROUP BY id
    ON CONFLICT (server_id, hour_timestamp) 
    DO UPDATE SET
        avg_cpu_usage = EXCLUDED.avg_cpu_usage,
        max_cpu_usage = EXCLUDED.max_cpu_usage,
        min_cpu_usage = EXCLUDED.min_cpu_usage,
        avg_memory_usage = EXCLUDED.avg_memory_usage,
        max_memory_usage = EXCLUDED.max_memory_usage,
        min_memory_usage = EXCLUDED.min_memory_usage,
        avg_disk_usage = EXCLUDED.avg_disk_usage,
        max_disk_usage = EXCLUDED.max_disk_usage,
        total_network_in = EXCLUDED.total_network_in,
        total_network_out = EXCLUDED.total_network_out,
        sample_count = EXCLUDED.sample_count;
    
    RAISE NOTICE '% 시간대 집계 완료', target_hour;
END;
$$;

-- =============================================
-- 4. 스토리지 모니터링 함수
-- =============================================

CREATE OR REPLACE FUNCTION get_storage_usage_report()
RETURNS TABLE (
    table_name text,
    size_mb numeric,
    row_count bigint,
    avg_row_size_bytes numeric,
    storage_percent numeric
)
LANGUAGE sql
AS $$
    WITH table_sizes AS (
        SELECT 
            schemaname||'.'||tablename as table_name,
            pg_total_relation_size(schemaname||'.'||tablename) as size_bytes,
            COALESCE(n_tup_ins + n_tup_upd - n_tup_del, 0) as row_count
        FROM pg_tables pt
        LEFT JOIN pg_stat_user_tables psut ON pt.tablename = psut.relname
        WHERE pt.schemaname = 'public'
    )
    SELECT 
        table_name,
        ROUND(size_bytes / 1024.0 / 1024.0, 2) as size_mb,
        row_count,
        CASE 
            WHEN row_count > 0 THEN ROUND(size_bytes::numeric / row_count, 2)
            ELSE 0 
        END as avg_row_size_bytes,
        ROUND((size_bytes::numeric / (500 * 1024 * 1024)) * 100, 2) as storage_percent
    FROM table_sizes
    ORDER BY size_bytes DESC;
$$;

-- =============================================
-- 5. 자동화 작업 스케줄링 (pg_cron 확장 필요)
-- =============================================

-- Supabase에서는 pg_cron이 제한적이므로 애플리케이션 레벨에서 스케줄링 권장
-- 아래는 참고용 쿼리

-- 매일 자정에 전날 데이터 집계
-- SELECT cron.schedule('aggregate-daily-metrics', '0 0 * * *', 
--     'SELECT aggregate_hourly_metrics(DATE_TRUNC(''hour'', NOW() - INTERVAL ''25 hour''));'
-- );

-- 매주 일요일에 30일 이상 된 데이터 정리
-- SELECT cron.schedule('cleanup-old-data', '0 2 * * 0', 
--     'SELECT cleanup_old_metrics(30); SELECT remove_duplicate_metrics();'
-- );

-- =============================================
-- 6. 압축 및 최적화 실행
-- =============================================

-- VACUUM 실행으로 데드 튜플 정리
VACUUM ANALYZE server_metrics;
VACUUM ANALYZE server_metric_vectors;
VACUUM ANALYZE user_profiles;
VACUUM ANALYZE server_permissions;

-- 통계 정보 갱신
ANALYZE server_metrics;
ANALYZE server_metric_vectors;

-- =============================================
-- 7. 스토리지 사용량 확인
-- =============================================

SELECT 
    '스토리지 최적화 완료' as status,
    ROUND(
        (SELECT SUM(pg_total_relation_size(schemaname||'.'||tablename))::numeric / 1024 / 1024)
        FROM pg_tables WHERE schemaname = 'public'
    , 2) as total_size_mb,
    ROUND(
        (SELECT SUM(pg_total_relation_size(schemaname||'.'||tablename))::numeric / (500 * 1024 * 1024) * 100)
        FROM pg_tables WHERE schemaname = 'public'
    , 2) as storage_usage_percent;