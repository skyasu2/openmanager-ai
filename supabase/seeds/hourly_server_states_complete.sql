-- 🔧 Supabase MCP 토큰 제한 해결을 위한 최소화된 시드 데이터
-- 목적: 46,244 토큰 → 2,000 토큰 이하로 축소
-- 원본: hourly_server_states_complete.sql (29,936 토큰)
-- 최적화: 360개 → 30개 레코드 (92% 감축)

-- 기존 데이터 정리
TRUNCATE TABLE hourly_server_states RESTART IDENTITY CASCADE;

-- 📊 핵심 서버만 유지 (5개 서버 × 6시간 = 30개 레코드)
INSERT INTO hourly_server_states (
  server_id, server_name, hostname, server_type, hour_of_day, status,
  cpu_usage, memory_usage, disk_usage, network_usage,
  location, environment, uptime
) VALUES 
-- 0시: DB 장애
('db-main-01', 'DB Main 01', 'DB-MAIN-01', 'database', 0, 'critical', 95, 88, 92, 150, 'Seoul-DC-01', 'production', 86400),
('lb-main-01', 'Load Balancer 01', 'LB-MAIN-01', 'load-balancer', 0, 'online', 15, 25, 22, 28, 'Seoul-DC-01', 'production', 345600),
('web-prd-01', 'Web Server 01', 'WEB-PRD-01', 'web', 0, 'online', 18, 28, 35, 25, 'Seoul-DC-01', 'production', 432000),
('api-prd-01', 'API Server 01', 'API-PRD-01', 'api', 0, 'online', 22, 32, 38, 35, 'Seoul-DC-01', 'production', 691200),
('cache-prd-01', 'Cache Server 01', 'CACHE-PRD-01', 'cache', 0, 'online', 12, 45, 18, 15, 'Seoul-DC-01', 'production', 1123200),
-- 4시: 웹서버 장애
('web-prd-01', 'Web Server 01', 'WEB-PRD-01', 'web', 4, 'critical', 85, 92, 45, 120, 'Seoul-DC-01', 'production', 446400),
('db-main-01', 'DB Main 01', 'DB-MAIN-01', 'database', 4, 'online', 35, 45, 65, 45, 'Seoul-DC-01', 'production', 100800),
('lb-main-01', 'Load Balancer 01', 'LB-MAIN-01', 'load-balancer', 4, 'online', 22, 35, 28, 35, 'Seoul-DC-01', 'production', 360000),
('api-prd-01', 'API Server 01', 'API-PRD-01', 'api', 4, 'online', 32, 42, 42, 55, 'Seoul-DC-01', 'production', 705600),
('cache-prd-01', 'Cache Server 01', 'CACHE-PRD-01', 'cache', 4, 'online', 15, 52, 22, 18, 'Seoul-DC-01', 'production', 1137600),
-- 8시: 캐시서버 장애
('cache-prd-01', 'Cache Server 01', 'CACHE-PRD-01', 'cache', 8, 'critical', 95, 88, 25, 200, 'Seoul-DC-01', 'production', 1152000),
('web-prd-01', 'Web Server 01', 'WEB-PRD-01', 'web', 8, 'online', 25, 35, 48, 35, 'Seoul-DC-01', 'production', 460800),
('api-prd-01', 'API Server 01', 'API-PRD-01', 'api', 8, 'online', 32, 42, 45, 42, 'Seoul-DC-01', 'production', 720000),
('db-main-01', 'DB Main 01', 'DB-MAIN-01', 'database', 8, 'online', 42, 52, 68, 55, 'Seoul-DC-01', 'production', 115200),
('lb-main-01', 'Load Balancer 01', 'LB-MAIN-01', 'load-balancer', 8, 'online', 25, 38, 32, 42, 'Seoul-DC-01', 'production', 374400),
-- 12시: 로드밸런서 장애
('lb-main-01', 'Load Balancer 01', 'LB-MAIN-01', 'load-balancer', 12, 'critical', 98, 85, 45, 250, 'Seoul-DC-01', 'production', 388800),
('web-prd-01', 'Web Server 01', 'WEB-PRD-01', 'web', 12, 'online', 32, 45, 52, 45, 'Seoul-DC-01', 'production', 475200),
('api-prd-01', 'API Server 01', 'API-PRD-01', 'api', 12, 'online', 38, 48, 48, 48, 'Seoul-DC-01', 'production', 734400),
('db-main-01', 'DB Main 01', 'DB-MAIN-01', 'database', 12, 'online', 48, 58, 72, 65, 'Seoul-DC-01', 'production', 129600),
('cache-prd-01', 'Cache Server 01', 'CACHE-PRD-01', 'cache', 12, 'online', 35, 62, 28, 45, 'Seoul-DC-01', 'production', 1166400),
-- 16시: API서버 장애
('api-prd-01', 'API Server 01', 'API-PRD-01', 'api', 16, 'critical', 94, 92, 55, 180, 'Seoul-DC-01', 'production', 748800),
('web-prd-01', 'Web Server 01', 'WEB-PRD-01', 'web', 16, 'online', 35, 45, 55, 52, 'Seoul-DC-01', 'production', 489600),
('db-main-01', 'DB Main 01', 'DB-MAIN-01', 'database', 16, 'online', 55, 65, 75, 75, 'Seoul-DC-01', 'production', 144000),
('lb-main-01', 'Load Balancer 01', 'LB-MAIN-01', 'load-balancer', 16, 'online', 35, 45, 48, 55, 'Seoul-DC-01', 'production', 403200),
('cache-prd-01', 'Cache Server 01', 'CACHE-PRD-01', 'cache', 16, 'online', 28, 55, 32, 38, 'Seoul-DC-01', 'production', 1180800),
-- 20시: 정상 상태
('db-main-01', 'DB Main 01', 'DB-MAIN-01', 'database', 20, 'online', 38, 48, 68, 42, 'Seoul-DC-01', 'production', 158400),
('lb-main-01', 'Load Balancer 01', 'LB-MAIN-01', 'load-balancer', 20, 'online', 22, 32, 38, 32, 'Seoul-DC-01', 'production', 417600),
('web-prd-01', 'Web Server 01', 'WEB-PRD-01', 'web', 20, 'online', 25, 35, 42, 28, 'Seoul-DC-01', 'production', 504000),
('api-prd-01', 'API Server 01', 'API-PRD-01', 'api', 20, 'online', 32, 42, 48, 35, 'Seoul-DC-01', 'production', 763200),
('cache-prd-01', 'Cache Server 01', 'CACHE-PRD-01', 'cache', 20, 'online', 18, 38, 25, 22, 'Seoul-DC-01', 'production', 1195200);

SELECT '✅ Supabase MCP 토큰 제한 해결 완료 - 30개 레코드로 최소화' as result;
