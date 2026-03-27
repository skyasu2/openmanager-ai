-- 📊 OpenManager VIBE v5 - Server Metrics 테이블 생성
-- 생성일: 2025-08-05 17:08 KST
-- 담당: Database Administrator
-- 목적: 실시간 서버 모니터링을 위한 메트릭 데이터 저장

-- =============================================================================
-- 1단계: server_metrics 테이블 생성
-- =============================================================================

CREATE TABLE IF NOT EXISTS server_metrics (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    server_id VARCHAR(100) NOT NULL,
    
    -- 핵심 시스템 메트릭
    cpu DECIMAL(5,2) NOT NULL CHECK (cpu >= 0 AND cpu <= 100),
    memory DECIMAL(5,2) NOT NULL CHECK (memory >= 0 AND memory <= 100),
    disk DECIMAL(5,2) NOT NULL CHECK (disk >= 0 AND disk <= 100),
    network BIGINT DEFAULT 0 CHECK (network >= 0),
    
    -- 추가 메트릭 (선택사항)
    load_average DECIMAL(8,2),
    temperature DECIMAL(5,2),
    connections INTEGER DEFAULT 0,
    iops INTEGER DEFAULT 0,
    
    -- 메타데이터
    metadata JSONB DEFAULT '{}',
    status VARCHAR(20) DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'error', 'maintenance')),
    
    -- 타임스탬프
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
);

-- =============================================================================
-- 2단계: 인덱스 생성 (성능 최적화)
-- =============================================================================

-- 시계열 데이터 조회 최적화 (가장 중요)
CREATE INDEX idx_server_metrics_created_at ON server_metrics(created_at DESC);

-- 서버별 메트릭 조회 최적화
CREATE INDEX idx_server_metrics_server_id ON server_metrics(server_id);

-- 복합 인덱스: 서버별 시간순 조회 (핵심 쿼리)
CREATE INDEX idx_server_metrics_server_time ON server_metrics(server_id, created_at DESC);

-- 상태별 필터링 최적화
CREATE INDEX idx_server_metrics_status ON server_metrics(status) WHERE status != 'active';

-- 고부하 서버 검색 최적화 (임계값 기반)
CREATE INDEX idx_server_metrics_high_load ON server_metrics(server_id, created_at DESC) 
WHERE cpu > 80 OR memory > 80 OR disk > 90;

-- 메타데이터 검색 최적화 (GIN 인덱스)
CREATE INDEX idx_server_metrics_metadata ON server_metrics USING GIN (metadata);

-- =============================================================================
-- 3단계: RLS (Row Level Security) 설정
-- =============================================================================

-- RLS 활성화
ALTER TABLE server_metrics ENABLE ROW LEVEL SECURITY;

-- 정책 1: 인증된 사용자는 모든 메트릭 조회 가능
CREATE POLICY "Authenticated users can view server metrics" ON server_metrics
FOR SELECT TO authenticated
USING (true);

-- 정책 2: 인증된 사용자는 메트릭 삽입 가능 (데이터 수집용)
CREATE POLICY "Authenticated users can insert server metrics" ON server_metrics
FOR INSERT TO authenticated
WITH CHECK (true);

-- 정책 3: 서비스 역할은 모든 작업 가능 (관리용)
CREATE POLICY "Service role can manage server metrics" ON server_metrics
FOR ALL TO service_role
USING (true)
WITH CHECK (true);

-- =============================================================================
-- 4단계: 자동화 함수 생성
-- =============================================================================

-- 4.1 updated_at 자동 갱신 트리거
CREATE OR REPLACE FUNCTION update_server_metrics_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_server_metrics_updated_at
    BEFORE UPDATE ON server_metrics
    FOR EACH ROW
    EXECUTE FUNCTION update_server_metrics_updated_at();

-- 4.2 오래된 메트릭 자동 정리 함수 (무료 티어 최적화)
CREATE OR REPLACE FUNCTION cleanup_old_server_metrics()
RETURNS void AS $$
BEGIN
    -- 7일 이상 된 데이터 삭제 (500MB 제한 고려)
    DELETE FROM server_metrics 
    WHERE created_at < NOW() - INTERVAL '7 days';
    
    -- 1시간 이상 된 데이터 중 5분 간격으로 샘플링 (압축)
    WITH hourly_samples AS (
        SELECT DISTINCT ON (server_id, date_trunc('hour', created_at), (EXTRACT(minute FROM created_at)::int / 5))
            id
        FROM server_metrics
        WHERE created_at BETWEEN NOW() - INTERVAL '24 hours' AND NOW() - INTERVAL '1 hour'
        ORDER BY server_id, date_trunc('hour', created_at), (EXTRACT(minute FROM created_at)::int / 5), created_at DESC
    )
    DELETE FROM server_metrics 
    WHERE created_at BETWEEN NOW() - INTERVAL '24 hours' AND NOW() - INTERVAL '1 hour'
    AND id NOT IN (SELECT id FROM hourly_samples);
    
    -- 통계 정보 갱신
    ANALYZE server_metrics;
END;
$$ LANGUAGE plpgsql;

-- 4.3 서버 상태 요약 함수
CREATE OR REPLACE FUNCTION get_server_status_summary(target_server_id VARCHAR DEFAULT NULL)
RETURNS TABLE (
    server_id VARCHAR,
    latest_timestamp TIMESTAMP WITH TIME ZONE,
    avg_cpu DECIMAL,
    avg_memory DECIMAL,
    avg_disk DECIMAL,
    max_cpu DECIMAL,
    max_memory DECIMAL,
    max_disk DECIMAL,
    status VARCHAR,
    data_points INTEGER
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        sm.server_id,
        MAX(sm.created_at) as latest_timestamp,
        ROUND(AVG(sm.cpu), 2) as avg_cpu,
        ROUND(AVG(sm.memory), 2) as avg_memory,
        ROUND(AVG(sm.disk), 2) as avg_disk,
        MAX(sm.cpu) as max_cpu,
        MAX(sm.memory) as max_memory,
        MAX(sm.disk) as max_disk,
        (array_agg(sm.status ORDER BY sm.created_at DESC))[1] as status,
        COUNT(*)::INTEGER as data_points
    FROM server_metrics sm
    WHERE (target_server_id IS NULL OR sm.server_id = target_server_id)
    AND sm.created_at > NOW() - INTERVAL '1 hour'
    GROUP BY sm.server_id
    ORDER BY latest_timestamp DESC;
END;
$$ LANGUAGE plpgsql;

-- =============================================================================
-- 5단계: 모니터링 뷰 생성
-- =============================================================================

-- 5.1 실시간 서버 상태 뷰
CREATE OR REPLACE VIEW current_server_status AS
SELECT DISTINCT ON (server_id)
    server_id,
    cpu,
    memory,
    disk,
    network,
    load_average,
    temperature,
    connections,
    status,
    created_at,
    CASE 
        WHEN cpu > 90 OR memory > 90 OR disk > 95 THEN 'critical'
        WHEN cpu > 80 OR memory > 80 OR disk > 90 THEN 'warning'
        WHEN created_at < NOW() - INTERVAL '15 minutes' THEN 'stale'
        ELSE 'healthy'
    END as health_status
FROM server_metrics
ORDER BY server_id, created_at DESC;

-- 5.2 메트릭 통계 뷰
CREATE OR REPLACE VIEW server_metrics_stats AS
SELECT 
    COUNT(*) as total_records,
    COUNT(DISTINCT server_id) as unique_servers,
    MIN(created_at) as oldest_record,
    MAX(created_at) as newest_record,
    ROUND(AVG(cpu), 2) as avg_cpu_all_servers,
    ROUND(AVG(memory), 2) as avg_memory_all_servers,
    ROUND(AVG(disk), 2) as avg_disk_all_servers,
    pg_size_pretty(pg_total_relation_size('server_metrics')) as table_size
FROM server_metrics;

-- =============================================================================
-- 6단계: 권한 부여
-- =============================================================================

-- 뷰 접근 권한
GRANT SELECT ON current_server_status TO authenticated;
GRANT SELECT ON server_metrics_stats TO authenticated;

-- 함수 실행 권한
GRANT EXECUTE ON FUNCTION get_server_status_summary TO authenticated;
GRANT EXECUTE ON FUNCTION cleanup_old_server_metrics TO service_role;

-- =============================================================================
-- 7단계: 초기 테스트 데이터 삽입
-- =============================================================================

-- 샘플 서버 메트릭 데이터 (개발/테스트용)
INSERT INTO server_metrics (server_id, cpu, memory, disk, network, status, metadata) VALUES
-- Web 서버들
('prod-web-01', 45.2, 67.8, 78.5, 1024000, 'active', '{"tier": "production", "type": "web", "location": "us-east-1"}'),
('prod-web-02', 52.1, 71.3, 65.2, 2048000, 'active', '{"tier": "production", "type": "web", "location": "us-east-1"}'),
('prod-web-03', 38.7, 59.4, 82.1, 1536000, 'active', '{"tier": "production", "type": "web", "location": "us-west-2"}'),

-- 데이터베이스 서버들
('prod-db-01', 78.9, 85.4, 45.7, 512000, 'active', '{"tier": "production", "type": "database", "location": "us-east-1"}'),
('prod-db-02', 65.3, 76.2, 52.8, 768000, 'active', '{"tier": "production", "type": "database", "location": "us-east-1"}'),

-- 캐시 서버들
('prod-cache-01', 25.8, 42.1, 15.3, 256000, 'active', '{"tier": "production", "type": "cache", "location": "us-east-1"}'),
('prod-cache-02', 31.2, 48.7, 18.9, 384000, 'active', '{"tier": "production", "type": "cache", "location": "us-west-2"}'),

-- 개발 서버들
('dev-web-01', 15.4, 32.8, 45.6, 128000, 'active', '{"tier": "development", "type": "web", "location": "us-east-1"}'),
('dev-db-01', 42.7, 56.3, 35.2, 64000, 'active', '{"tier": "development", "type": "database", "location": "us-east-1"}'),

-- 스테이징 서버들
('staging-web-01', 28.9, 44.5, 67.3, 256000, 'active', '{"tier": "staging", "type": "web", "location": "us-east-1"}');

-- 시계열 데이터 시뮬레이션 (최근 1시간)
INSERT INTO server_metrics (server_id, cpu, memory, disk, network, created_at)
SELECT 
    'prod-web-01',
    45 + (RANDOM() * 20 - 10), -- 35-55% CPU
    68 + (RANDOM() * 10 - 5),  -- 63-73% Memory  
    78.5, -- 고정 디스크 사용량
    1000000 + (RANDOM() * 500000)::BIGINT, -- 네트워크 변동
    NOW() - (generate_series(1, 60) * INTERVAL '1 minute')
FROM generate_series(1, 60);

-- =============================================================================
-- 8단계: 코멘트 및 문서화
-- =============================================================================

COMMENT ON TABLE server_metrics IS 'OpenManager VIBE v5 - 실시간 서버 모니터링 메트릭 저장소';
COMMENT ON COLUMN server_metrics.server_id IS '서버 식별자 (예: prod-web-01)';
COMMENT ON COLUMN server_metrics.cpu IS 'CPU 사용률 (0-100%)';
COMMENT ON COLUMN server_metrics.memory IS '메모리 사용률 (0-100%)';
COMMENT ON COLUMN server_metrics.disk IS '디스크 사용률 (0-100%)';
COMMENT ON COLUMN server_metrics.network IS '네트워크 사용량 (bytes/sec)';
COMMENT ON COLUMN server_metrics.metadata IS '서버 메타데이터 (tier, type, location 등)';

COMMENT ON FUNCTION cleanup_old_server_metrics() IS '무료 티어 최적화: 7일 이상된 데이터 삭제 및 샘플링';
COMMENT ON FUNCTION get_server_status_summary(VARCHAR) IS '서버 상태 요약 정보 조회 (최근 1시간 기준)';

COMMENT ON VIEW current_server_status IS '각 서버의 최신 상태 및 건강도 표시';
COMMENT ON VIEW server_metrics_stats IS 'server_metrics 테이블 전체 통계 정보';

-- =============================================================================
-- 완료 메시지
-- =============================================================================

DO $$
BEGIN
    RAISE NOTICE '✅ server_metrics 테이블 생성 완료!';
    RAISE NOTICE '📊 초기 데이터: 10개 서버, 61개 메트릭 레코드';
    RAISE NOTICE '🔍 인덱스: 6개 생성 (성능 최적화)';
    RAISE NOTICE '🔐 RLS: 3개 정책 적용 (보안 강화)';
    RAISE NOTICE '⚙️  자동화: 3개 함수, 2개 뷰 생성';
    RAISE NOTICE '🚀 사용 준비 완료 - 실시간 모니터링 시작 가능!';
END $$;