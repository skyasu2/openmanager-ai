-- ==========================================
-- Simplified Portfolio Server Schema
-- ==========================================
-- 목적: 메타데이터 + 알림만 (메트릭은 Vercel JSON)
-- 크기: ~15KB (매우 경량)

-- ==========================================
-- 1. servers 테이블 (메타데이터만)
-- ==========================================
CREATE TABLE IF NOT EXISTS servers (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  hostname TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('web', 'api', 'database', 'cache', 'storage', 'load-balancer', 'backup', 'monitoring', 'security', 'queue', 'app', 'fallback')),
  
  -- Location & Environment
  location TEXT NOT NULL DEFAULT '서울',
  environment TEXT NOT NULL DEFAULT 'production' CHECK (environment IN ('production', 'staging', 'development', 'test')),
  provider TEXT NOT NULL DEFAULT 'AWS' CHECK (provider IN ('AWS', 'GCP', 'Azure', 'On-Premise', 'Vercel')),
  
  -- System Info
  os TEXT NOT NULL DEFAULT 'Ubuntu 22.04',
  ip TEXT,
  description TEXT,
  
  -- Specs (JSON)
  specs JSONB DEFAULT '{"cpu_cores": 4, "memory_gb": 16, "disk_gb": 512}',
  
  -- Metadata
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ==========================================
-- 2. server_alerts 테이블 (실시간 알림)
-- ==========================================
CREATE TABLE IF NOT EXISTS server_alerts (
  id BIGSERIAL PRIMARY KEY,
  server_id TEXT NOT NULL REFERENCES servers(id) ON DELETE CASCADE,
  
  -- Alert Info
  type TEXT NOT NULL CHECK (type IN ('cpu', 'memory', 'disk', 'network', 'security', 'availability', 'performance', 'custom')),
  severity TEXT NOT NULL CHECK (severity IN ('info', 'warning', 'critical', 'emergency')),
  message TEXT NOT NULL,
  
  -- Status
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'acknowledged', 'resolved', 'ignored')),
  
  -- Timestamps
  triggered_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  resolved_at TIMESTAMPTZ,
  
  -- Metadata
  metadata JSONB DEFAULT '{}'
);

-- ==========================================
-- Indexes
-- ==========================================
CREATE INDEX IF NOT EXISTS idx_servers_type ON servers(type);
CREATE INDEX IF NOT EXISTS idx_server_alerts_server_id ON server_alerts(server_id);
CREATE INDEX IF NOT EXISTS idx_server_alerts_status ON server_alerts(status);

-- ==========================================
-- RLS
-- ==========================================
ALTER TABLE servers ENABLE ROW LEVEL SECURITY;
ALTER TABLE server_alerts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow read access" ON servers FOR SELECT USING (true);
CREATE POLICY "Allow read access" ON server_alerts FOR SELECT USING (true);

-- ==========================================
-- Seed Data (서버 메타데이터만)
-- ==========================================
INSERT INTO servers (id, name, hostname, type, location, environment, provider, os, ip, specs) VALUES
('web-prod-01', 'Web Server 1', 'web-prod-01.example.com', 'web', '서울', 'production', 'AWS', 'Ubuntu 22.04 LTS', '10.0.1.10', '{"cpu_cores": 8, "memory_gb": 32, "disk_gb": 512}'),
('web-prod-02', 'Web Server 2', 'web-prod-02.example.com', 'web', '서울', 'production', 'AWS', 'Ubuntu 22.04 LTS', '10.0.1.11', '{"cpu_cores": 8, "memory_gb": 32, "disk_gb": 512}'),
('web-prod-03', 'Web Server 3', 'web-prod-03.example.com', 'web', '서울', 'production', 'AWS', 'Ubuntu 22.04 LTS', '10.0.1.12', '{"cpu_cores": 8, "memory_gb": 32, "disk_gb": 512}'),
('api-prod-01', 'API Server 1', 'api-prod-01.example.com', 'api', '서울', 'production', 'AWS', 'Ubuntu 22.04 LTS', '10.0.2.10', '{"cpu_cores": 16, "memory_gb": 64, "disk_gb": 1024}'),
('api-prod-02', 'API Server 2', 'api-prod-02.example.com', 'api', '서울', 'production', 'GCP', 'Ubuntu 22.04 LTS', '10.0.2.11', '{"cpu_cores": 16, "memory_gb": 64, "disk_gb": 1024}'),
('db-prod-01', 'Database Primary', 'db-prod-01.example.com', 'database', '서울', 'production', 'AWS', 'Ubuntu 22.04 LTS', '10.0.3.10', '{"cpu_cores": 32, "memory_gb": 256, "disk_gb": 4096}'),
('db-prod-02', 'Database Replica', 'db-prod-02.example.com', 'database', '서울', 'production', 'AWS', 'Ubuntu 22.04 LTS', '10.0.3.11', '{"cpu_cores": 32, "memory_gb": 256, "disk_gb": 4096}'),
('cache-prod-01', 'Redis Cache 1', 'cache-prod-01.example.com', 'cache', '서울', 'production', 'AWS', 'Ubuntu 22.04 LTS', '10.0.4.10', '{"cpu_cores": 8, "memory_gb": 128, "disk_gb": 256}'),
('cache-prod-02', 'Redis Cache 2', 'cache-prod-02.example.com', 'cache', '서울', 'production', 'AWS', 'Ubuntu 22.04 LTS', '10.0.4.11', '{"cpu_cores": 8, "memory_gb": 128, "disk_gb": 256}'),
('storage-prod-01', 'Storage Server', 'storage-prod-01.example.com', 'storage', '서울', 'production', 'AWS', 'Ubuntu 22.04 LTS', '10.0.5.10', '{"cpu_cores": 8, "memory_gb": 64, "disk_gb": 10240}'),
('lb-prod-01', 'Load Balancer', 'lb-prod-01.example.com', 'load-balancer', '서울', 'production', 'AWS', 'Ubuntu 22.04 LTS', '10.0.6.10', '{"cpu_cores": 16, "memory_gb": 32, "disk_gb": 512}'),
('backup-prod-01', 'Backup Server', 'backup-prod-01.example.com', 'backup', '서울', 'production', 'AWS', 'Ubuntu 22.04 LTS', '10.0.7.10', '{"cpu_cores": 4, "memory_gb": 16, "disk_gb": 20480}'),
('monitoring-prod-01', 'Monitoring', 'monitoring-prod-01.example.com', 'monitoring', '서울', 'production', 'AWS', 'Ubuntu 22.04 LTS', '10.0.8.10', '{"cpu_cores": 8, "memory_gb": 32, "disk_gb": 2048}'),
('security-prod-01', 'Security Gateway', 'security-prod-01.example.com', 'security', '서울', 'production', 'AWS', 'Ubuntu 22.04 LTS', '10.0.9.10', '{"cpu_cores": 8, "memory_gb": 32, "disk_gb": 512}'),
('queue-prod-01', 'Message Queue', 'queue-prod-01.example.com', 'queue', '서울', 'production', 'AWS', 'Ubuntu 22.04 LTS', '10.0.10.10', '{"cpu_cores": 8, "memory_gb": 32, "disk_gb": 512}'),
('app-prod-01', 'App Server', 'app-prod-01.example.com', 'app', '서울', 'production', 'Vercel', 'Ubuntu 22.04 LTS', '10.0.11.10', '{"cpu_cores": 4, "memory_gb": 16, "disk_gb": 256}'),
('fallback-prod-01', 'Fallback', 'fallback-prod-01.example.com', 'fallback', '서울', 'production', 'On-Premise', 'Ubuntu 22.04 LTS', '10.0.12.10', '{"cpu_cores": 8, "memory_gb": 32, "disk_gb": 1024}');

-- 알림 샘플
INSERT INTO server_alerts (server_id, type, severity, message, status, metadata) VALUES
('web-prod-03', 'cpu', 'warning', 'CPU 사용률 70% 초과', 'active', '{"threshold": 70, "current_value": 72.4}'),
('api-prod-01', 'cpu', 'warning', 'CPU 임계값 근접', 'active', '{"cascade_impact": ["database", "cache"]}'),
('db-prod-01', 'disk', 'warning', '디스크 65% 초과', 'active', '{"affected_services": ["api-prod-01", "api-prod-02"]}');
