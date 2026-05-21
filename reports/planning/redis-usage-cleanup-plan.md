> Owner: project
> Status: In Progress
> Doc type: Plan
> Last reviewed: 2026-05-21
> Tags: redis,upstash,cleanup,dead-code,documentation

# Redis 사용 현황 정비 계획

**작성 배경**: 2026-05-20 정적 코드 분석으로 Redis 사용 현황을 전수 조사한 결과, 사문화된 기능 2건과 운영 위험 2건, 문서 불일치 다수를 발견했다.  
**분석 범위**: `src/` (Vercel/Next.js), `cloud-run/ai-engine/src/` (Cloud Run AI Engine)  
**연관 계획서**: [ai-assistant-design-cleanup-plan.md](archive/ai-assistant-design-cleanup-plan.md) — Task 1-C(resumable 제거), Task 3-C(CB store 정리)와 겹치는 항목은 해당 계획서 기준으로 실행했다.

**현재 실행 상태**: R-0~R-4, R-6 완료. R-5는 2026-05-21 data-plane INFO/DBSIZE 스냅샷을 기록했지만, 월간 command usage 보정은 Upstash dashboard 또는 management API 사용량 접근이 필요한 사용자 액션으로 남아 있다.

---

## 핵심 판단

Redis는 과거 multi-agent 장기 실행 작업을 Vercel timeout 밖으로 분리하기 위한 Queue 저장소로 도입됐지만, 현재 코드는 Queue 외에도 공통 보안과 Cloud Run runtime state/cache에 Redis를 사용한다. 따라서 정리 순서는 "Redis 전체 제거"가 아니라 아래 결정 게이트를 먼저 통과해야 한다.

```
R-0 유지 판단
  ├─ Async Job Queue 유지 → Redis는 job path 필수, R-3 유지
  └─ Async Job Queue 제거 → job:* 제거 범위 산정, R-3는 제거 작업으로 대체 가능

Upstash 전체 제거 판단은 별도:
  rate limit / Guest PIN / system:running / Cloud Run quota/rate limit / Langfuse usage guard 대체 설계가 필요
```

**R-0 결정 (2026-05-20)**: **옵션 A — Job Queue 유지**.
이유: `/api/ai/jobs*`가 현재 사용자 경로와 Cloud Run job worker에 연결된 활성 경로이며, 제거는 라우팅/UI/worker를 함께 정리하는 별도 리팩터다. Upstash 전체 제거(옵션 C)는 비-Job Redis 사용처 대체 설계가 없어 채택하지 않는다.

**현재 결론**: 사문화된 `ai:stream:v2:*`, `circuit:*`는 제거 완료됐다. Job Queue는 유지하며, Upstash 인스턴스 자체도 즉시 제거 대상이 아니다.

| 범주 | R-0 판단 기준 | 근거 |
|------|---------------|------|
| Async Job Queue | 유지/제거 결정 필요 | `/api/ai/jobs*`와 Cloud Run `job-notifier`가 Redis 단독 저장소를 사용한다. 제품에서 async job flow를 제거하거나 비활성화하면 `job:*` 계열은 제거 가능하다. |
| 공통 보안 | Redis 유지 권장 | Rate Limit과 Guest PIN brute-force 방어는 in-memory fallback이 있으나 Redis가 있어야 서버리스 인스턴스 간 일관성이 유지된다. |
| 시스템 실행 상태 | 유지 또는 대체 설계 필요 | Vercel 서버리스에서는 `/api/system`이 `system:running`을 사용자-facing 실행 상태 SSOT로 사용한다. |
| Cloud Run quota/cooldown | 유지 권장 | Provider quota 예약과 cooldown은 Redis Lua 원자 연산으로 관리된다. Redis 장애 시 memory fallback은 있으나 재시작/rolling revision 간 상태 보존은 약해진다. |
| Cloud Run rate/observability guard | 유지 권장 | Cloud Run rate limit과 Langfuse usage guard는 memory fallback이 있으나 재시작/rolling revision 간 카운터 보존은 Redis가 우세하다. |
| Cloud Run session/cache | 선택 유지 | 세션 히스토리, tool cache, L2 data cache는 품질/성능 최적화 계층이다. 제거는 가능하지만 컨텍스트 지속성·비용·응답 품질 영향 평가가 필요하다. |
| 사문화 기능 | 제거 | `ai:stream:v2:`와 `circuit:`는 현재 읽히지 않거나 request path에 연결되지 않는다. |

---

## 현재 Redis 사용 현황

### Vercel/Next.js 사이드 (`@upstash/redis` SDK)

| 용도 | 파일 | 키 패턴 | TTL | 상태 |
|------|------|---------|-----|------|
| AI 응답 시맨틱 캐시 | `src/lib/redis/ai-cache.ts` | `v2:ai:response:{endpoint}:{sessionHash}:{queryHash}` | 3,600s | ✅ 실사용 |
| Rate Limiting | `src/lib/redis/rate-limiter.ts` | `rl:min:*`, `rl:daily:*` | 슬라이딩 윈도우 | ✅ 실사용 (in-memory fallback 있음) |
| Job Queue 저장소 | `src/app/api/ai/jobs/route.ts` | `job:{jobId}` | 설정됨 | ✅ 실사용 (Redis 단독, fallback 없음) |
| Job Queue progress/list/trigger | `src/app/api/ai/jobs/**` | `job:progress:*`, `job:list:*`, `job:trigger:*` | 설정됨 | ✅ 실사용 |
| Guest PIN 방어 | `src/app/api/auth/guest-login/route.ts` | `auth:guest:pin:fail:*`, `auth:guest:pin:lock:*` | 900s / 60s | ✅ 실사용 (in-memory fallback 있음) |
| 시스템 실행 플래그 | `src/lib/redis/client.ts` | `system:running` | 영속 | ✅ 실사용 |
| Resumable 스트림 상태 | `src/app/api/ai/supervisor/stream/v2/stream-state.ts` | `ai:stream:v2:{ownerKey}:{sessionId}` | 600s | ✅ 제거 완료 (2026-05-20 Task 1-C) |
| Circuit Breaker 분산 저장소 | `src/lib/redis/circuit-breaker-store.ts` | `circuit:{serviceName}` | 300s | ✅ 제거 완료 (2026-05-20 Task 3-C) |

### Cloud Run AI Engine 사이드 (`@upstash/redis` SDK + compatibility wrapper)

| 용도 | 파일 | 키 패턴 | TTL | 상태 |
|------|------|---------|-----|------|
| Provider 할당량 추적 | `src/services/resilience/quota-store-redis.ts` | `ai:quota:*`, `ai:quota:cooldown:*` | 86,400s | ✅ 실사용 (Lua 원자 연산) |
| Cloud Run Rate Limiting | `src/middleware/rate-limiter.ts` | `rl:supervisor:*`, `rl:jobs:*`, `rl:default:*` | window TTL | ✅ 실사용 (in-memory fallback 있음) |
| 세션 채팅 히스토리 | `src/services/ai-sdk/session-memory.ts` | `chat:history:{sessionId}` | 3,600s | ✅ 실사용 (최대 20 메시지) |
| Tool 결과 캐시 | `src/services/ai-sdk/session-memory.ts` | `tool:cache:{toolName}:{queryKey}` | 60s | ✅ 실사용 |
| Job 결과 전달 | `src/lib/job-notifier.ts` | (job 관련 키) | TTL 있음 | ✅ 실사용 |
| L2 데이터 캐시 | `src/lib/cache-layer.ts` | `global:cache:*` | metrics 60s / rag 300s / analysis 600s | ✅ 실사용 |
| Langfuse 사용량 가드 | `src/services/observability/langfuse-usage.ts` | `langfuse:usage:*` | 35일 | ✅ 실사용 (in-memory fallback 있음) |

---

## 발견된 문제

### 🔴 문제 1: Resumable 스트림 — 서버 저장, 클라이언트 미연결 (사문화)

- 기존 `stream/v2/route.ts`는 `AI_RESUMABLE_STREAMS_ENABLED=true`이면 Redis에 스트림 상태를 저장했다.
- 기존 `useHybridAIQuery.ts`는 `resume: false`로 고정되어 클라이언트가 resume을 시도하지 않았다.
- 결과: 서버는 Upstash 커맨드를 소비하지만 그 데이터는 읽히지 않았다.
- **처리 결과**: `archive/ai-assistant-design-cleanup-plan.md` Task 1-C에서 서버 resumable 코드 전체 제거 완료. `stream/v2` GET은 405를 반환한다.

### 🔴 문제 2: Circuit Breaker Redis Store — 구현됐으나 연결 없음 (사문화)

- 기존 `src/lib/redis/circuit-breaker-store.ts`: `RedisCircuitBreakerStore`, `initializeRedisCircuitBreaker()` 구현이 있었으나 제거 완료
- 기존 `src/lib/ai/circuit-breaker.ts`: `IDistributedStateStore` public surface가 있었으나 제거 완료
- 실제 request path에서 `initializeRedisCircuitBreaker()` 호출이 없었고, Task 3-C 이후 해당 연결점 자체가 제거됨 → 항상 in-memory만 사용
- **추가 맥락 (2026-05-20)**: Cloud Run AI Engine이 multi-provider key rotation으로 provider 장애를 흡수하므로, Vercel BFF level CB의 필요성이 당초보다 낮음. Vercel CB는 Cloud Run 서비스 **전체 다운**에만 의미가 있으며 개별 provider 실패는 Cloud Run이 이미 처리함
- **처리 결과**: `archive/ai-assistant-design-cleanup-plan.md` Task 3-C에서 인터페이스와 Redis CB store 파일 제거 완료 (옵션 B)

### 🟢 문제 3: Job Queue — Redis 단독 의존, 장애 시 fail-fast 보강 완료

- `src/app/api/ai/jobs/route.ts`: Supabase 제거(v2.0) 이후 Redis가 유일한 저장소
- Rate Limiting과 달리 Job Queue에는 in-memory fallback이 없음
- Redis 장애 시 job 생성/조회 모두 불가능하다. 2026-05-20 Task R-3에서 client 미초기화와 `redisSet()` write 실패를 명시적 503 fail-fast로 정렬했다.
- **처리 결과**: Job Queue 유지 결정(옵션 A)과 무관하게 운영성 안전망을 먼저 보강했다.

### 🟢 문제 4: Vercel vs Cloud Run Redis 클라이언트 — SDK 정렬 및 키 네임스페이스 문서화 완료

- Vercel: `@upstash/redis` SDK (`src/lib/redis/client.ts`)
- Cloud Run: `@upstash/redis` SDK + 기존 `RedisClient` compatibility wrapper (`cloud-run/ai-engine/src/lib/redis-client.ts`)
- 동일한 Upstash 인스턴스를 공유하므로 키 충돌 가능성 있음
- 현재는 prefix 패턴으로 격리되어 있으며 `docs/reference/architecture/infrastructure/redis-usage.md`에 공식 네임스페이스 정책을 문서화했다.
- **처리 결과**: 2026-05-20 follow-up에서 Cloud Run 직접 fetch HTTP 클라이언트를 SDK 기반으로 교체했다. 공개 API(`getRedisClient`, `redisGet`/`redisSet`/`redisDel`, `RedisClient` 등)는 유지해 기존 importers 수정은 필요 없다.

### 🟡 문제 5: 아키텍처 문서 불일치

- `docs/architecture/01-system-overview.md`: 과거에는 "Redis는 job state, progress, resumable stream state를 저장"한다고 설명해 사문화된 resumable stream을 active 기능처럼 보이게 했다.
- `docs/reference/architecture/infrastructure/resilience.md`: Frontend CB가 "Redis 분산"을 사용한다고 표시되어 있었으나 실제로는 연결 안 됐다.
- `docs/reference/architecture/infrastructure/free-tier-optimization.md`, `docs/reference/architecture/system/system-architecture-current.md`: resumable stream과 Redis CB를 지원 기능처럼 설명한 문구가 남아 있었다.
- **처리 방침**: 본 계획서의 Task R-4로 처리. 2026-05-20 초안에서 문서 관계를 정렬했고, Task 1-C 구현 후 resumable stream 관련 표현은 제거 완료 상태로 갱신했다.

### 🟡 문제 6: Upstash Free Tier 소비 예산 미추적

- Vercel + Cloud Run이 동일 인스턴스를 사용, 월 500K 커맨드 공유
- 소비 내역: AI 캐시 SCAN/SET/GET + Rate Limit + Job Queue + Cloud Run quota/session/cache
- 현재 사용량 모니터링 없음 (Upstash 대시보드만으로 확인 가능)
- **처리 방침**: 문서에 소비 예상치 항목 추가, 주요 소비원 명시

---

## 작업 계획

### Task R-0: Redis 유지/축소 의사결정 게이트 (🔴)

**목표**: Redis 제거 가능성을 Job Queue 관점과 비-Queue 사용처 관점으로 분리해 결정한다.

**확인 항목**:
- `/api/ai/jobs*` 호출자가 현재 사용자 경로에서 남아 있는지 확인
- Cloud Run `job-notifier`가 실제 production flow에서 필요한지 확인
- streaming/direct 경로가 Vercel timeout 회피 요구를 충분히 대체했는지 확인
- AI Assistant 외 Redis 사용처를 제거 대상에서 분리
  - Rate Limit: fallback 있음, 서버리스 인스턴스 간 일관성은 Redis가 우세
  - Guest PIN brute-force 방어: fallback 있음, 글로벌 잠금 일관성은 Redis가 우세
  - `system:running`: Vercel 서버리스의 사용자-facing 실행 상태 SSOT
  - Cloud Run quota/cooldown: memory fallback 있음, 재시작/rolling revision 간 보존성은 Redis가 우세
  - Cloud Run rate limit / Langfuse usage guard: fallback 있음, 재시작·revision 간 카운터 보존성은 Redis가 우세

**사전 inventory (2026-05-20)**:
- `/api/ai/jobs*`는 현재 dead path가 아니다. `useHybridAIQuery`/`useQueryExecution`은 복잡도 기준과 강제 키워드 기준으로 Job Queue를 선택하고, `useAsyncAIQuery`가 `POST /api/ai/jobs`와 `/api/ai/jobs/{id}/stream`을 호출한다.
- `/api/ai/supervisor` legacy route도 복잡한 요청에 대해 202 `redirect: "job-queue"`를 반환했으나, `archive/ai-assistant-design-cleanup-plan.md` Task 2-B에서 이 legacy redirect를 제거했다.
- Cloud Run `routes/jobs.ts`, `routes/jobs-processor.ts`, `lib/job-notifier.ts`가 Redis `job:*`/`job:progress:*`를 실제 처리 경로로 사용한다.
- 따라서 현재 코드 기준으로는 "예전 Queue라서 이미 없어도 됨"이 아니라 "아직 제품 경로에 연결되어 있으므로 제거하려면 라우팅/UI/worker 제거 결정이 선행"이다.

**결정 옵션**:

| 옵션 | 의미 | 후속 작업 |
|------|------|-----------|
| A. Job Queue 유지 | Redis는 AI async job path 필수 저장소로 유지 | R-3 완료 상태 유지, budget 추적 유지 |
| B. Job Queue 제거/비활성 | old Vercel timeout 회피용 queue path를 제품 표면에서 제거 | `/api/ai/jobs*`, `job-notifier`, `job:*` prefix 정리 계획 추가 |
| C. Upstash 전체 제거 검토 | Queue 외 사용처까지 Redis 제거 | Rate Limit, Guest PIN, `system:running`, Cloud Run quota/rate limit, Langfuse usage guard 대체 설계가 선행 조건 |

**수용 기준**:
- 위 옵션 중 하나를 TODO와 본 계획서에 명시
- 선택한 옵션의 제거/유지 범위는 본 계획서와 TODO에 기록하고, `docs/reference/architecture/infrastructure/redis-usage.md`에는 실제 사용 현황과 lifecycle status만 반영
- Upstash 전체 제거를 선택하지 않는 경우에도 "왜 유지하는지"가 기능별로 문서화됨

- [x] 현재 `/api/ai/jobs*` 호출자 inventory 확인
- [x] 옵션 A/B/C 중 결정 기록 — 옵션 A(Job Queue 유지)
- [x] 결정 결과를 TODO/Redis 문서에 반영

---

### Task R-1: Resumable Stream Redis 코드 제거 (🔴)

→ **archive/ai-assistant-design-cleanup-plan.md Task 1-C에 통합 실행**

완료됨. Task 1-C 구현으로 `stream-state.ts`, `upstash-resumable.ts`, `stream/v2/route.ts`의 resumable 분기와 `useHybridAIQuery`의 `resume` prop이 제거됐다. `stream/v2` GET은 Redis resume 대신 explicit 405를 반환한다.

- [x] Task 1-C 완료 확인 후 체크

---

### Task R-2: Circuit Breaker Redis Store 인터페이스 제거 (🔴)

→ **archive/ai-assistant-design-cleanup-plan.md Task 3-C에 통합 실행**

완료됨. Task 3-C 옵션 B에 따라 `IDistributedStateStore`, `ensureRedisStateStore`, `setDistributedStateStore`와 `src/lib/redis/circuit-breaker-store.ts`를 제거했다. `getAIStatusSummary().stateStore`는 `in-memory`로 고정된다.

**2026-05-20 추가 판단**: Cloud Run multi-provider rotation이 실질적 fault tolerance를 담당하므로 Vercel BFF Circuit Breaker는 Cloud Run 전체 다운 시나리오만 커버하면 충분. in-memory CB 유지 + Redis 분산 CB 미연결 결정은 합리적이며 Task 3-C 완료로 정리된다.

- [x] Task 3-C 완료 확인 후 체크

---

### Task R-3: Job Queue Redis 단일 의존성 — 오류 응답 개선 (🟠)

**파일**: `src/app/api/ai/jobs/route.ts`

**전제**: R-0에 의해 막히지 않는다. Job Queue 제거(옵션 B)가 확정되면 route 제거 작업이 이 항목을 대체할 수 있다.  
**목표**: Redis client 미초기화뿐 아니라 write/read 실패도 명시적 503 + 사용자 안내로 정렬한다.

```ts
return NextResponse.json(
  {
    error: 'Job queue unavailable',
    reason: 'redis_unavailable', // or 'redis_write_failed'
    fallback: 'Use /api/ai/supervisor directly',
  },
  { status: 503 }
);
```

**수용 기준**:
- Redis 연결 실패 또는 `redisSet()` 실패 시 `/api/ai/jobs POST`가 503을 반환하고 클라이언트가 적절한 안내를 받음
- 기존 정상 경로에 영향 없음

- [x] 구현
- [x] 테스트: Redis client 없음 / `redisSet()` false 시 503 반환 확인
- [x] 검증: targeted route tests, root `type-check`, `lint`, `test:quick`, `test:contract`

---

### Task R-4: 아키텍처 문서 Redis 설명 정정 (🟡)

**대상 파일**:
1. `docs/architecture/01-system-overview.md` — Redis 역할 설명 업데이트
2. `docs/reference/architecture/infrastructure/resilience.md` — CB Redis 연결 상태 정정
3. `docs/reference/architecture/infrastructure/redis-usage.md` (신규) — 키 네임스페이스 레퍼런스
4. `docs/reference/architecture/infrastructure/free-tier-optimization.md` — resumable/CB 비용 설명 정정
5. `docs/reference/architecture/system/system-architecture-current.md` — stream resume 상태 정정
6. `docs/reference/architecture/ai/frontend-backend-comparison.md` — cache/Redis state 비교 정정

**현재 상태 (2026-05-20)**: 문서 초안은 생성/연결 완료. R-1/R-2 관련 "제거 예정" 표현은 "제거 완료"로 최종 정렬했다.

**수용 기준**:
- 사문화된 resumable stream과 CB Redis store가 "미사용/제거됨"으로 표시됨
- 키 네임스페이스 ownership 테이블이 문서화됨

- [x] 01-system-overview.md 수정 초안
- [x] resilience.md 수정 초안
- [x] redis-usage.md 신규 생성
- [x] free-tier-optimization.md 수정 초안
- [x] system-architecture-current.md 수정 초안
- [x] frontend-backend-comparison.md 수정 초안
- [x] R-1/R-2 구현 후 최종 표현 정렬

---

### Task R-5: Upstash 소비 예산 추적 기준 문서화 (🟡)

**대상**: `docs/reference/architecture/infrastructure/redis-usage.md` 내 섹션

월 500K 커맨드 기준 예상 소비 항목:

| 소비원 | 예상 커맨드/요청 | 비고 |
|--------|:------------:|------|
| AI 응답 캐시 (GET) | 1~2 | SCAN + GET |
| AI 응답 캐시 (SET) | 1 | cache miss 시만 |
| Rate Limit | 2~3 | 분단위 + 일단위 slidingWindow |
| Job Queue (생성) | 2~3 | SET + expire |
| Job Queue (조회) | 1 | GET |
| Cloud Run rate limit | 1 | Lua script (EVAL) |
| Cloud Run session memory | 1~2 | GET/SET per turn |
| Cloud Run tool cache | 0~1 | cache miss 시 SET |
| Cloud Run quota | 2~3 | Lua script (EVAL) |
| Langfuse usage guard | 0~1 | sampled event 저장 |

누적 예상: 요청당 12~19 커맨드 → 월 30K 요청이면 378K~528K 커맨드 (500K 한도 근접/초과 가능)

**2026-05-21 data-plane 스냅샷**:
- Upstash REST `INFO`: `total_commands_processed=60,495`, `instantaneous_ops_per_sec=1`, `keyspace_hits=63,875`, `keyspace_misses=16,729`, `expired_keys=4,247`, `evicted_keys=0`
- Upstash REST `DBSIZE`: `32`
- 저장 데이터: `total_data_size=15.895KB`
- 판단: 현재 키 수와 저장 용량은 낮고 eviction은 없다. 단, 이 값은 Redis INFO 누적/현재 상태이며 Upstash 월간 billing command usage가 아니므로 R-5의 월간 소비량 보정 완료 근거로 사용하지 않는다.

- [x] redis-usage.md 내 예산 섹션 초안 작성
- [x] data-plane INFO/DBSIZE 스냅샷 기록
- [ ] 실제 Upstash dashboard 확인값이 생기면 예상치 보정

---

### Task R-6: Cloud Run Redis 클라이언트 SDK 정렬 (🟢)

**목표**: Cloud Run AI Engine의 직접 fetch 기반 Upstash REST 호출을 공식 `@upstash/redis` SDK로 정렬하고, 기존 공개 API와 Circuit Breaker 동작은 유지한다.

**처리 결과**:
- `cloud-run/ai-engine/package.json`에 `@upstash/redis ^1.38.0` 추가
- `cloud-run/ai-engine/src/lib/redis-client.ts` 내부 구현을 SDK 기반으로 교체
- Circuit Breaker, per-call timeout, `eval` Lua script 경계 유지
- `cloud-run/ai-engine/src/lib/redis-client.test.ts`를 SDK mock 기준으로 전환
- 기존 importers(`server.ts`, `cache-layer.ts`, `job-notifier.ts` 등)는 공개 API 유지로 수정 불필요

- [x] 구현
- [x] 테스트: AI Engine full test 기준 1348/1348 PASS 확인

---

## 실행 우선순위

| Task | 우선순위 | 상태 | 의존성 |
|------|:------:|------|--------|
| R-0 Redis 유지/축소 판단 | 🟢 Done | 옵션 A(Job Queue 유지) | 독립 |
| R-1 Resumable 제거 | 🟢 Done | 완료 | archive/ai-assistant-design-cleanup-plan.md |
| R-2 CB Store 제거 | 🟢 Done | 완료 | archive/ai-assistant-design-cleanup-plan.md |
| R-3 Job Queue 503 | 🟢 Done | 완료 | 독립 안전망 구현 완료 |
| R-4 문서 정정 | 🟢 Done | 완료 | R-1, R-2 완료 후 최종 확정 |
| R-5 예산 문서화 | 🟡 Low | 초안 완료, 실측 보정 대기 | R-4 |
| R-6 Cloud Run Redis SDK 정렬 | 🟢 Done | 완료 | R-0 옵션 A 유지 결정 |

---

## 완료 기준

- R-0에서 Redis 유지/축소 옵션 A(Job Queue 유지) 결정 완료
- `archive/ai-assistant-design-cleanup-plan.md` Task 1-C, 3-C 완료
- Job Queue Redis 오류 503 반환 완료. Job Queue 제거 선택 시 `job:*` 관련 route/worker/UI 표면 정리 범위 확정
- `redis-usage.md` 키 네임스페이스 테이블 작성 완료
- `01-system-overview.md` Redis 설명이 실제 사용 현황과 일치
- Cloud Run Redis 클라이언트가 SDK 기반으로 정렬되고 기존 공개 API 호환성을 유지
