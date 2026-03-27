-- 🤖 OpenManager VIBE v5 - pgvector 확장 설정
-- AI 기반 서버 메트릭 유사도 검색 및 이상 탐지
-- 최종 업데이트: 2025-08-10T16:56:00+09:00

-- =============================================
-- 1. pgvector 확장 활성화
-- =============================================

-- pgvector 확장 설치 (Supabase에서 기본 제공)
CREATE EXTENSION IF NOT EXISTS vector;

-- 확장 버전 확인
-- SELECT name, installed_version, comment 
-- FROM pg_extension 
-- WHERE name = 'vector';

-- =============================================
-- 2. AI 분석을 위한 벡터 검색 테이블 생성
-- =============================================

-- 서버 메트릭 패턴 벡터 저장 테이블
CREATE TABLE IF NOT EXISTS server_metric_vectors (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    server_id VARCHAR(100) NOT NULL REFERENCES server_metrics(id),
    metric_timestamp TIMESTAMP WITH TIME ZONE NOT NULL,
    
    -- 메트릭 벡터 (CPU, Memory, Disk, Network In, Network Out)
    -- 5차원 벡터로 서버 상태를 표현
    metric_vector vector(5) NOT NULL,
    
    -- 시계열 패턴 벡터 (24시간 패턴 - 시간별 평균)
    -- 24차원 벡터로 일일 패턴 표현 (0시~23시)
    daily_pattern_vector vector(24),
    
    -- 주간 패턴 벡터 (7일 패턴 - 요일별 평균)  
    -- 7차원 벡터로 주간 패턴 표현 (월~일)
    weekly_pattern_vector vector(7),
    
    -- 메타데이터
    environment VARCHAR(20) NOT NULL,
    server_role VARCHAR(20) NOT NULL,
    anomaly_score DECIMAL(5,4) DEFAULT 0.0,
    pattern_confidence DECIMAL(5,4) DEFAULT 0.0,
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
);

-- =============================================
-- 3. 벡터 검색 최적화 인덱스
-- =============================================

-- 3.1. 메트릭 벡터 유사도 검색 인덱스 (IVFFlat)
-- 실시간 서버 상태 유사도 검색용
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_metric_vectors_similarity 
ON server_metric_vectors 
USING ivfflat (metric_vector vector_cosine_ops) 
WITH (lists = 100);

-- 3.2. 일일 패턴 유사도 검색 인덱스 (HNSW)
-- 패턴 분석 및 예측용 (더 정확한 검색)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_daily_pattern_hnsw 
ON server_metric_vectors 
USING hnsw (daily_pattern_vector vector_cosine_ops) 
WITH (m = 16, ef_construction = 64);

-- 3.3. 주간 패턴 검색 인덱스
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_weekly_pattern_similarity 
ON server_metric_vectors 
USING ivfflat (weekly_pattern_vector vector_cosine_ops) 
WITH (lists = 50);

-- 3.4. 시계열 및 메타데이터 복합 인덱스
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_metric_vectors_time_server 
ON server_metric_vectors (server_id, metric_timestamp DESC);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_metric_vectors_env_role 
ON server_metric_vectors (environment, server_role, metric_timestamp DESC);

-- 3.5. 이상 탐지용 인덱스
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_metric_vectors_anomaly 
ON server_metric_vectors (anomaly_score DESC, metric_timestamp DESC) 
WHERE anomaly_score > 0.7;

-- =============================================
-- 4. RLS (Row Level Security) 정책 설정
-- =============================================

-- RLS 활성화
ALTER TABLE server_metric_vectors ENABLE ROW LEVEL SECURITY;

-- 인증된 사용자는 모든 벡터 데이터 접근 가능 (포트폴리오 레벨)
CREATE POLICY "Authenticated users can manage metric vectors" 
ON server_metric_vectors
FOR ALL TO authenticated
USING (true)
WITH CHECK (true);

-- =============================================
-- 5. 벡터 검색 함수 생성
-- =============================================

-- 5.1. 유사한 서버 상태 검색 함수
CREATE OR REPLACE FUNCTION find_similar_server_states(
    target_vector vector(5),
    limit_count integer DEFAULT 10,
    similarity_threshold numeric DEFAULT 0.8
)
RETURNS TABLE (
    server_id varchar(100),
    similarity_score numeric,
    metric_timestamp timestamp with time zone,
    environment varchar(20),
    server_role varchar(20)
)
LANGUAGE sql STABLE
AS $$
    SELECT 
        smv.server_id,
        ROUND((1 - (smv.metric_vector <=> target_vector))::numeric, 4) as similarity_score,
        smv.metric_timestamp,
        smv.environment,
        smv.server_role
    FROM server_metric_vectors smv
    WHERE (1 - (smv.metric_vector <=> target_vector)) >= similarity_threshold
    ORDER BY smv.metric_vector <=> target_vector
    LIMIT limit_count;
$$;

-- 5.2. 이상 서버 탐지 함수 (패턴 기반)
CREATE OR REPLACE FUNCTION detect_anomalous_servers(
    pattern_vector vector(24),
    anomaly_threshold numeric DEFAULT 0.3
)
RETURNS TABLE (
    server_id varchar(100),
    anomaly_score numeric,
    pattern_deviation numeric,
    last_seen timestamp with time zone
)
LANGUAGE sql STABLE
AS $$
    SELECT 
        smv.server_id,
        smv.anomaly_score,
        ROUND((smv.daily_pattern_vector <=> pattern_vector)::numeric, 4) as pattern_deviation,
        smv.metric_timestamp as last_seen
    FROM server_metric_vectors smv
    WHERE smv.daily_pattern_vector IS NOT NULL
    AND (smv.daily_pattern_vector <=> pattern_vector) > anomaly_threshold
    ORDER BY (smv.daily_pattern_vector <=> pattern_vector) DESC
    LIMIT 20;
$$;

-- 5.3. 서버 클러스터 분석 함수
CREATE OR REPLACE FUNCTION analyze_server_clusters(
    target_environment varchar(20) DEFAULT NULL,
    cluster_threshold numeric DEFAULT 0.85
)
RETURNS TABLE (
    cluster_id integer,
    server_id varchar(100),
    server_role varchar(20),
    cluster_centroid vector(5),
    intra_cluster_similarity numeric
)
LANGUAGE sql STABLE
AS $$
    WITH server_similarities AS (
        SELECT 
            s1.server_id as server1,
            s2.server_id as server2,
            (1 - (s1.metric_vector <=> s2.metric_vector)) as similarity,
            s1.server_role,
            s1.environment
        FROM server_metric_vectors s1
        JOIN server_metric_vectors s2 ON s1.id != s2.id
        WHERE (target_environment IS NULL OR s1.environment = target_environment)
        AND s1.metric_timestamp = (
            SELECT MAX(metric_timestamp) 
            FROM server_metric_vectors 
            WHERE server_id = s1.server_id
        )
    )
    SELECT 
        ROW_NUMBER() OVER (ORDER BY server_role) as cluster_id,
        server1 as server_id,
        server_role,
        NULL::vector(5) as cluster_centroid,
        AVG(similarity) as intra_cluster_similarity
    FROM server_similarities
    WHERE similarity >= cluster_threshold
    GROUP BY server1, server_role
    ORDER BY intra_cluster_similarity DESC;
$$;

-- =============================================
-- 6. 벡터 데이터 샘플 생성 (테스트용)
-- =============================================

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

-- =============================================
-- 7. 성능 검증 쿼리
-- =============================================

-- 7.1. 벡터 검색 성능 테스트
-- EXPLAIN ANALYZE
-- SELECT * FROM find_similar_server_states('[0.5,0.6,0.4,0.2,0.3]'::vector(5), 5);

-- 7.2. 인덱스 효율성 확인
-- SELECT 
--     indexname,
--     idx_scan,
--     idx_tup_read,
--     idx_tup_fetch
-- FROM pg_stat_user_indexes 
-- WHERE tablename = 'server_metric_vectors'
-- ORDER BY idx_scan DESC;

-- 설정 완료 확인
SELECT 
    'pgvector 설정 완료' as status,
    COUNT(*) as vector_records,
    COUNT(DISTINCT server_id) as unique_servers
FROM server_metric_vectors;