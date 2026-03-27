-- 🔐 OpenManager VIBE v5 - RLS 정책 최적화
-- GitHub OAuth 기반 사용자 격리 및 성능 최적화
-- 최종 업데이트: 2025-08-10T16:57:00+09:00

-- =============================================
-- 1. 기존 RLS 정책 검토 및 제거
-- =============================================

-- 기존 정책이 있다면 제거 (정책 재구성)
DROP POLICY IF EXISTS "Authenticated users can manage server metrics" ON server_metrics;
DROP POLICY IF EXISTS "Authenticated users can manage metric vectors" ON server_metric_vectors;

-- =============================================
-- 2. GitHub OAuth 기반 사용자 테이블 생성
-- =============================================

-- 사용자 프로필 테이블 (GitHub OAuth 정보)
CREATE TABLE IF NOT EXISTS user_profiles (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    auth_user_id UUID NOT NULL UNIQUE, -- auth.users.id 참조
    github_id BIGINT NOT NULL UNIQUE,
    github_username VARCHAR(100) NOT NULL,
    display_name VARCHAR(200),
    avatar_url TEXT,
    github_email VARCHAR(255),
    
    -- 권한 레벨
    role VARCHAR(20) DEFAULT 'viewer' CHECK (role IN ('admin', 'manager', 'developer', 'viewer')),
    
    -- 접근 가능한 환경
    allowed_environments TEXT[] DEFAULT ARRAY['development'], -- ['production', 'staging', 'development']
    
    -- 메타데이터
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
    last_login_at TIMESTAMP WITH TIME ZONE
);

-- user_profiles RLS 설정
ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;

-- 사용자는 본인 프로필만 조회/수정 가능
CREATE POLICY "Users can view own profile" ON user_profiles
FOR SELECT USING (auth.uid() = auth_user_id);

CREATE POLICY "Users can update own profile" ON user_profiles  
FOR UPDATE USING (auth.uid() = auth_user_id);

-- 관리자는 모든 프로필 관리 가능
CREATE POLICY "Admins can manage all profiles" ON user_profiles
FOR ALL USING (
    EXISTS (
        SELECT 1 FROM user_profiles 
        WHERE auth_user_id = auth.uid() 
        AND role = 'admin'
    )
);

-- =============================================
-- 3. 서버 소유권 테이블 생성
-- =============================================

-- 서버별 접근 권한 관리
CREATE TABLE IF NOT EXISTS server_permissions (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    server_id VARCHAR(100) NOT NULL, -- server_metrics.id 참조
    user_profile_id UUID NOT NULL REFERENCES user_profiles(id) ON DELETE CASCADE,
    
    -- 권한 타입
    permission_type VARCHAR(20) DEFAULT 'read' CHECK (permission_type IN ('admin', 'write', 'read')),
    
    -- 메타데이터
    granted_by UUID REFERENCES user_profiles(id), -- 권한을 부여한 사용자
    granted_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
    expires_at TIMESTAMP WITH TIME ZONE, -- NULL이면 무제한
    
    UNIQUE(server_id, user_profile_id)
);

-- server_permissions RLS 설정
ALTER TABLE server_permissions ENABLE ROW LEVEL SECURITY;

-- 권한 관리자와 해당 사용자만 권한 정보 조회 가능
CREATE POLICY "View server permissions" ON server_permissions
FOR SELECT USING (
    -- 본인 권한 조회
    user_profile_id IN (
        SELECT id FROM user_profiles WHERE auth_user_id = auth.uid()
    )
    OR
    -- 관리자는 모든 권한 조회
    EXISTS (
        SELECT 1 FROM user_profiles 
        WHERE auth_user_id = auth.uid() 
        AND role IN ('admin', 'manager')
    )
);

-- =============================================
-- 4. 최적화된 RLS 정책 구현 (server_metrics)
-- =============================================

-- 4.1. 개발자/관리자 전체 접근 정책
CREATE POLICY "Developers and admins full access" ON server_metrics
FOR ALL USING (
    EXISTS (
        SELECT 1 FROM user_profiles 
        WHERE auth_user_id = auth.uid() 
        AND role IN ('admin', 'developer', 'manager')
    )
);

-- 4.2. 환경별 접근 제한 정책 (성능 최적화)
CREATE POLICY "Environment-based access" ON server_metrics
FOR SELECT USING (
    -- 사용자가 해당 환경에 접근 권한이 있는지 확인
    EXISTS (
        SELECT 1 FROM user_profiles up
        WHERE up.auth_user_id = auth.uid()
        AND up.role = 'viewer'
        AND server_metrics.environment = ANY(up.allowed_environments)
    )
);

-- 4.3. 서버별 세분화된 접근 제어 (고급 사용자용)
CREATE POLICY "Server-specific permissions" ON server_metrics
FOR ALL USING (
    EXISTS (
        SELECT 1 FROM server_permissions sp
        JOIN user_profiles up ON sp.user_profile_id = up.id
        WHERE up.auth_user_id = auth.uid()
        AND sp.server_id = server_metrics.id
        AND (sp.expires_at IS NULL OR sp.expires_at > NOW())
        AND sp.permission_type IN ('admin', 'write', 'read')
    )
);

-- =============================================
-- 5. 최적화된 RLS 정책 구현 (server_metric_vectors)
-- =============================================

-- 벡터 데이터도 동일한 접근 제어 적용
CREATE POLICY "Vector data access control" ON server_metric_vectors
FOR ALL USING (
    -- server_metrics와 동일한 접근 권한 적용
    EXISTS (
        SELECT 1 FROM server_metrics sm
        WHERE sm.id = server_metric_vectors.server_id
        -- RLS가 적용된 server_metrics 조회로 권한 확인
    )
    OR
    -- 개발자/관리자는 전체 접근
    EXISTS (
        SELECT 1 FROM user_profiles 
        WHERE auth_user_id = auth.uid() 
        AND role IN ('admin', 'developer', 'manager')
    )
);

-- =============================================
-- 6. 성능 최적화 인덱스 (RLS 지원)
-- =============================================

-- RLS 정책에서 자주 사용되는 컬럼에 인덱스 생성
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_user_profiles_auth_user 
ON user_profiles (auth_user_id, role);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_user_profiles_role_env 
ON user_profiles (role, allowed_environments) 
WHERE role IN ('viewer', 'developer');

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_server_permissions_user_server 
ON server_permissions (user_profile_id, server_id, permission_type, expires_at);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_server_permissions_active 
ON server_permissions (server_id, permission_type) 
WHERE expires_at IS NULL OR expires_at > NOW();

-- =============================================
-- 7. RLS 성능 최적화 설정
-- =============================================

-- 통계 정보 갱신
ANALYZE user_profiles;
ANALYZE server_permissions;
ANALYZE server_metrics;
ANALYZE server_metric_vectors;

-- =============================================
-- 8. 사용자 권한 관리 함수
-- =============================================

-- 8.1. 사용자 권한 확인 함수
CREATE OR REPLACE FUNCTION check_user_server_permission(
    target_server_id varchar(100),
    required_permission varchar(20) DEFAULT 'read'
)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER
AS $$
    SELECT EXISTS (
        -- 관리자/개발자는 모든 권한
        SELECT 1 FROM user_profiles 
        WHERE auth_user_id = auth.uid() 
        AND role IN ('admin', 'developer', 'manager')
        
        UNION ALL
        
        -- 환경별 권한 확인
        SELECT 1 FROM user_profiles up
        JOIN server_metrics sm ON sm.environment = ANY(up.allowed_environments)
        WHERE up.auth_user_id = auth.uid()
        AND sm.id = target_server_id
        AND up.role = 'viewer'
        
        UNION ALL
        
        -- 서버별 세분화 권한 확인
        SELECT 1 FROM server_permissions sp
        JOIN user_profiles up ON sp.user_profile_id = up.id
        WHERE up.auth_user_id = auth.uid()
        AND sp.server_id = target_server_id
        AND sp.permission_type >= required_permission
        AND (sp.expires_at IS NULL OR sp.expires_at > NOW())
    );
$$;

-- 8.2. 서버 권한 부여 함수
CREATE OR REPLACE FUNCTION grant_server_permission(
    target_server_id varchar(100),
    target_github_username varchar(100),
    permission_type varchar(20),
    expires_in_days integer DEFAULT NULL
)
RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER
AS $$
DECLARE
    target_user_id uuid;
    granter_role varchar(20);
    expires_date timestamp with time zone;
BEGIN
    -- 권한 부여자 역할 확인
    SELECT role INTO granter_role
    FROM user_profiles 
    WHERE auth_user_id = auth.uid();
    
    -- 관리자만 권한 부여 가능
    IF granter_role NOT IN ('admin', 'manager') THEN
        RETURN false;
    END IF;
    
    -- 대상 사용자 찾기
    SELECT id INTO target_user_id
    FROM user_profiles 
    WHERE github_username = target_github_username;
    
    IF target_user_id IS NULL THEN
        RETURN false;
    END IF;
    
    -- 만료 날짜 설정
    IF expires_in_days IS NOT NULL THEN
        expires_date := NOW() + (expires_in_days || ' days')::interval;
    END IF;
    
    -- 권한 부여 (UPSERT)
    INSERT INTO server_permissions (
        server_id, user_profile_id, permission_type, 
        granted_by, expires_at
    )
    VALUES (
        target_server_id, target_user_id, permission_type,
        (SELECT id FROM user_profiles WHERE auth_user_id = auth.uid()),
        expires_date
    )
    ON CONFLICT (server_id, user_profile_id) 
    DO UPDATE SET 
        permission_type = EXCLUDED.permission_type,
        granted_by = EXCLUDED.granted_by,
        expires_at = EXCLUDED.expires_at,
        granted_at = NOW();
    
    RETURN true;
END;
$$;

-- =============================================
-- 9. 테스트 사용자 프로필 생성 (개발용)
-- =============================================

-- GitHub OAuth 테스트용 사용자 (실제 인증 후 자동 생성됨)
-- 이 부분은 실제 GitHub OAuth 로그인 시 자동으로 생성되므로 주석 처리
/*
INSERT INTO user_profiles (
    auth_user_id, github_id, github_username, 
    display_name, role, allowed_environments
) VALUES 
(
    gen_random_uuid(), -- 실제로는 auth.users.id
    123456789, 
    'test-developer',
    'Test Developer',
    'developer',
    ARRAY['production', 'staging', 'development']
)
ON CONFLICT (github_username) DO NOTHING;
*/

-- RLS 정책 최적화 완료 확인
SELECT 
    'RLS 정책 최적화 완료' as status,
    COUNT(*) as total_policies
FROM pg_policies 
WHERE schemaname = 'public';