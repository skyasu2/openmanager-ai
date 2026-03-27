-- =================================================================
-- Supabase PostgreSQL 보안 및 성능 최적화 스크립트
-- 생성일: 2025-08-13
-- 목적: OpenManager VIBE v5 프로젝트 데이터베이스 최적화
-- =================================================================

-- 1. Row Level Security (RLS) 정책 활성화
-- =================================================================

-- servers 테이블 RLS 활성화
ALTER TABLE servers ENABLE ROW LEVEL SECURITY;

-- server_metrics 테이블 RLS 활성화
ALTER TABLE server_metrics ENABLE ROW LEVEL SECURITY;

-- users 테이블 RLS 활성화 
ALTER TABLE users ENABLE ROW LEVEL SECURITY;

-- alerts 테이블 RLS 활성화
ALTER TABLE alerts ENABLE ROW LEVEL SECURITY;

-- system_events 테이블 RLS 활성화
ALTER TABLE system_events ENABLE ROW LEVEL SECURITY;

-- ai_queries 테이블 RLS 활성화
ALTER TABLE ai_queries ENABLE ROW LEVEL SECURITY;

-- performance_logs 테이블 RLS 활성화
ALTER TABLE performance_logs ENABLE ROW LEVEL SECURITY;

-- 2. RLS 정책 생성 (GitHub OAuth 기반)
-- =================================================================

-- servers 테이블 정책
CREATE POLICY "Users can view own servers" ON servers
  FOR SELECT USING (
    auth.uid() IS NOT NULL AND (
      -- Service role은 모든 데이터 접근 가능
      auth.role() = 'service_role' OR
      -- 인증된 사용자는 모든 서버 조회 가능 (포트폴리오 목적)
      auth.role() = 'authenticated'
    )
  );

CREATE POLICY "Users can insert servers" ON servers
  FOR INSERT WITH CHECK (
    auth.uid() IS NOT NULL AND auth.role() = 'authenticated'
  );

CREATE POLICY "Users can update servers" ON servers
  FOR UPDATE USING (
    auth.uid() IS NOT NULL AND (
      auth.role() = 'service_role' OR
      auth.role() = 'authenticated'
    )
  );

-- server_metrics 테이블 정책
CREATE POLICY "Users can view server metrics" ON server_metrics
  FOR SELECT USING (
    auth.uid() IS NOT NULL AND (
      auth.role() = 'service_role' OR
      auth.role() = 'authenticated'
    )
  );

CREATE POLICY "Users can insert metrics" ON server_metrics
  FOR INSERT WITH CHECK (
    auth.uid() IS NOT NULL AND auth.role() = 'authenticated'
  );

-- users 테이블 정책 (개인 정보 보호)
CREATE POLICY "Users can view own profile" ON users
  FOR SELECT USING (
    auth.uid() = id OR auth.role() = 'service_role'
  );

CREATE POLICY "Users can update own profile" ON users
  FOR UPDATE USING (
    auth.uid() = id OR auth.role() = 'service_role'
  );

-- alerts 테이블 정책
CREATE POLICY "Users can view alerts" ON alerts
  FOR SELECT USING (
    auth.uid() IS NOT NULL AND (
      auth.role() = 'service_role' OR
      auth.role() = 'authenticated'
    )
  );

-- system_events 테이블 정책
CREATE POLICY "Users can view system events" ON system_events
  FOR SELECT USING (
    auth.uid() IS NOT NULL AND (
      auth.role() = 'service_role' OR
      auth.role() = 'authenticated'
    )
  );

-- ai_queries 테이블 정책
CREATE POLICY "Users can view own AI queries" ON ai_queries
  FOR SELECT USING (
    auth.uid() IS NOT NULL AND (
      auth.role() = 'service_role' OR
      auth.role() = 'authenticated'
    )
  );

CREATE POLICY "Users can insert AI queries" ON ai_queries
  FOR INSERT WITH CHECK (
    auth.uid() IS NOT NULL AND auth.role() = 'authenticated'
  );

-- performance_logs 테이블 정책
CREATE POLICY "Service role can access performance logs" ON performance_logs
  FOR ALL USING (auth.role() = 'service_role');

-- 3. 성능 최적화 인덱스 생성
-- =================================================================

-- servers 테이블 인덱스
CREATE INDEX IF NOT EXISTS idx_servers_status ON servers(status);
CREATE INDEX IF NOT EXISTS idx_servers_environment ON servers(environment);
CREATE INDEX IF NOT EXISTS idx_servers_type ON servers(type);
CREATE INDEX IF NOT EXISTS idx_servers_provider ON servers(provider);
CREATE INDEX IF NOT EXISTS idx_servers_created_at ON servers(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_servers_updated_at ON servers(updated_at DESC);

-- 복합 인덱스 (자주 사용되는 조합)
CREATE INDEX IF NOT EXISTS idx_servers_env_status ON servers(environment, status);
CREATE INDEX IF NOT EXISTS idx_servers_type_status ON servers(type, status);

-- server_metrics 테이블 인덱스 (시계열 데이터 최적화)
CREATE INDEX IF NOT EXISTS idx_server_metrics_hostname ON server_metrics(hostname);
CREATE INDEX IF NOT EXISTS idx_server_metrics_status ON server_metrics(status);
CREATE INDEX IF NOT EXISTS idx_server_metrics_environment ON server_metrics(environment);
CREATE INDEX IF NOT EXISTS idx_server_metrics_last_updated ON server_metrics(last_updated DESC);

-- 복합 인덱스 (성능 쿼리용)
CREATE INDEX IF NOT EXISTS idx_server_metrics_hostname_time ON server_metrics(hostname, last_updated DESC);
CREATE INDEX IF NOT EXISTS idx_server_metrics_env_time ON server_metrics(environment, last_updated DESC);

-- 성능 메트릭 범위 쿼리용 인덱스
CREATE INDEX IF NOT EXISTS idx_server_metrics_cpu_usage ON server_metrics(cpu_usage) WHERE cpu_usage > 80;
CREATE INDEX IF NOT EXISTS idx_server_metrics_memory_usage ON server_metrics(memory_usage) WHERE memory_usage > 80;
CREATE INDEX IF NOT EXISTS idx_server_metrics_disk_usage ON server_metrics(disk_usage) WHERE disk_usage > 90;

-- users 테이블 인덱스
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_github_id ON users(github_id) WHERE github_id IS NOT NULL;

-- alerts 테이블 인덱스
CREATE INDEX IF NOT EXISTS idx_alerts_server_id ON alerts(server_id);
CREATE INDEX IF NOT EXISTS idx_alerts_status ON alerts(status);
CREATE INDEX IF NOT EXISTS idx_alerts_created_at ON alerts(created_at DESC);

-- system_events 테이블 인덱스
CREATE INDEX IF NOT EXISTS idx_system_events_type ON system_events(event_type);
CREATE INDEX IF NOT EXISTS idx_system_events_created_at ON system_events(created_at DESC);

-- ai_queries 테이블 인덱스
CREATE INDEX IF NOT EXISTS idx_ai_queries_user_id ON ai_queries(user_id);
CREATE INDEX IF NOT EXISTS idx_ai_queries_created_at ON ai_queries(created_at DESC);

-- performance_logs 테이블 인덱스 (TTL 구현용)
CREATE INDEX IF NOT EXISTS idx_performance_logs_created_at ON performance_logs(created_at DESC);

-- 4. pgvector 확장 설정 (AI 기능용)
-- =================================================================

-- pgvector 확장 설치 (이미 설치되어 있을 수 있음)
CREATE EXTENSION IF NOT EXISTS vector;

-- AI 벡터 저장용 테이블 개선 (이미 존재한다면 스킵)
CREATE TABLE IF NOT EXISTS ai_embeddings (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  content TEXT NOT NULL,
  embedding vector(1536), -- OpenAI ada-002 기준
  metadata JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- pgvector 인덱스 (벡터 유사도 검색 최적화)
CREATE INDEX IF NOT EXISTS idx_ai_embeddings_embedding_cosine 
ON ai_embeddings USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);

CREATE INDEX IF NOT EXISTS idx_ai_embeddings_embedding_l2 
ON ai_embeddings USING ivfflat (embedding vector_l2_ops) WITH (lists = 100);

-- 5. 실시간(Realtime) 구독 설정
-- =================================================================

-- 실시간 구독 대상 테이블 추가
ALTER PUBLICATION supabase_realtime ADD TABLE servers;
ALTER PUBLICATION supabase_realtime ADD TABLE server_metrics;
ALTER PUBLICATION supabase_realtime ADD TABLE alerts;
ALTER PUBLICATION supabase_realtime ADD TABLE system_events;

-- 6. 데이터 정리 및 TTL 정책 (무료 티어 최적화)
-- =================================================================

-- 오래된 메트릭 데이터 정리 함수
CREATE OR REPLACE FUNCTION cleanup_old_metrics()
RETURNS void AS $$
BEGIN
  -- 30일 이상 된 서버 메트릭 데이터 삭제
  DELETE FROM server_metrics 
  WHERE last_updated < now() - interval '30 days';
  
  -- 90일 이상 된 성능 로그 삭제
  DELETE FROM performance_logs 
  WHERE created_at < now() - interval '90 days';
  
  -- 60일 이상 된 해결된 알림 삭제
  DELETE FROM alerts 
  WHERE created_at < now() - interval '60 days' 
  AND status = 'resolved';
  
  -- 7일 이상 된 시스템 이벤트 중 info 레벨만 삭제
  DELETE FROM system_events 
  WHERE created_at < now() - interval '7 days' 
  AND event_type = 'info';
  
  RAISE NOTICE 'Old data cleanup completed';
END;
$$ LANGUAGE plpgsql;

-- 정리 작업을 위한 스케줄러 (수동 실행용)
-- SELECT cleanup_old_metrics(); -- 필요시 수동 실행

-- 7. 통계 업데이트 및 VACUUM 
-- =================================================================

-- 테이블 통계 업데이트
ANALYZE servers;
ANALYZE server_metrics;
ANALYZE users;
ANALYZE alerts;
ANALYZE system_events;
ANALYZE ai_queries;
ANALYZE performance_logs;

-- 테이블 정리 (공간 회수)
VACUUM (ANALYZE, VERBOSE) servers;
VACUUM (ANALYZE, VERBOSE) server_metrics;

-- 8. 최종 확인 쿼리
-- =================================================================

-- RLS 정책 확인
SELECT schemaname, tablename, rowsecurity, policies.policyname
FROM pg_tables 
LEFT JOIN (
  SELECT schemaname, tablename, policyname 
  FROM pg_policies
) policies USING (schemaname, tablename)
WHERE schemaname = 'public' 
AND tablename IN ('servers', 'server_metrics', 'users', 'alerts', 'system_events', 'ai_queries', 'performance_logs');

-- 인덱스 확인
SELECT 
  tablename,
  indexname,
  indexdef
FROM pg_indexes 
WHERE schemaname = 'public' 
AND tablename IN ('servers', 'server_metrics', 'users', 'alerts')
ORDER BY tablename, indexname;

-- pgvector 확장 확인
SELECT name, default_version, installed_version 
FROM pg_available_extensions 
WHERE name = 'vector';

-- =================================================================
-- 스크립트 실행 완료
-- 다음 단계:
-- 1. 애플리케이션에서 RLS 정책 테스트
-- 2. 쿼리 성능 모니터링
-- 3. 정기적인 cleanup_old_metrics() 실행 설정
-- =================================================================