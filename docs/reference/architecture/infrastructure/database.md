# 🐘 데이터베이스 설계

> Supabase 중심 데이터베이스 스키마/운영 원칙 레퍼런스
> Owner: platform-data
> Status: Active
> Doc type: Reference
> Last reviewed: 2026-02-17
> Canonical: docs/reference/architecture/infrastructure/database.md
> Tags: database,supabase,schema,infrastructure
>
> **프로젝트 버전**: v8.0.0 | **Updated**: 2026-02-17

## 🐘 Supabase PostgreSQL 스키마

### 플랫폼 구성
- **PostgreSQL**: 17 (최신)
- **무료 티어**: 500MB (현재 3% 사용)
- **RLS**: Row Level Security 완전 적용
- **실시간**: WebSocket 기반 동기화
- **성능**: 평균 쿼리 50ms

### 핵심 테이블 구조
```sql
-- 서버 정보
CREATE TABLE servers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL,
  type VARCHAR(50) NOT NULL,
  status VARCHAR(20) DEFAULT 'active',
  location VARCHAR(100),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 서버 메트릭 히스토리
CREATE TABLE server_metrics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  server_id UUID REFERENCES servers(id) ON DELETE CASCADE,
  cpu_usage DECIMAL(5,2) NOT NULL,
  memory_usage DECIMAL(5,2) NOT NULL,
  disk_usage DECIMAL(5,2) NOT NULL,
  network_in BIGINT DEFAULT 0,
  network_out BIGINT DEFAULT 0,
  response_time INTEGER DEFAULT 0,
  timestamp TIMESTAMPTZ DEFAULT NOW(),
  
  CONSTRAINT check_cpu_range CHECK (cpu_usage >= 0 AND cpu_usage <= 100),
  CONSTRAINT check_memory_range CHECK (memory_usage >= 0 AND memory_usage <= 100)
);

-- 장애 로그
CREATE TABLE incidents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  server_id UUID REFERENCES servers(id) ON DELETE CASCADE,
  type VARCHAR(50) NOT NULL,
  severity VARCHAR(20) NOT NULL,
  title VARCHAR(255) NOT NULL,
  description TEXT,
  started_at TIMESTAMPTZ DEFAULT NOW(),
  resolved_at TIMESTAMPTZ,
  auto_resolved BOOLEAN DEFAULT FALSE
);
```

### RLS 보안 정책
```sql
-- 사용자별 데이터 접근 제어
CREATE POLICY "Users access own data" ON server_metrics
FOR ALL USING (auth.uid()::text = user_id);

-- 관리자 전체 접근
CREATE POLICY "Admin full access" ON servers
FOR ALL USING (
  EXISTS(
    SELECT 1 FROM user_roles 
    WHERE user_id = auth.uid() AND role = 'admin'
  )
);
```

### 성능 최적화
```sql
-- 시계열 데이터 인덱스
CREATE INDEX idx_metrics_timestamp ON server_metrics (timestamp DESC);
CREATE INDEX idx_metrics_server_time ON server_metrics (server_id, timestamp);

-- 파티셔닝 (월별)
CREATE TABLE server_metrics_2025_01 PARTITION OF server_metrics
FOR VALUES FROM ('2025-01-01') TO ('2025-02-01');
```
