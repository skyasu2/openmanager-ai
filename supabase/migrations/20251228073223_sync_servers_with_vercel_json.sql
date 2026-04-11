-- ==========================================
-- Unify Supabase Server Data with Vercel Frontend
-- ==========================================
-- Purpose: Sync Supabase data with fixed-24h-metrics.ts (Single Source of Truth)
-- Date: 2024-12-18
-- Servers: 15 servers matching Vercel frontend naming convention

-- ==========================================
-- 1. Clear existing data
-- ==========================================
TRUNCATE TABLE server_alerts CASCADE;
TRUNCATE TABLE server_metrics CASCADE;
TRUNCATE TABLE hourly_server_states CASCADE;
DELETE FROM servers;

-- ==========================================
-- 2. Insert 15 servers matching Vercel data
-- ==========================================
-- Server types mapping:
--   frontend 'web' → 'web'
--   frontend 'database' → 'database'
--   frontend 'application' → 'app'
--   frontend 'storage' → 'storage'
--   frontend 'cache' → 'cache'
--   frontend 'loadbalancer' → 'load-balancer'

INSERT INTO servers (id, name, hostname, status, type, location, environment, provider, os, ip, role, description, specs, services) VALUES

-- 🌐 Web Servers (3)
('WEB-01', 'Web Server 01', 'WEB-01', 'online', 'web', 'Seoul-AZ1', 'production', 'AWS', 'Ubuntu 22.04', '10.0.1.11', 'frontend', 'Primary web server handling user traffic', '{"cpu_cores": 8, "memory_gb": 32, "disk_gb": 256, "network_speed": "10Gbps"}', '[{"name": "nginx", "status": "running", "port": 80}, {"name": "node", "status": "running", "port": 3000}]'),
('WEB-02', 'Web Server 02', 'WEB-02', 'online', 'web', 'Seoul-AZ2', 'production', 'AWS', 'Ubuntu 22.04', '10.0.2.11', 'frontend', 'Secondary web server for load distribution', '{"cpu_cores": 8, "memory_gb": 32, "disk_gb": 256, "network_speed": "10Gbps"}', '[{"name": "nginx", "status": "running", "port": 80}, {"name": "node", "status": "running", "port": 3000}]'),
('WEB-03', 'Web Server 03', 'WEB-03', 'online', 'web', 'Busan-AZ1', 'production', 'AWS', 'Ubuntu 22.04', '10.0.3.11', 'frontend', 'DR site web server', '{"cpu_cores": 8, "memory_gb": 32, "disk_gb": 256, "network_speed": "10Gbps"}', '[{"name": "nginx", "status": "running", "port": 80}, {"name": "node", "status": "running", "port": 3000}]'),

-- 🗄️ Database Servers (3)
('DB-MAIN-01', 'Database Main', 'DB-MAIN-01', 'online', 'database', 'Seoul-AZ1', 'production', 'AWS', 'Ubuntu 22.04', '10.0.1.21', 'primary', 'Primary PostgreSQL database', '{"cpu_cores": 16, "memory_gb": 128, "disk_gb": 2048, "network_speed": "25Gbps"}', '[{"name": "postgresql", "status": "running", "port": 5432}]'),
('DB-REPLICA-01', 'Database Replica', 'DB-REPLICA-01', 'online', 'database', 'Seoul-AZ2', 'production', 'AWS', 'Ubuntu 22.04', '10.0.2.21', 'replica', 'Read replica for load distribution', '{"cpu_cores": 16, "memory_gb": 128, "disk_gb": 2048, "network_speed": "25Gbps"}', '[{"name": "postgresql", "status": "running", "port": 5432}]'),
('DB-BACKUP-01', 'Database Backup', 'DB-BACKUP-01', 'online', 'database', 'Busan-AZ1', 'production', 'AWS', 'Ubuntu 22.04', '10.0.3.21', 'backup', 'Disaster recovery backup database', '{"cpu_cores": 8, "memory_gb": 64, "disk_gb": 4096, "network_speed": "10Gbps"}', '[{"name": "postgresql", "status": "running", "port": 5432}]'),

-- 📱 Application Servers (3)
('APP-01', 'App Server 01', 'APP-01', 'online', 'app', 'Seoul-AZ1', 'production', 'AWS', 'Ubuntu 22.04', '10.0.1.31', 'backend', 'Primary application server', '{"cpu_cores": 8, "memory_gb": 64, "disk_gb": 512, "network_speed": "10Gbps"}', '[{"name": "java", "status": "running", "port": 8080}, {"name": "python", "status": "running", "port": 8000}]'),
('APP-02', 'App Server 02', 'APP-02', 'online', 'app', 'Seoul-AZ2', 'production', 'AWS', 'Ubuntu 22.04', '10.0.2.31', 'backend', 'Secondary application server', '{"cpu_cores": 8, "memory_gb": 64, "disk_gb": 512, "network_speed": "10Gbps"}', '[{"name": "java", "status": "running", "port": 8080}, {"name": "python", "status": "running", "port": 8000}]'),
('APP-03', 'App Server 03', 'APP-03', 'online', 'app', 'Busan-AZ1', 'production', 'AWS', 'Ubuntu 22.04', '10.0.3.31', 'backend', 'DR site application server', '{"cpu_cores": 8, "memory_gb": 64, "disk_gb": 512, "network_speed": "10Gbps"}', '[{"name": "java", "status": "running", "port": 8080}, {"name": "python", "status": "running", "port": 8000}]'),

-- 💾 Storage Servers (2)
('STORAGE-01', 'Storage Server 01', 'STORAGE-01', 'online', 'storage', 'Seoul-AZ1', 'production', 'AWS', 'Ubuntu 22.04', '10.0.1.41', 'nas', 'Primary NAS storage', '{"cpu_cores": 4, "memory_gb": 32, "disk_gb": 51200, "network_speed": "25Gbps"}', '[{"name": "nfs", "status": "running", "port": 2049}]'),
('STORAGE-02', 'Storage Server 02', 'STORAGE-02', 'online', 'storage', 'Busan-AZ1', 'production', 'AWS', 'Ubuntu 22.04', '10.0.3.41', 'nas', 'DR site storage', '{"cpu_cores": 4, "memory_gb": 32, "disk_gb": 51200, "network_speed": "25Gbps"}', '[{"name": "nfs", "status": "running", "port": 2049}]'),

-- 🔴 Cache Servers (2)
('CACHE-01', 'Cache Server 01', 'CACHE-01', 'online', 'cache', 'Seoul-AZ1', 'production', 'AWS', 'Ubuntu 22.04', '10.0.1.51', 'redis', 'Primary Redis cache cluster', '{"cpu_cores": 4, "memory_gb": 64, "disk_gb": 128, "network_speed": "10Gbps"}', '[{"name": "redis", "status": "running", "port": 6379}]'),
('CACHE-02', 'Cache Server 02', 'CACHE-02', 'online', 'cache', 'Seoul-AZ2', 'production', 'AWS', 'Ubuntu 22.04', '10.0.2.51', 'redis', 'Secondary Redis cache cluster', '{"cpu_cores": 4, "memory_gb": 64, "disk_gb": 128, "network_speed": "10Gbps"}', '[{"name": "redis", "status": "running", "port": 6379}]'),

-- ⚖️ Load Balancer Servers (2)
('LB-01', 'Load Balancer 01', 'LB-01', 'online', 'load-balancer', 'Seoul-AZ1', 'production', 'AWS', 'Ubuntu 22.04', '10.0.1.1', 'ingress', 'Primary HAProxy load balancer', '{"cpu_cores": 4, "memory_gb": 16, "disk_gb": 64, "network_speed": "40Gbps"}', '[{"name": "haproxy", "status": "running", "port": 80}, {"name": "haproxy", "status": "running", "port": 443}]'),
('LB-02', 'Load Balancer 02', 'LB-02', 'online', 'load-balancer', 'Seoul-AZ2', 'production', 'AWS', 'Ubuntu 22.04', '10.0.2.1', 'ingress', 'Secondary HAProxy load balancer', '{"cpu_cores": 4, "memory_gb": 16, "disk_gb": 64, "network_speed": "40Gbps"}', '[{"name": "haproxy", "status": "running", "port": 80}, {"name": "haproxy", "status": "running", "port": 443}]');

-- ==========================================
-- 3. Insert hourly_server_states (24h x 15 servers = 360 records)
-- ==========================================
-- Baseline metrics from fixed-24h-metrics.ts:
-- WEB-01: cpu=30, memory=45, disk=25, network=50
-- WEB-02: cpu=35, memory=50, disk=30, network=55
-- WEB-03: cpu=40, memory=55, disk=35, network=40
-- DB-MAIN-01: cpu=50, memory=70, disk=50, network=45
-- DB-REPLICA-01: cpu=40, memory=65, disk=48, network=40
-- DB-BACKUP-01: cpu=25, memory=50, disk=60, network=30
-- APP-01: cpu=45, memory=60, disk=40, network=50
-- APP-02: cpu=50, memory=70, disk=45, network=55
-- APP-03: cpu=55, memory=75, disk=50, network=60
-- STORAGE-01: cpu=20, memory=40, disk=75, network=35
-- STORAGE-02: cpu=25, memory=45, disk=70, network=40
-- CACHE-01: cpu=35, memory=80, disk=20, network=60
-- CACHE-02: cpu=40, memory=85, disk=25, network=65
-- LB-01: cpu=30, memory=50, disk=15, network=70
-- LB-02: cpu=35, memory=55, disk=20, network=75

-- Generate 24-hour data for all 15 servers with rotating incidents
-- Incident pattern: 24시간 내내 번갈아가며 장애 발생 (30-40% 장애율)

DO $$
DECLARE
  server_rec RECORD;
  h INTEGER;
  cpu_base INTEGER;
  memory_base INTEGER;
  disk_base INTEGER;
  network_base INTEGER;
  status_val VARCHAR(20);
  cpu_val INTEGER;
  memory_val INTEGER;
  disk_val INTEGER;
  network_val INTEGER;
  incident_type_val VARCHAR(200);
  incident_severity_val VARCHAR(20);
  affected_deps TEXT[];
BEGIN
  FOR server_rec IN
    SELECT
      id, name, hostname, type,
      location,
      CASE id
        WHEN 'WEB-01' THEN 30 WHEN 'WEB-02' THEN 35 WHEN 'WEB-03' THEN 40
        WHEN 'DB-MAIN-01' THEN 50 WHEN 'DB-REPLICA-01' THEN 40 WHEN 'DB-BACKUP-01' THEN 25
        WHEN 'APP-01' THEN 45 WHEN 'APP-02' THEN 50 WHEN 'APP-03' THEN 55
        WHEN 'STORAGE-01' THEN 20 WHEN 'STORAGE-02' THEN 25
        WHEN 'CACHE-01' THEN 35 WHEN 'CACHE-02' THEN 40
        WHEN 'LB-01' THEN 30 WHEN 'LB-02' THEN 35
      END as cpu_baseline,
      CASE id
        WHEN 'WEB-01' THEN 45 WHEN 'WEB-02' THEN 50 WHEN 'WEB-03' THEN 55
        WHEN 'DB-MAIN-01' THEN 70 WHEN 'DB-REPLICA-01' THEN 65 WHEN 'DB-BACKUP-01' THEN 50
        WHEN 'APP-01' THEN 60 WHEN 'APP-02' THEN 70 WHEN 'APP-03' THEN 75
        WHEN 'STORAGE-01' THEN 40 WHEN 'STORAGE-02' THEN 45
        WHEN 'CACHE-01' THEN 80 WHEN 'CACHE-02' THEN 85
        WHEN 'LB-01' THEN 50 WHEN 'LB-02' THEN 55
      END as memory_baseline,
      CASE id
        WHEN 'WEB-01' THEN 25 WHEN 'WEB-02' THEN 30 WHEN 'WEB-03' THEN 35
        WHEN 'DB-MAIN-01' THEN 50 WHEN 'DB-REPLICA-01' THEN 48 WHEN 'DB-BACKUP-01' THEN 60
        WHEN 'APP-01' THEN 40 WHEN 'APP-02' THEN 45 WHEN 'APP-03' THEN 50
        WHEN 'STORAGE-01' THEN 75 WHEN 'STORAGE-02' THEN 70
        WHEN 'CACHE-01' THEN 20 WHEN 'CACHE-02' THEN 25
        WHEN 'LB-01' THEN 15 WHEN 'LB-02' THEN 20
      END as disk_baseline,
      CASE id
        WHEN 'WEB-01' THEN 50 WHEN 'WEB-02' THEN 55 WHEN 'WEB-03' THEN 40
        WHEN 'DB-MAIN-01' THEN 45 WHEN 'DB-REPLICA-01' THEN 40 WHEN 'DB-BACKUP-01' THEN 30
        WHEN 'APP-01' THEN 50 WHEN 'APP-02' THEN 55 WHEN 'APP-03' THEN 60
        WHEN 'STORAGE-01' THEN 35 WHEN 'STORAGE-02' THEN 40
        WHEN 'CACHE-01' THEN 60 WHEN 'CACHE-02' THEN 65
        WHEN 'LB-01' THEN 70 WHEN 'LB-02' THEN 75
      END as network_baseline
    FROM servers
  LOOP
    FOR h IN 0..23 LOOP
      -- Default: online with baseline metrics + small variation
      status_val := 'online';
      cpu_val := server_rec.cpu_baseline + floor(random() * 10 - 5)::int;
      memory_val := server_rec.memory_baseline + floor(random() * 10 - 5)::int;
      disk_val := server_rec.disk_baseline + floor(random() * 5 - 2)::int;
      network_val := server_rec.network_baseline + floor(random() * 15 - 7)::int;
      incident_type_val := NULL;
      incident_severity_val := 'low';
      affected_deps := NULL;

      -- Apply incident patterns matching fixed-24h-metrics.ts scenarios
      -- DB-MAIN-01: 00:00-02:00 CPU spike (Dawn backup)
      IF server_rec.id = 'DB-MAIN-01' AND h BETWEEN 0 AND 2 THEN
        status_val := 'critical';
        cpu_val := 92;
        memory_val := 88;
        disk_val := 85;
        incident_type_val := '새벽 백업 작업으로 인한 CPU 과부하';
        incident_severity_val := 'critical';
        affected_deps := ARRAY['DB-REPLICA-01', 'APP-01'];
      END IF;

      -- WEB-02: 08:00-10:00 Traffic spike (Morning rush)
      IF server_rec.id = 'WEB-02' AND h BETWEEN 8 AND 10 THEN
        status_val := 'warning';
        cpu_val := 78;
        network_val := 145;
        incident_type_val := '오전 트래픽 급증';
        incident_severity_val := 'high';
        affected_deps := ARRAY['LB-01', 'CACHE-01'];
      END IF;

      -- CACHE-01: 12:00-14:00 Memory pressure (Lunch peak)
      IF server_rec.id = 'CACHE-01' AND h BETWEEN 12 AND 14 THEN
        status_val := 'warning';
        memory_val := 92;
        incident_type_val := '점심시간 캐시 메모리 부하';
        incident_severity_val := 'medium';
        affected_deps := ARRAY['WEB-01', 'WEB-02'];
      END IF;

      -- APP-03: 15:00-17:00 Network congestion (Afternoon)
      IF server_rec.id = 'APP-03' AND h BETWEEN 15 AND 17 THEN
        status_val := 'critical';
        network_val := 185;
        cpu_val := 88;
        incident_type_val := '오후 네트워크 병목';
        incident_severity_val := 'critical';
        affected_deps := ARRAY['DB-MAIN-01', 'STORAGE-01'];
      END IF;

      -- LB-01: 18:00-20:00 Connection overload (Evening peak)
      IF server_rec.id = 'LB-01' AND h BETWEEN 18 AND 20 THEN
        status_val := 'warning';
        cpu_val := 82;
        network_val := 165;
        incident_type_val := '저녁 피크 타임 커넥션 과부하';
        incident_severity_val := 'high';
        affected_deps := ARRAY['WEB-01', 'WEB-02', 'WEB-03'];
      END IF;

      -- STORAGE-01: 22:00-23:59 Disk I/O (Night batch)
      IF server_rec.id = 'STORAGE-01' AND h BETWEEN 22 AND 23 THEN
        status_val := 'warning';
        disk_val := 92;
        cpu_val := 45;
        incident_type_val := '야간 배치 처리 디스크 I/O';
        incident_severity_val := 'medium';
        affected_deps := ARRAY['DB-BACKUP-01'];
      END IF;

      -- Ensure values are in valid range
      cpu_val := GREATEST(0, LEAST(100, cpu_val));
      memory_val := GREATEST(0, LEAST(100, memory_val));
      disk_val := GREATEST(0, LEAST(100, disk_val));
      network_val := GREATEST(0, LEAST(200, network_val));

      INSERT INTO hourly_server_states (
        server_id, server_name, hostname, server_type, hour_of_day, status,
        cpu_usage, memory_usage, disk_usage, network_usage,
        location, environment, uptime,
        incident_type, incident_severity, affected_dependencies
      ) VALUES (
        server_rec.id, server_rec.name, server_rec.hostname,
        CASE server_rec.type
          WHEN 'app' THEN 'app'
          WHEN 'load-balancer' THEN 'load-balancer'
          ELSE server_rec.type
        END,
        h, status_val,
        cpu_val, memory_val, disk_val, network_val,
        server_rec.location, 'production',
        (h * 3600) + floor(random() * 86400)::int,
        incident_type_val, incident_severity_val, affected_deps
      );
    END LOOP;
  END LOOP;
END $$;

-- ==========================================
-- 4. Insert current server_metrics (latest snapshot)
-- ==========================================
INSERT INTO server_metrics (server_id, timestamp, cpu, memory, disk, network, response_time, connections, uptime, health_score)
SELECT
  id,
  NOW(),
  CASE id
    WHEN 'WEB-01' THEN 30 WHEN 'WEB-02' THEN 35 WHEN 'WEB-03' THEN 40
    WHEN 'DB-MAIN-01' THEN 50 WHEN 'DB-REPLICA-01' THEN 40 WHEN 'DB-BACKUP-01' THEN 25
    WHEN 'APP-01' THEN 45 WHEN 'APP-02' THEN 50 WHEN 'APP-03' THEN 55
    WHEN 'STORAGE-01' THEN 20 WHEN 'STORAGE-02' THEN 25
    WHEN 'CACHE-01' THEN 35 WHEN 'CACHE-02' THEN 40
    WHEN 'LB-01' THEN 30 WHEN 'LB-02' THEN 35
  END + (random() * 10 - 5),
  CASE id
    WHEN 'WEB-01' THEN 45 WHEN 'WEB-02' THEN 50 WHEN 'WEB-03' THEN 55
    WHEN 'DB-MAIN-01' THEN 70 WHEN 'DB-REPLICA-01' THEN 65 WHEN 'DB-BACKUP-01' THEN 50
    WHEN 'APP-01' THEN 60 WHEN 'APP-02' THEN 70 WHEN 'APP-03' THEN 75
    WHEN 'STORAGE-01' THEN 40 WHEN 'STORAGE-02' THEN 45
    WHEN 'CACHE-01' THEN 80 WHEN 'CACHE-02' THEN 85
    WHEN 'LB-01' THEN 50 WHEN 'LB-02' THEN 55
  END + (random() * 10 - 5),
  CASE id
    WHEN 'WEB-01' THEN 25 WHEN 'WEB-02' THEN 30 WHEN 'WEB-03' THEN 35
    WHEN 'DB-MAIN-01' THEN 50 WHEN 'DB-REPLICA-01' THEN 48 WHEN 'DB-BACKUP-01' THEN 60
    WHEN 'APP-01' THEN 40 WHEN 'APP-02' THEN 45 WHEN 'APP-03' THEN 50
    WHEN 'STORAGE-01' THEN 75 WHEN 'STORAGE-02' THEN 70
    WHEN 'CACHE-01' THEN 20 WHEN 'CACHE-02' THEN 25
    WHEN 'LB-01' THEN 15 WHEN 'LB-02' THEN 20
  END + (random() * 5 - 2),
  CASE id
    WHEN 'WEB-01' THEN 50 WHEN 'WEB-02' THEN 55 WHEN 'WEB-03' THEN 40
    WHEN 'DB-MAIN-01' THEN 45 WHEN 'DB-REPLICA-01' THEN 40 WHEN 'DB-BACKUP-01' THEN 30
    WHEN 'APP-01' THEN 50 WHEN 'APP-02' THEN 55 WHEN 'APP-03' THEN 60
    WHEN 'STORAGE-01' THEN 35 WHEN 'STORAGE-02' THEN 40
    WHEN 'CACHE-01' THEN 60 WHEN 'CACHE-02' THEN 65
    WHEN 'LB-01' THEN 70 WHEN 'LB-02' THEN 75
  END + (random() * 15 - 7),
  floor(random() * 50 + 10)::int,  -- response_time: 10-60ms
  floor(random() * 500 + 50)::int, -- connections: 50-550
  floor(random() * 604800)::int,   -- uptime: 0-7 days in seconds
  floor(random() * 20 + 80)::int   -- health_score: 80-100
FROM servers;

-- ==========================================
-- 5. Verification queries
-- ==========================================
-- Run these to verify data consistency:

-- SELECT COUNT(*) as server_count FROM servers;
-- Expected: 15

-- SELECT server_type, COUNT(*) as count FROM servers GROUP BY server_type ORDER BY server_type;
-- Expected: app=3, cache=2, database=3, load-balancer=2, storage=2, web=3

-- SELECT COUNT(*) as hourly_states_count FROM hourly_server_states;
-- Expected: 360 (15 servers x 24 hours)

-- SELECT status, COUNT(*) as count FROM hourly_server_states GROUP BY status;
-- Expected: Mix of online, warning, critical

-- ==========================================
-- Comments
-- ==========================================
COMMENT ON TABLE servers IS 'Server metadata synced with Vercel frontend (fixed-24h-metrics.ts) - 15 servers';
