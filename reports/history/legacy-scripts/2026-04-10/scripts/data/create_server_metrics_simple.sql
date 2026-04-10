-- 🚀 서버 메트릭 테이블 생성 및 테스트 데이터 삽입
-- Supabase SQL Editor에서 실행하세요

-- 1. 기존 테이블이 있다면 모든 데이터 삭제 (테이블 구조는 유지)
TRUNCATE TABLE server_metrics CASCADE;

-- 2. 테스트 서버 데이터 5개 삽입
INSERT INTO server_metrics (
  id,
  hostname,
  status,
  cpu_usage,
  memory_usage,
  disk_usage,
  network_in,
  network_out,
  uptime,
  environment,
  role,
  last_updated
) VALUES
  -- 정상 서버들
  ('srv-001', 'prod-web-01', 'online', 35.5, 45.2, 62.8, 125.4, 98.7, 864000, 'production', 'web', NOW()),
  ('srv-002', 'prod-api-01', 'online', 42.1, 55.8, 70.5, 215.3, 187.9, 1728000, 'production', 'api', NOW()),
  ('srv-003', 'prod-db-01', 'online', 28.7, 82.3, 85.2, 89.2, 76.5, 2592000, 'production', 'database', NOW()),
  
  -- 경고 서버
  ('srv-004', 'dev-test-01', 'warning', 78.9, 89.5, 45.3, 45.2, 32.1, 432000, 'development', 'test', NOW()),
  
  -- 오프라인 서버
  ('srv-005', 'staging-app-01', 'critical', 0, 0, 0, 0, 0, 0, 'staging', 'application', NOW());

-- 3. 데이터 확인
SELECT 
  id,
  hostname,
  status,
  ROUND(cpu_usage::numeric, 1) as cpu,
  ROUND(memory_usage::numeric, 1) as memory,
  ROUND(disk_usage::numeric, 1) as disk,
  environment,
  role
FROM server_metrics
ORDER BY hostname;

-- 4. 통계 확인
SELECT 
  COUNT(*) as total_servers,
  COUNT(CASE WHEN status = 'online' THEN 1 END) as online_servers,
  COUNT(CASE WHEN status = 'warning' THEN 1 END) as warning_servers,
  COUNT(CASE WHEN status = 'critical' THEN 1 END) as offline_servers
FROM server_metrics;