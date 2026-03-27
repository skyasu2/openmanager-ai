-- 🔐 OpenManager VIBE v5 - 보안 강화 마이그레이션
-- 생성일: 2025-08-01 18:59 KST
-- 담당: Database Administrator

-- =============================================================================
-- 1단계: RLS (Row Level Security) 활성화 - 중요 테이블 우선
-- =============================================================================

-- 1.1 사용자 프로필 테이블 (CRITICAL)
ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;

-- 사용자는 자신의 프로필만 접근 가능
CREATE POLICY "Users can view own profile" ON user_profiles
FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can update own profile" ON user_profiles
FOR UPDATE USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- 신규 프로필 생성 시 사용자 ID 자동 설정
CREATE POLICY "Users can create own profile" ON user_profiles
FOR INSERT WITH CHECK (auth.uid() = user_id);

-- 1.2 조직 설정 테이블
ALTER TABLE organization_settings ENABLE ROW LEVEL SECURITY;

-- 조직 멤버만 조직 설정 접근 가능
CREATE POLICY "Organization members can view settings" ON organization_settings
FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM user_profiles 
    WHERE user_id = auth.uid() 
    AND organization_id = organization_settings.organization_id
  )
);

-- 관리자만 조직 설정 수정 가능
CREATE POLICY "Organization admins can modify settings" ON organization_settings
FOR ALL USING (
  EXISTS (
    SELECT 1 FROM user_profiles 
    WHERE user_id = auth.uid() 
    AND organization_id = organization_settings.organization_id
    AND role IN ('admin', 'owner')
  )
);

-- 1.3 커스텀 규칙 테이블
ALTER TABLE custom_rules ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Organization members can view custom rules" ON custom_rules
FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM user_profiles 
    WHERE user_id = auth.uid() 
    AND organization_id = custom_rules.organization_id
  )
);

CREATE POLICY "Organization admins can manage custom rules" ON custom_rules
FOR ALL USING (
  EXISTS (
    SELECT 1 FROM user_profiles 
    WHERE user_id = auth.uid() 
    AND organization_id = custom_rules.organization_id
    AND role IN ('admin', 'owner')
  )
);

-- =============================================================================
-- 2단계: AI/Vector 테이블 RLS 활성화
-- =============================================================================

-- 2.1 AI 임베딩 테이블 (공용 읽기, 인증된 사용자 쓰기)
ALTER TABLE ai_embeddings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Everyone can read AI embeddings" ON ai_embeddings
FOR SELECT TO authenticated USING (true);

CREATE POLICY "Authenticated users can manage AI embeddings" ON ai_embeddings
FOR ALL TO authenticated USING (true);

-- 2.2 문서 임베딩 테이블
ALTER TABLE document_embeddings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Everyone can read document embeddings" ON document_embeddings
FOR SELECT TO authenticated USING (true);

CREATE POLICY "Authenticated users can manage document embeddings" ON document_embeddings
FOR ALL TO authenticated USING (true);

-- 2.3 컨텍스트 임베딩 테이블
ALTER TABLE context_embeddings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Everyone can read context embeddings" ON context_embeddings
FOR SELECT TO authenticated USING (true);

CREATE POLICY "Authenticated users can manage context embeddings" ON context_embeddings
FOR ALL TO authenticated USING (true);

-- 2.4 명령어 벡터 테이블
ALTER TABLE command_vectors ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Everyone can read command vectors" ON command_vectors
FOR SELECT TO authenticated USING (true);

CREATE POLICY "Authenticated users can manage command vectors" ON command_vectors
FOR ALL TO authenticated USING (true);

-- =============================================================================
-- 3단계: 함수 보안 강화 (search_path 고정)
-- =============================================================================

-- 3.1 검색 경로를 안전하게 고정하는 함수 재생성
CREATE OR REPLACE FUNCTION hybrid_search(
    query_embedding vector(384),
    query_text TEXT,
    match_count INT DEFAULT 5,
    similarity_threshold FLOAT DEFAULT 0.7
)
RETURNS TABLE (
    id UUID,
    content TEXT,
    similarity FLOAT,
    relevance FLOAT,
    metadata JSONB
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
    RETURN QUERY
    WITH vector_results AS (
        SELECT 
            kb.id,
            kb.content,
            kb.metadata,
            1 - (kb.embedding <=> query_embedding) AS similarity,
            kb.relevance_score
        FROM knowledge_base kb
        WHERE kb.embedding IS NOT NULL
        AND 1 - (kb.embedding <=> query_embedding) > similarity_threshold
        ORDER BY kb.embedding <=> query_embedding
        LIMIT match_count * 2
    ),
    text_results AS (
        SELECT 
            kb.id,
            kb.content,
            kb.metadata,
            0.5 AS similarity,
            kb.relevance_score
        FROM knowledge_base kb
        WHERE to_tsvector('english', kb.content) @@ plainto_tsquery('english', query_text)
        LIMIT match_count
    )
    SELECT DISTINCT ON (id)
        id,
        content,
        MAX(similarity) AS similarity,
        MAX(relevance_score) AS relevance,
        metadata
    FROM (
        SELECT * FROM vector_results
        UNION ALL
        SELECT * FROM text_results
    ) combined
    GROUP BY id, content, metadata
    ORDER BY id, MAX(similarity * relevance_score) DESC
    LIMIT match_count;
END;
$$;

-- 3.2 비슷한 인시던트 검색 함수 보안 강화
CREATE OR REPLACE FUNCTION search_similar_incidents(
    query_embedding vector(384),
    match_count INT DEFAULT 5,
    similarity_threshold FLOAT DEFAULT 0.7
)
RETURNS TABLE (
    id UUID,
    title TEXT,
    description TEXT,
    resolution TEXT,
    similarity FLOAT,
    created_at TIMESTAMP
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
    RETURN QUERY
    SELECT 
        ir.id,
        ir.title,
        ir.description,
        ir.resolution,
        1 - (ir.embedding <=> query_embedding) AS similarity,
        ir.created_at
    FROM incident_reports ir
    WHERE ir.embedding IS NOT NULL
    AND 1 - (ir.embedding <=> query_embedding) > similarity_threshold
    ORDER BY ir.embedding <=> query_embedding
    LIMIT match_count;
END;
$$;

-- =============================================================================
-- 4단계: 성능 최적화 - RLS 정책 개선
-- =============================================================================

-- 4.1 MCP 메트릭 테이블 RLS 정책 성능 개선
DROP POLICY IF EXISTS "Authenticated users can access MCP metrics" ON mcp_server_metrics;

CREATE POLICY "Authenticated users can access MCP metrics" ON mcp_server_metrics
FOR ALL TO authenticated USING ((SELECT auth.uid()) IS NOT NULL);

-- 4.2 MCP 헬스체크 테이블 RLS 정책 성능 개선
DROP POLICY IF EXISTS "Authenticated users can access MCP health checks" ON mcp_health_checks;

CREATE POLICY "Authenticated users can access MCP health checks" ON mcp_health_checks
FOR ALL TO authenticated USING ((SELECT auth.uid()) IS NOT NULL);

-- 4.3 MCP 모니터링 이벤트 테이블 RLS 정책 성능 개선
DROP POLICY IF EXISTS "Authenticated users can access MCP events" ON mcp_monitoring_events;

CREATE POLICY "Authenticated users can access MCP events" ON mcp_monitoring_events
FOR ALL TO authenticated USING ((SELECT auth.uid()) IS NOT NULL);

-- 4.4 MCP 성능 집계 테이블 RLS 정책 성능 개선
DROP POLICY IF EXISTS "Authenticated users can access MCP aggregates" ON mcp_performance_aggregates;

CREATE POLICY "Authenticated users can access MCP aggregates" ON mcp_performance_aggregates
FOR ALL TO authenticated USING ((SELECT auth.uid()) IS NOT NULL);

-- =============================================================================
-- 5단계: 인덱스 최적화 (필요한 인덱스만 유지)
-- =============================================================================

-- 5.1 성능에 중요한 인덱스만 유지하고 나머지 제거
-- user_profiles 테이블 인덱스 (RLS 성능 향상)
CREATE INDEX IF NOT EXISTS idx_user_profiles_user_id ON user_profiles(user_id);
CREATE INDEX IF NOT EXISTS idx_user_profiles_org_id ON user_profiles(organization_id);

-- organization_settings 인덱스
CREATE INDEX IF NOT EXISTS idx_org_settings_org_id ON organization_settings(organization_id);

-- custom_rules 인덱스
CREATE INDEX IF NOT EXISTS idx_custom_rules_org_id ON custom_rules(organization_id);
CREATE INDEX IF NOT EXISTS idx_custom_rules_active ON custom_rules(is_active) WHERE is_active = true;

-- =============================================================================
-- 6단계: 무료 티어 최적화를 위한 자동 정리 강화
-- =============================================================================

-- 6.1 강화된 정리 함수
CREATE OR REPLACE FUNCTION cleanup_old_data_enhanced()
RETURNS void 
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
    -- MCP 데이터 정리 (7일 초과)
    DELETE FROM mcp_server_metrics WHERE created_at < NOW() - INTERVAL '7 days';
    DELETE FROM mcp_health_checks WHERE created_at < NOW() - INTERVAL '7 days';
    DELETE FROM mcp_monitoring_events WHERE created_at < NOW() - INTERVAL '3 days';
    
    -- 성능 집계는 30일 보존
    DELETE FROM mcp_performance_aggregates WHERE created_at < NOW() - INTERVAL '30 days';
    
    -- 임베딩 정리 (사용되지 않는 벡터 제거)
    DELETE FROM ai_embeddings WHERE created_at < NOW() - INTERVAL '90 days';
    DELETE FROM document_embeddings WHERE created_at < NOW() - INTERVAL '90 days';
    DELETE FROM context_embeddings WHERE created_at < NOW() - INTERVAL '90 days';
    
    -- 통계 정보 업데이트
    ANALYZE user_profiles;
    ANALYZE organization_settings;
    ANALYZE custom_rules;
    ANALYZE ai_embeddings;
    ANALYZE document_embeddings;
    ANALYZE context_embeddings;
    ANALYZE command_vectors;
    
    -- 불필요한 인덱스 통계 갱신 (사용되지 않는 인덱스 감지용)
    ANALYZE mcp_server_metrics;
    ANALYZE mcp_health_checks;
    ANALYZE mcp_monitoring_events;
    ANALYZE mcp_performance_aggregates;
END;
$$;

-- 6.2 일일 자동 정리 스케줄 (pg_cron 확장이 있는 경우에만)
-- SELECT cron.schedule('daily-cleanup', '0 2 * * *', 'SELECT cleanup_old_data_enhanced();');

-- =============================================================================
-- 7단계: 모니터링 뷰 생성
-- =============================================================================

-- 7.1 보안 상태 모니터링 뷰
CREATE OR REPLACE VIEW security_status AS
SELECT 
    'RLS Coverage' as metric,
    CONCAT(
        COUNT(CASE WHEN rowsecurity THEN 1 END), '/', COUNT(*), 
        ' (', ROUND(COUNT(CASE WHEN rowsecurity THEN 1 END)::numeric / COUNT(*) * 100, 1), '%)'
    ) as value
FROM pg_tables 
WHERE schemaname = 'public'
UNION ALL
SELECT 
    'Total Tables' as metric,
    COUNT(*)::text as value
FROM pg_tables 
WHERE schemaname = 'public';

-- 7.2 스토리지 사용량 모니터링 뷰
CREATE OR REPLACE VIEW storage_usage AS
SELECT 
    schemaname,
    tablename,
    pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) as size,
    pg_total_relation_size(schemaname||'.'||tablename) as size_bytes
FROM pg_tables 
WHERE schemaname = 'public'
ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC;

-- =============================================================================
-- 8단계: 권한 부여
-- =============================================================================

-- 뷰에 대한 접근 권한
GRANT SELECT ON security_status TO authenticated;
GRANT SELECT ON storage_usage TO authenticated;

-- 정리 함수 실행 권한 (관리자만)
GRANT EXECUTE ON FUNCTION cleanup_old_data_enhanced() TO service_role;

-- 커멘트 추가
COMMENT ON FUNCTION cleanup_old_data_enhanced() IS '무료 티어 최적화를 위한 강화된 데이터 정리 함수 - 2025-08-01';
COMMENT ON VIEW security_status IS 'RLS 보안 상태 모니터링 뷰';
COMMENT ON VIEW storage_usage IS '테이블별 스토리지 사용량 모니터링 뷰';