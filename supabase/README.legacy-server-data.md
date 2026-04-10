# Legacy Server Data Migration Notes

> Status: Historical reference
> Scope: legacy server-data bootstrap notes only
> Active workflow: use `docs/development/project-setup.md` for current Supabase CLI flow
>
> This file is intentionally kept outside `supabase/migrations/` so Supabase CLI does not
> treat it as a migration candidate. The active migration ledger is the SQL files under
> `supabase/migrations/`.

# Portfolio Server Data Migrations

**목적**: 포트폴리오 데모용 현실적인 서버 모니터링 데이터 구축

---

## 📊 생성된 구조

### 1. 데이터베이스 스키마

#### `servers` 테이블 - 서버 메타데이터
- **기반**: `src/types/server.ts`의 Server 타입
- **12개 서버 역할 지원**: web, api, database, cache, storage, load-balancer, backup, monitoring, security, queue, app, fallback
- **주요 필드**:
  - `id` (TEXT, PK): 서버 고유 식별자
  - `name`, `hostname`: 서버 이름 및 호스트명
  - `status`: online | offline | warning | critical | maintenance | unknown
  - `type`: 12가지 서버 역할 중 하나
  - `location`, `environment`, `provider`: 위치, 환경, 제공자
  - `specs` (JSONB): CPU 코어, 메모리, 디스크, 네트워크 속도
  - `services` (JSONB): 실행 중인 서비스 목록

#### `server_metrics` 테이블 - 시계열 메트릭
- **기반**: `src/types/server-metrics.ts`의 ServerMetrics 타입
- **1분 간격 업데이트**: `useFixed24hMetrics` 훅 연동
- **주요 필드**:
  - `server_id` (FK → servers.id)
  - `timestamp`: 메트릭 수집 시각
  - `cpu`, `memory`, `disk`, `network`: 0-100% 사용률
  - `response_time`: 응답 시간 (ms)
  - `health_score`: 0-100 건강 점수

#### `server_alerts` 테이블 - 알림 이력
- **기반**: FAILURE_IMPACT_GRAPH 연쇄 장애 추적
- **주요 필드**:
  - `server_id` (FK → servers.id)
  - `type`: cpu | memory | disk | network | security | availability | performance
  - `severity`: info | warning | critical | emergency
  - `status`: active | acknowledged | resolved | ignored
  - `metadata` (JSONB): 연쇄 영향, 복구 정보 등

---

## 🚀 적용 방법

### 1단계: 스키마 생성

```bash
# Supabase Dashboard > SQL Editor로 이동
# 또는 Supabase CLI 사용

supabase db reset  # (선택사항) 기존 데이터 초기화

# 스키마 마이그레이션 실행
cat supabase/migrations/20251017_create_portfolio_server_tables.sql | \
  supabase db execute
```

**또는 Supabase Dashboard에서**:
1. Supabase Dashboard > SQL Editor 이동
2. `20251017_create_portfolio_server_tables.sql` 내용 복사
3. 실행 (Run)

### 2단계: 시드 데이터 생성

```bash
# 시드 데이터 실행
cat supabase/migrations/20251017_seed_portfolio_server_data.sql | \
  supabase db execute
```

**또는 Supabase Dashboard에서**:
1. SQL Editor에서 `20251017_seed_portfolio_server_data.sql` 복사
2. 실행 (Run)

### 3단계: 확인

```sql
-- 서버 개수 확인 (17개 예상)
SELECT COUNT(*) FROM servers;

-- 서버 타입별 분포 확인
SELECT type, COUNT(*) 
FROM servers 
GROUP BY type 
ORDER BY COUNT(*) DESC;

-- 현재 메트릭 확인
SELECT s.name, s.type, m.cpu, m.memory, m.health_score
FROM servers s
JOIN server_metrics m ON s.id = m.server_id
ORDER BY m.health_score DESC;

-- 활성 알림 확인
SELECT s.name, a.type, a.severity, a.message
FROM server_alerts a
JOIN servers s ON a.server_id = s.server_id
WHERE a.status = 'active'
ORDER BY a.severity DESC;
```

---

## 📦 생성된 데이터

### 서버 인스턴스 (17개)

| 서버 타입       | 개수 | 특징                              | 예시 서버            |
| --------------- | ---- | --------------------------------- | -------------------- |
| **Web**         | 3개  | 프론트엔드, 고트래픽              | web-prod-01/02/03    |
| **API**         | 2개  | 백엔드 API, CPU 집약적            | api-prod-01/02       |
| **Database**    | 2개  | PostgreSQL, 메모리/디스크 집약적  | db-prod-01/02        |
| **Cache**       | 2개  | Redis, 초고속 메모리              | cache-prod-01/02     |
| **Storage**     | 1개  | 파일 스토리지, 디스크 집약적      | storage-prod-01      |
| **LB**          | 1개  | 로드 밸런서, 네트워크 집약적      | lb-prod-01           |
| **Backup**      | 1개  | 백업 시스템                       | backup-prod-01       |
| **Monitoring**  | 1개  | Prometheus/Grafana                | monitoring-prod-01   |
| **Security**    | 1개  | 방화벽/인증                       | security-prod-01     |
| **Queue**       | 1개  | RabbitMQ 메시지 큐                | queue-prod-01        |
| **App**         | 1개  | 마이크로서비스                    | app-prod-01          |
| **Fallback**    | 1개  | 백업 시스템 (대기 중)             | fallback-prod-01     |

### 메트릭 특성 (SERVER_TYPE_DEFINITIONS 기반)

```typescript
// src/types/server.ts의 SERVER_TYPE_DEFINITIONS 반영

web: {
  cpuWeight: 0.7,        // CPU 사용률 45-72%
  networkWeight: 1.2,    // 네트워크 78-86% (고트래픽)
  responseTimeBase: 120  // 응답시간 115-180ms
}

api: {
  cpuWeight: 0.8,        // CPU 사용률 58-65% (높음)
  dependencies: ['database', 'cache']  // DB/캐시 의존성
}

database: {
  memoryWeight: 0.9,     // 메모리 72-78%
  diskWeight: 1.0,       // 디스크 62-65%
  stabilityFactor: 0.95  // 높은 안정성
}

cache: {
  memoryWeight: 1.2,     // 메모리 79-82% (매우 높음)
  responseTimeBase: 5    // 응답시간 7-8ms (초고속)
}

storage: {
  diskWeight: 1.2,       // 디스크 72% (매우 높음)
  failureProne: ['disk_full', 'io_bottleneck']
}

load-balancer: {
  networkWeight: 1.3,    // 네트워크 88% (최고)
  responseTimeBase: 10   // 응답시간 12ms
}
```

### 알림 시나리오 (7개)

1. **Web Server 3 - CPU 경고**: 72.4% (임계값 70% 초과)
2. **Web Server 3 - 성능 저하**: 응답시간 180ms (평균 대비 50% 느림)
3. **API Server 1 - CPU 경고**: 65.3% (임계값 근접, cascade_impact: database, cache)
4. **Database Primary - 디스크 경고**: 65.2% (연쇄 영향: api-prod-01/02, backup-prod-01)
5. **Cache Server 1 - 메모리 최적화**: 해결됨 (2GB 메모리 확보, 8% 성능 향상)
6. **Security Server - 보안 이벤트**: 해결됨 (15회 비정상 로그인 시도 차단)
7. **Load Balancer - 트래픽 급증**: 해결됨 (7000 RPS, 오토스케일링으로 2개 인스턴스 추가)

---

## 🔗 프론트엔드 연동

### ImprovedServerCard 컴포넌트 매핑

```typescript
// src/components/dashboard/ImprovedServerCard.tsx
interface ImprovedServerCardProps {
  server: ServerType;  // ✅ servers 테이블 데이터
  // ...
}

// 사용 예시:
const serverData = {
  id: 'web-prod-01',           // ✅ servers.id
  name: 'Web Server 1',        // ✅ servers.name
  status: 'online',            // ✅ servers.status
  type: 'web',                 // ✅ servers.type
  location: '서울',             // ✅ servers.location
  os: 'Ubuntu 22.04 LTS',     // ✅ servers.os
  ip: '10.0.1.10',            // ✅ servers.ip
  cpu: 45.2,                   // ✅ server_metrics.cpu
  memory: 62.5,                // ✅ server_metrics.memory
  disk: 35.8,                  // ✅ server_metrics.disk
  network: 78.3,               // ✅ server_metrics.network
  uptime: 2592000,             // ✅ server_metrics.uptime (초)
  alerts: 2,                   // ✅ COUNT(server_alerts WHERE status='active')
  services: [...],             // ✅ servers.services (JSONB)
  lastUpdate: new Date()       // ✅ server_metrics.timestamp
};
```

### useFixed24hMetrics 훅 연동

```typescript
// src/hooks/useFixed24hMetrics.ts
// 1분마다 server_metrics 테이블에서 최신 메트릭 조회

const query = `
  SELECT 
    s.*,
    m.cpu, m.memory, m.disk, m.network,
    m.response_time, m.connections, m.uptime,
    m.health_score,
    COUNT(a.id) FILTER (WHERE a.status = 'active') as alerts
  FROM servers s
  JOIN server_metrics m ON s.id = m.server_id
  LEFT JOIN server_alerts a ON s.id = a.server_id
  WHERE m.timestamp = (
    SELECT MAX(timestamp) 
    FROM server_metrics 
    WHERE server_id = s.id
  )
  GROUP BY s.id, m.id
  ORDER BY s.name
`;
```

---

## 📈 다음 단계

### 1. 시계열 메트릭 생성기 구축
- [ ] 24시간 분량 메트릭 데이터 생성 (1분 간격)
- [ ] SERVER_TYPE_DEFINITIONS의 normalRanges, scenarios 활용
- [ ] FAILURE_IMPACT_GRAPH 기반 연쇄 장애 시뮬레이션

### 2. AI 어시스턴트 연동
- [ ] 서버 상태 분석 프롬프트 작성
- [ ] 알림 우선순위 자동 분류
- [ ] 장애 예측 및 복구 제안

### 3. 실시간 업데이트
- [ ] Supabase Realtime 구독 설정
- [ ] `useFixed24hMetrics` 훅과 연동
- [ ] 대시보드 자동 갱신 (1분 간격)

### 4. 시각화 개선
- [ ] Recharts 차트 데이터 바인딩
- [ ] 서버 타입별 대시보드 위젯
- [ ] 알림 타임라인 및 영향도 그래프

---

## 🎯 성과

### 데이터 품질
- ✅ **12개 서버 타입 완벽 커버**: SERVER_TYPE_DEFINITIONS 100% 활용
- ✅ **현실적인 메트릭**: cpuWeight, memoryWeight 등 특성 반영
- ✅ **연쇄 장애 추적**: FAILURE_IMPACT_GRAPH 기반 의존성 표현
- ✅ **포트폴리오 품질**: 실무 환경과 동일한 구조

### 기술 스택
- ✅ **PostgreSQL + JSONB**: 유연한 스키마 설계
- ✅ **RLS (Row Level Security)**: 보안 정책 적용
- ✅ **인덱스 최적화**: 시계열 조회 성능 향상
- ✅ **타입 안전성**: TypeScript 타입 정의와 100% 일치

### 확장성
- ✅ **시계열 메트릭**: 24시간 × 17서버 × 60분 = 24,480개 메트릭 지원 가능
- ✅ **알림 이력**: 무제한 알림 저장 및 검색
- ✅ **서비스 추가**: JSONB 필드로 유연한 확장

---

## 📚 참고 문서

- [Server Types](../../src/types/server.ts) - 서버 타입 정의
- [Server Metrics](../../src/types/server-metrics.ts) - 메트릭 타입 정의
- [ImprovedServerCard](../../src/components/dashboard/ImprovedServerCard.tsx) - 서버 카드 컴포넌트
- [useFixed24hMetrics](../../src/hooks/useFixed24hMetrics.ts) - 실시간 메트릭 훅

---

**작성일**: 2025-10-17  
**버전**: v1.0.0  
**상태**: 스키마 및 시드 데이터 준비 완료 ✅
