-- 🔐 OpenManager VIBE v5 - 강화된 보안 정책 2차 마이그레이션
-- 생성일: 2025-08-19 10:00 KST
-- 담당: Database Administrator Agent (보안 강화 프로젝트)
-- 목표: 추가 보안 정책 강화, 감사 로그, 접근 제어 향상

-- =============================================================================
-- 1단계: 시간별 서버 상태 테이블 보안 강화
-- =============================================================================

-- 1.1 hourly_server_states 테이블 추가 보안 정책
-- 기존 RLS가 활성화되어 있지만 더 세밀한 정책 추가

-- 시간대별 접근 제어 (업무시간 외 민감한 데이터 제한)
CREATE POLICY "Restrict sensitive data access outside business hours" ON hourly_server_states
FOR SELECT TO authenticated 
USING (
  CASE 
    WHEN EXTRACT(hour FROM NOW() AT TIME ZONE 'Asia/Seoul') BETWEEN 9 AND 18 THEN true
    WHEN status = 'online' THEN true
    ELSE false
  END
);

-- 1.2 관리자 전용 완전 접근 정책 
CREATE POLICY "Admin full access to hourly server states" ON hourly_server_states
FOR ALL TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM user_profiles 
    WHERE user_id = auth.uid() 
    AND role IN ('admin', 'owner')
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM user_profiles 
    WHERE user_id = auth.uid() 
    AND role IN ('admin', 'owner')
  )
);

-- =============================================================================
-- 2단계: 감사 로그 시스템 구축
-- =============================================================================

-- 2.1 보안 감사 로그 테이블 생성
CREATE TABLE IF NOT EXISTS security_audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- 사용자 정보
  user_id UUID REFERENCES auth.users(id),
  user_email TEXT,
  user_role TEXT,
  
  -- 접근 정보
  action_type VARCHAR(50) NOT NULL, -- 'login', 'logout', 'data_access', 'data_modify', 'admin_action'
  resource_type VARCHAR(50) NOT NULL, -- 'user_profile', 'server_state', 'organization_settings'
  resource_id TEXT,
  
  -- 요청 정보
  ip_address INET,
  user_agent TEXT,
  request_method VARCHAR(10),
  request_path TEXT,
  
  -- 결과 정보
  success BOOLEAN NOT NULL DEFAULT true,
  error_message TEXT,
  
  -- 메타데이터
  metadata JSONB DEFAULT '{}',
  
  -- 타임스탬프
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2.2 감사 로그 인덱스 (성능 최적화)
CREATE INDEX IF NOT EXISTS idx_security_audit_logs_user_id ON security_audit_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_security_audit_logs_action_type ON security_audit_logs(action_type);
CREATE INDEX IF NOT EXISTS idx_security_audit_logs_created_at ON security_audit_logs(created_at);
CREATE INDEX IF NOT EXISTS idx_security_audit_logs_resource ON security_audit_logs(resource_type, resource_id);
CREATE INDEX IF NOT EXISTS idx_security_audit_logs_ip ON security_audit_logs(ip_address);

-- 2.3 감사 로그 RLS 정책
ALTER TABLE security_audit_logs ENABLE ROW LEVEL SECURITY;

-- 관리자만 모든 감사 로그 접근 가능
CREATE POLICY "Admin only access to audit logs" ON security_audit_logs
FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM user_profiles 
    WHERE user_id = auth.uid() 
    AND role IN ('admin', 'owner')
  )
);

-- 사용자는 자신의 로그만 접근 가능
CREATE POLICY "Users can view own audit logs" ON security_audit_logs
FOR SELECT TO authenticated
USING (user_id = auth.uid());

-- 시스템만 감사 로그 삽입 가능
CREATE POLICY "System can insert audit logs" ON security_audit_logs
FOR INSERT TO service_role
WITH CHECK (true);

-- =============================================================================
-- 3단계: 실시간 보안 위협 탐지 테이블
-- =============================================================================

-- 3.1 보안 위협 탐지 테이블
CREATE TABLE IF NOT EXISTS security_threats (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- 위협 정보
  threat_type VARCHAR(50) NOT NULL, -- 'brute_force', 'anomalous_access', 'suspicious_query', 'rate_limit_exceeded'
  severity VARCHAR(20) NOT NULL CHECK (severity IN ('low', 'medium', 'high', 'critical')),
  
  -- 대상 정보
  target_user_id UUID REFERENCES auth.users(id),
  target_ip INET,
  target_resource TEXT,
  
  -- 탐지 정보
  detection_method VARCHAR(50) NOT NULL, -- 'rule_based', 'ml_model', 'threshold', 'pattern_matching'
  confidence_score FLOAT CHECK (confidence_score >= 0 AND confidence_score <= 1),
  
  -- 상세 정보
  description TEXT NOT NULL,
  evidence JSONB DEFAULT '{}',
  
  -- 대응 정보
  status VARCHAR(20) DEFAULT 'detected' CHECK (status IN ('detected', 'investigating', 'mitigated', 'false_positive')),
  response_action TEXT,
  resolved_at TIMESTAMP WITH TIME ZONE,
  resolved_by UUID REFERENCES auth.users(id),
  
  -- 타임스탬프
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 3.2 보안 위협 인덱스
CREATE INDEX IF NOT EXISTS idx_security_threats_severity ON security_threats(severity);
CREATE INDEX IF NOT EXISTS idx_security_threats_status ON security_threats(status);
CREATE INDEX IF NOT EXISTS idx_security_threats_created_at ON security_threats(created_at);
CREATE INDEX IF NOT EXISTS idx_security_threats_target_user ON security_threats(target_user_id);
CREATE INDEX IF NOT EXISTS idx_security_threats_target_ip ON security_threats(target_ip);

-- 3.3 보안 위협 RLS 정책
ALTER TABLE security_threats ENABLE ROW LEVEL SECURITY;

-- 보안 관리자만 접근 가능
CREATE POLICY "Security admin access to threats" ON security_threats
FOR ALL TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM user_profiles 
    WHERE user_id = auth.uid() 
    AND role IN ('admin', 'security_admin')
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM user_profiles 
    WHERE user_id = auth.uid() 
    AND role IN ('admin', 'security_admin')
  )
);

-- 시스템 자동 탐지 삽입 허용
CREATE POLICY "System can insert threat detections" ON security_threats
FOR INSERT TO service_role
WITH CHECK (true);

-- =============================================================================
-- 4단계: 데이터 접근 패턴 모니터링
-- =============================================================================

-- 4.1 데이터 접근 패턴 추적 테이블
CREATE TABLE IF NOT EXISTS data_access_patterns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- 사용자 정보
  user_id UUID REFERENCES auth.users(id),
  session_id TEXT,
  
  -- 접근 패턴
  table_name TEXT NOT NULL,
  operation_type VARCHAR(20) NOT NULL CHECK (operation_type IN ('SELECT', 'INSERT', 'UPDATE', 'DELETE')),
  
  -- 접근 특성
  record_count INTEGER DEFAULT 0,
  execution_time_ms INTEGER DEFAULT 0,
  
  -- 시간 정보
  access_hour INTEGER CHECK (access_hour >= 0 AND access_hour <= 23),
  access_weekday INTEGER CHECK (access_weekday >= 0 AND access_weekday <= 6), -- 0=Sunday
  
  -- 지리적 정보
  ip_address INET,
  country_code CHAR(2),
  
  -- 메타데이터
  query_hash TEXT, -- 쿼리 식별용 해시
  metadata JSONB DEFAULT '{}',
  
  -- 타임스탬프
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 4.2 접근 패턴 인덱스
CREATE INDEX IF NOT EXISTS idx_data_access_patterns_user_id ON data_access_patterns(user_id);
CREATE INDEX IF NOT EXISTS idx_data_access_patterns_table ON data_access_patterns(table_name);
CREATE INDEX IF NOT EXISTS idx_data_access_patterns_operation ON data_access_patterns(operation_type);
CREATE INDEX IF NOT EXISTS idx_data_access_patterns_time ON data_access_patterns(access_hour, access_weekday);
CREATE INDEX IF NOT EXISTS idx_data_access_patterns_created_at ON data_access_patterns(created_at);

-- 4.3 접근 패턴 RLS 정책
ALTER TABLE data_access_patterns ENABLE ROW LEVEL SECURITY;

-- 관리자만 모든 접근 패턴 확인 가능
CREATE POLICY "Admin access to data patterns" ON data_access_patterns
FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM user_profiles 
    WHERE user_id = auth.uid() 
    AND role IN ('admin', 'security_admin')
  )
);

-- 시스템 자동 기록 허용
CREATE POLICY "System can record access patterns" ON data_access_patterns
FOR INSERT TO service_role
WITH CHECK (true);

-- =============================================================================
-- 5단계: 보안 함수 및 트리거 생성
-- =============================================================================

-- 5.1 감사 로그 자동 기록 함수
CREATE OR REPLACE FUNCTION log_security_event(
  p_user_id UUID,
  p_action_type TEXT,
  p_resource_type TEXT,
  p_resource_id TEXT DEFAULT NULL,
  p_ip_address INET DEFAULT NULL,
  p_success BOOLEAN DEFAULT true,
  p_error_message TEXT DEFAULT NULL,
  p_metadata JSONB DEFAULT '{}'
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  log_id UUID;
  user_email_val TEXT;
  user_role_val TEXT;
BEGIN
  -- 사용자 정보 조회
  SELECT email INTO user_email_val FROM auth.users WHERE id = p_user_id;
  SELECT role INTO user_role_val FROM user_profiles WHERE user_id = p_user_id;
  
  -- 감사 로그 삽입
  INSERT INTO security_audit_logs (
    user_id, user_email, user_role,
    action_type, resource_type, resource_id,
    ip_address, success, error_message, metadata
  ) VALUES (
    p_user_id, user_email_val, user_role_val,
    p_action_type, p_resource_type, p_resource_id,
    p_ip_address, p_success, p_error_message, p_metadata
  ) RETURNING id INTO log_id;
  
  RETURN log_id;
END;
$$;

-- 5.2 위협 탐지 함수
CREATE OR REPLACE FUNCTION detect_security_threat(
  p_threat_type TEXT,
  p_severity TEXT,
  p_target_user_id UUID DEFAULT NULL,
  p_target_ip INET DEFAULT NULL,
  p_description TEXT DEFAULT '',
  p_evidence JSONB DEFAULT '{}'
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  threat_id UUID;
BEGIN
  INSERT INTO security_threats (
    threat_type, severity, target_user_id, target_ip,
    description, evidence, detection_method, confidence_score
  ) VALUES (
    p_threat_type, p_severity, p_target_user_id, p_target_ip,
    p_description, p_evidence, 'rule_based', 0.8
  ) RETURNING id INTO threat_id;
  
  -- 심각한 위협인 경우 즉시 알림 (여기서는 로그만)
  IF p_severity IN ('high', 'critical') THEN
    RAISE NOTICE 'SECURITY ALERT: % threat detected for user %', p_severity, p_target_user_id;
  END IF;
  
  RETURN threat_id;
END;
$$;

-- 5.3 사용자 프로필 변경 감사 트리거
CREATE OR REPLACE FUNCTION audit_user_profile_changes()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF TG_OP = 'UPDATE' THEN
    -- 역할 변경 감지
    IF OLD.role != NEW.role THEN
      PERFORM log_security_event(
        NEW.user_id,
        'role_change',
        'user_profile',
        NEW.id::text,
        NULL,
        true,
        NULL,
        jsonb_build_object(
          'old_role', OLD.role,
          'new_role', NEW.role,
          'changed_at', NOW()
        )
      );
    END IF;
    
    -- 조직 변경 감지
    IF OLD.organization_id != NEW.organization_id THEN
      PERFORM log_security_event(
        NEW.user_id,
        'organization_change',
        'user_profile', 
        NEW.id::text,
        NULL,
        true,
        NULL,
        jsonb_build_object(
          'old_org', OLD.organization_id,
          'new_org', NEW.organization_id,
          'changed_at', NOW()
        )
      );
    END IF;
  END IF;
  
  RETURN COALESCE(NEW, OLD);
END;
$$;

-- 5.4 사용자 프로필 감사 트리거 생성
CREATE TRIGGER audit_user_profile_changes_trigger
  AFTER UPDATE ON user_profiles
  FOR EACH ROW
  EXECUTE FUNCTION audit_user_profile_changes();

-- =============================================================================
-- 6단계: 보안 모니터링 뷰 확장
-- =============================================================================

-- 6.1 실시간 보안 대시보드 뷰
CREATE OR REPLACE VIEW security_dashboard AS
SELECT 
  'Active Threats' as metric,
  COUNT(*)::text as value,
  'danger' as status
FROM security_threats 
WHERE status = 'detected' AND created_at > NOW() - INTERVAL '24 hours'
UNION ALL
SELECT 
  'Failed Logins (24h)' as metric,
  COUNT(*)::text as value,
  CASE WHEN COUNT(*) > 10 THEN 'warning' ELSE 'success' END as status
FROM security_audit_logs 
WHERE action_type = 'login' 
  AND success = false 
  AND created_at > NOW() - INTERVAL '24 hours'
UNION ALL
SELECT 
  'Admin Actions (24h)' as metric,
  COUNT(*)::text as value,
  'info' as status
FROM security_audit_logs 
WHERE user_role IN ('admin', 'owner')
  AND created_at > NOW() - INTERVAL '24 hours'
UNION ALL
SELECT 
  'RLS Coverage' as metric,
  CONCAT(
    COUNT(CASE WHEN rowsecurity THEN 1 END), '/', COUNT(*), 
    ' (', ROUND(COUNT(CASE WHEN rowsecurity THEN 1 END)::numeric / COUNT(*) * 100, 1), '%)'
  ) as value,
  CASE 
    WHEN COUNT(CASE WHEN rowsecurity THEN 1 END)::numeric / COUNT(*) >= 0.9 THEN 'success'
    WHEN COUNT(CASE WHEN rowsecurity THEN 1 END)::numeric / COUNT(*) >= 0.7 THEN 'warning'
    ELSE 'danger'
  END as status
FROM pg_tables 
WHERE schemaname = 'public';

-- 6.2 위협 요약 뷰
CREATE OR REPLACE VIEW threat_summary AS
SELECT 
  threat_type,
  severity,
  COUNT(*) as count,
  MAX(created_at) as last_detected,
  COUNT(CASE WHEN status = 'detected' THEN 1 END) as active_count
FROM security_threats
WHERE created_at > NOW() - INTERVAL '7 days'
GROUP BY threat_type, severity
ORDER BY 
  CASE severity 
    WHEN 'critical' THEN 1 
    WHEN 'high' THEN 2 
    WHEN 'medium' THEN 3 
    ELSE 4 
  END,
  count DESC;

-- 6.3 사용자 활동 요약 뷰
CREATE OR REPLACE VIEW user_activity_summary AS
SELECT 
  up.user_id,
  up.full_name,
  up.role,
  COUNT(sal.id) as total_actions,
  COUNT(CASE WHEN sal.success = false THEN 1 END) as failed_actions,
  MAX(sal.created_at) as last_activity,
  COUNT(DISTINCT sal.ip_address) as unique_ips
FROM user_profiles up
LEFT JOIN security_audit_logs sal ON up.user_id = sal.user_id
WHERE sal.created_at > NOW() - INTERVAL '30 days' OR sal.created_at IS NULL
GROUP BY up.user_id, up.full_name, up.role
ORDER BY last_activity DESC NULLS LAST;

-- =============================================================================
-- 7단계: 권한 및 정리 설정
-- =============================================================================

-- 7.1 새로운 뷰에 대한 접근 권한
GRANT SELECT ON security_dashboard TO authenticated;
GRANT SELECT ON threat_summary TO authenticated;
GRANT SELECT ON user_activity_summary TO authenticated;

-- 7.2 새로운 함수에 대한 실행 권한
GRANT EXECUTE ON FUNCTION log_security_event(UUID, TEXT, TEXT, TEXT, INET, BOOLEAN, TEXT, JSONB) TO service_role;
GRANT EXECUTE ON FUNCTION detect_security_threat(TEXT, TEXT, UUID, INET, TEXT, JSONB) TO service_role;

-- 7.3 정리 함수 확장 (기존 함수 업데이트)
CREATE OR REPLACE FUNCTION cleanup_old_data_enhanced()
RETURNS void 
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  -- 기존 MCP 데이터 정리 (7일 초과)
  DELETE FROM mcp_server_metrics WHERE created_at < NOW() - INTERVAL '7 days';
  DELETE FROM mcp_health_checks WHERE created_at < NOW() - INTERVAL '7 days';
  DELETE FROM mcp_monitoring_events WHERE created_at < NOW() - INTERVAL '3 days';
  
  -- 성능 집계는 30일 보존
  DELETE FROM mcp_performance_aggregates WHERE created_at < NOW() - INTERVAL '30 days';
  
  -- 임베딩 정리 (사용되지 않는 벡터 제거)
  DELETE FROM ai_embeddings WHERE created_at < NOW() - INTERVAL '90 days';
  DELETE FROM document_embeddings WHERE created_at < NOW() - INTERVAL '90 days';
  DELETE FROM context_embeddings WHERE created_at < NOW() - INTERVAL '90 days';
  
  -- 새로운 보안 데이터 정리
  -- 감사 로그는 90일 보존 (법적 요구사항 고려)
  DELETE FROM security_audit_logs WHERE created_at < NOW() - INTERVAL '90 days';
  
  -- 해결된 위협은 30일 후 정리
  DELETE FROM security_threats 
  WHERE status IN ('mitigated', 'false_positive') 
    AND resolved_at < NOW() - INTERVAL '30 days';
  
  -- 접근 패턴 데이터는 14일 보존
  DELETE FROM data_access_patterns WHERE created_at < NOW() - INTERVAL '14 days';
  
  -- 통계 정보 업데이트
  ANALYZE user_profiles;
  ANALYZE organization_settings;
  ANALYZE custom_rules;
  ANALYZE security_audit_logs;
  ANALYZE security_threats;
  ANALYZE data_access_patterns;
  ANALYZE hourly_server_states;
END;
$$;

-- =============================================================================
-- 8단계: 최종 설정 및 주석
-- =============================================================================

-- 8.1 테이블 및 함수 주석 추가
COMMENT ON TABLE security_audit_logs IS '보안 감사 로그 - 모든 중요한 사용자 액션 추적';
COMMENT ON TABLE security_threats IS '실시간 보안 위협 탐지 및 대응 추적';
COMMENT ON TABLE data_access_patterns IS '데이터 접근 패턴 분석용 추적 테이블';

COMMENT ON FUNCTION log_security_event(UUID, TEXT, TEXT, TEXT, INET, BOOLEAN, TEXT, JSONB) IS '보안 이벤트 자동 로깅 함수';
COMMENT ON FUNCTION detect_security_threat(TEXT, TEXT, UUID, INET, TEXT, JSONB) IS '보안 위협 자동 탐지 및 기록 함수';

COMMENT ON VIEW security_dashboard IS '실시간 보안 상태 대시보드 뷰';
COMMENT ON VIEW threat_summary IS '위협 유형별 요약 통계 뷰';
COMMENT ON VIEW user_activity_summary IS '사용자별 활동 요약 뷰';

-- 8.2 마이그레이션 완료 로그
-- INSERT INTO security_audit_logs (
--   user_id, user_email, user_role,
--   action_type, resource_type, resource_id,
--   success, metadata
-- ) VALUES (
--   NULL, 'system@openmanager.dev', 'system',
--   'migration', 'database_schema', '20250819_enhanced_security_hardening',
--   true, jsonb_build_object(
--     'migration_version', '20250819_enhanced_security_hardening',
--     'tables_added', 3,
--     'functions_added', 3,
--     'views_added', 3,
--     'policies_added', 8,
--     'completed_at', NOW()
--   )
-- );

-- 마이그레이션 완료 메시지
SELECT 'OpenManager VIBE v5 - 강화된 보안 정책 마이그레이션 완료 ✅' as status;