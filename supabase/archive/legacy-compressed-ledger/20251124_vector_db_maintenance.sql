-- 20251124_vector_db_maintenance.sql
-- 벡터 DB 유지보수 및 모니터링 시스템 구축
-- 포함: 백업 테이블, 복구 함수, 검색 로그, 인덱스 헬스체크

-- =============================================================================
-- 1. 백업 및 복구 시스템
-- =============================================================================

-- 1.1 백업 테이블 생성
CREATE TABLE IF NOT EXISTS command_vectors_backup (
    backup_id UUID DEFAULT gen_random_uuid(),
    original_id UUID,
    content TEXT,
    embedding vector(384),
    metadata JSONB,
    backed_up_at TIMESTAMP DEFAULT NOW()
);

-- 백업 테이블 인덱스 (조회 성능)
CREATE INDEX IF NOT EXISTS idx_command_vectors_backup_original_id 
ON command_vectors_backup(original_id);

CREATE INDEX IF NOT EXISTS idx_command_vectors_backup_date 
ON command_vectors_backup(backed_up_at);

-- 1.2 복구 함수 (특정 시점 이후 백업본으로 복구)
CREATE OR REPLACE FUNCTION restore_from_backup(
    backup_timestamp TIMESTAMP
)
RETURNS TABLE (restored_count INT)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_restored_count INT;
BEGIN
    -- 복구 로직: 백업 테이블에서 데이터 조회 후 원본 테이블에 Upsert
    WITH restored AS (
        INSERT INTO command_vectors (id, content, embedding, metadata)
        SELECT original_id, content, embedding, metadata
        FROM command_vectors_backup
        WHERE backed_up_at >= backup_timestamp
        -- 최신 백업본만 선택 (중복 제거)
        AND (original_id, backed_up_at) IN (
            SELECT original_id, MAX(backed_up_at)
            FROM command_vectors_backup
            WHERE backed_up_at >= backup_timestamp
            GROUP BY original_id
        )
        ON CONFLICT (id) DO UPDATE
            SET embedding = EXCLUDED.embedding,
                content = EXCLUDED.content,
                metadata = EXCLUDED.metadata,
                updated_at = NOW()
        RETURNING 1
    )
    SELECT COUNT(*) INTO v_restored_count FROM restored;
    
    RETURN QUERY SELECT v_restored_count;
END;
$$;

-- =============================================================================
-- 2. 모니터링 및 로깅 시스템
-- =============================================================================

-- 2.1 검색 성능 로그 테이블
CREATE TABLE IF NOT EXISTS vector_search_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    search_type VARCHAR(50), -- 'vector', 'hybrid', 'keyword'
    query_text TEXT,
    execution_time_ms INT,
    results_count INT,
    similarity_threshold FLOAT,
    created_at TIMESTAMP DEFAULT NOW()
);

-- 로그 테이블 자동 정리 (30일 보존)
CREATE OR REPLACE FUNCTION cleanup_vector_search_logs()
RETURNS void
LANGUAGE plpgsql
AS $$
BEGIN
    DELETE FROM vector_search_logs 
    WHERE created_at < NOW() - INTERVAL '30 days';
END;
$$;

-- 2.2 인덱스 건강도 모니터링 뷰
CREATE OR REPLACE VIEW vector_index_health AS
SELECT 
    schemaname,
    tablename,
    indexname,
    idx_scan as scans,
    idx_tup_read as tuples_read,
    idx_tup_fetch as tuples_fetched,
    pg_size_pretty(pg_relation_size(indexrelid)) as index_size,
    pg_relation_size(indexrelid) as index_size_bytes
FROM pg_stat_user_indexes
WHERE indexname LIKE '%vector%' OR indexname LIKE '%hnsw%';

-- =============================================================================
-- 3. 권한 설정
-- =============================================================================

-- 백업 테이블 권한 (관리자 전용)
ALTER TABLE command_vectors_backup ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage backups" ON command_vectors_backup
FOR ALL TO authenticated
USING (auth.jwt() ->> 'role' = 'service_role'); -- 서비스 롤만 접근 가능하도록 제한 (또는 admin)

-- 로그 테이블 권한
ALTER TABLE vector_search_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can insert logs" ON vector_search_logs
FOR INSERT TO authenticated
WITH CHECK (true);

CREATE POLICY "Admins can view logs" ON vector_search_logs
FOR SELECT TO authenticated
USING (true); -- 모니터링 목적이므로 일단 authenticated 허용

-- 뷰 권한
GRANT SELECT ON vector_index_health TO authenticated;

-- 코멘트
COMMENT ON TABLE command_vectors_backup IS '벡터 데이터 안전을 위한 백업 테이블';
COMMENT ON FUNCTION restore_from_backup IS '백업 테이블에서 벡터 데이터를 복구하는 함수';
COMMENT ON TABLE vector_search_logs IS '벡터 검색 성능 및 패턴 분석을 위한 로그';
COMMENT ON VIEW vector_index_health IS '벡터 인덱스 사용량 및 크기 모니터링 뷰';
