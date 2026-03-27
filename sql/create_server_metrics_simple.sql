-- 📊 OpenManager VIBE v5 - server_metrics 테이블 간단 생성
-- Supabase Dashboard SQL Editor에서 실행

-- 1. 기본 테이블 생성
CREATE TABLE IF NOT EXISTS server_metrics (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    server_id VARCHAR(100) NOT NULL,
    cpu DECIMAL(5,2) NOT NULL CHECK (cpu >= 0 AND cpu <= 100),
    memory DECIMAL(5,2) NOT NULL CHECK (memory >= 0 AND memory <= 100),
    disk DECIMAL(5,2) NOT NULL CHECK (disk >= 0 AND disk <= 100),
    network BIGINT DEFAULT 0 CHECK (network >= 0),
    status VARCHAR(20) DEFAULT 'active',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
);

-- 2. 기본 인덱스 생성
CREATE INDEX IF NOT EXISTS idx_server_metrics_created_at ON server_metrics(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_server_metrics_server_id ON server_metrics(server_id);

-- 3. RLS 활성화
ALTER TABLE server_metrics ENABLE ROW LEVEL SECURITY;

-- 4. 기본 정책 (인증된 사용자 모든 권한)
CREATE POLICY "Authenticated users can manage server metrics" ON server_metrics
FOR ALL TO authenticated
USING (true)
WITH CHECK (true);

-- 5. 테스트 데이터 삽입
INSERT INTO server_metrics (server_id, cpu, memory, disk, network, status) VALUES
('prod-web-01', 45.2, 67.8, 78.5, 1024000, 'active'),
('prod-web-02', 52.1, 71.3, 65.2, 2048000, 'active'),
('prod-db-01', 78.9, 85.4, 45.7, 512000, 'active'),
('dev-web-01', 25.4, 42.8, 35.2, 256000, 'active'),
('staging-db-01', 55.7, 68.3, 58.9, 384000, 'active');

-- 6. 확인 쿼리
SELECT COUNT(*) as total_records FROM server_metrics;
SELECT server_id, cpu, memory, disk, created_at FROM server_metrics ORDER BY created_at DESC LIMIT 5;