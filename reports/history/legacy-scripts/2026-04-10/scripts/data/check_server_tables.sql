-- 🔍 서버 관련 테이블 확인 스크립트
-- Supabase SQL Editor에서 실행하세요

-- 1. server_metrics 테이블 존재 여부 확인
SELECT EXISTS (
  SELECT 1 
  FROM information_schema.tables 
  WHERE table_schema = 'public' 
  AND table_name = 'server_metrics'
) as server_metrics_exists;

-- 2. servers 테이블 존재 여부 확인 (구버전 호환성)
SELECT EXISTS (
  SELECT 1 
  FROM information_schema.tables 
  WHERE table_schema = 'public' 
  AND table_name = 'servers'
) as servers_exists;

-- 3. server_metrics 테이블 구조 확인
SELECT 
  column_name,
  data_type,
  is_nullable,
  column_default
FROM information_schema.columns
WHERE table_schema = 'public' 
AND table_name = 'server_metrics'
ORDER BY ordinal_position;

-- 4. 현재 데이터 개수 확인
SELECT 
  'server_metrics' as table_name,
  COUNT(*) as row_count
FROM server_metrics
UNION ALL
SELECT 
  'servers' as table_name,
  COUNT(*) as row_count
FROM servers
WHERE EXISTS (
  SELECT 1 FROM information_schema.tables 
  WHERE table_schema = 'public' AND table_name = 'servers'
);

-- 5. RLS (Row Level Security) 정책 확인
SELECT 
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd,
  qual,
  with_check
FROM pg_policies
WHERE tablename IN ('server_metrics', 'servers');