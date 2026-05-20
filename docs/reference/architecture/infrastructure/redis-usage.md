> Owner: platform-architecture
> Status: Active Canonical
> Doc type: Reference
> Last reviewed: 2026-05-20
> Canonical: docs/reference/architecture/infrastructure/redis-usage.md
> Tags: redis,upstash,cache,rate-limit,job-queue,infrastructure

# Redis (Upstash) 사용 현황

**분석 시점**: 2026-05-20 (v8.11.x 기준 코드 전수 조사)  
**인스턴스**: Upstash Redis (REST API, 동일 인스턴스를 Vercel과 Cloud Run이 공유)  
**Free Tier 한도**: 월 500K 커맨드 (Upstash pricing, 2026-05-20 확인)

---

## 클라이언트 구현 차이

| 사이드 | 클라이언트 | 위치 |
|--------|-----------|------|
| Vercel / Next.js | `@upstash/redis` SDK | `src/lib/redis/client.ts` |
| Cloud Run AI Engine | `@upstash/redis` SDK + `RedisClient` compatibility wrapper | `cloud-run/ai-engine/src/lib/redis-client.ts` |

두 클라이언트가 동일한 Upstash 인스턴스에 연결된다. Cloud Run의 공개 `RedisClient`/`redisGet`/`redisSet`/`redisDel` API는 기존 import 경계를 유지하지만 내부 HTTP 호출은 SDK로 위임한다. 환경변수는 Vercel과 Cloud Run 모두 `KV_REST_API_URL`/`UPSTASH_REDIS_REST_URL` + 대응 토큰을 사용한다. 키 충돌 방지는 아래 네임스페이스 prefix 규칙으로 관리한다.

---

## 키 네임스페이스 소유권

| Prefix | 소유 | 용도 | TTL |
|--------|------|------|-----|
| `v2:ai:response:` | Vercel BFF | AI 응답 시맨틱 캐시 | 3,600s |
| `rl:min:` | Vercel BFF | 분단위 Rate Limit | 슬라이딩 윈도우 |
| `rl:daily:` | Vercel BFF | 일단위 Rate Limit | 슬라이딩 윈도우 |
| `rl:supervisor:` | Cloud Run | Supervisor rate limit | window TTL |
| `rl:supervisor:health:` | Cloud Run | health/read rate limit | window TTL |
| `rl:jobs:write:` | Cloud Run | job process/dispatch write rate limit | window TTL |
| `rl:jobs:read:` | Cloud Run | job status/progress read rate limit | window TTL |
| `rl:default:` | Cloud Run | default API rate limit | window TTL |
| `job:` | Vercel BFF | Job Queue 상태 저장 | 설정됨 |
| `job:progress:` | Vercel BFF / Cloud Run | Job Queue 진행률 저장·조회 | 설정됨 |
| `job:list:` | Vercel BFF | owner/session별 job 목록 | 설정됨 |
| `job:trigger:` | Vercel BFF | worker trigger 중복 방지 | 설정됨 |
| `system:` | Vercel BFF | 시스템 실행 플래그 (`system:running`) | 영속 |
| `auth:guest:pin:fail:` | Vercel BFF | Guest PIN 실패 횟수 | 900s |
| `auth:guest:pin:lock:` | Vercel BFF | Guest PIN 잠금 | 60s |
| `ai:quota:` | Cloud Run | Provider 할당량 추적 | 86,400s |
| `ai:quota:cooldown:` | Cloud Run | Provider quota cooldown | provider 정책 |
| `chat:history:` | Cloud Run | 세션 채팅 히스토리 | 3,600s |
| `tool:cache:` | Cloud Run | Tool 결과 캐시 | 60s |
| `global:cache:` | Cloud Run | L2 데이터 캐시 (metrics/rag/analysis) | 60s~600s |
| `langfuse:usage:` | Cloud Run | Langfuse 월간 이벤트 사용량 가드 | 35일 |

> **신규 기능 추가 시 규칙**: 위 테이블에 없는 prefix를 사용할 경우 이 문서에 먼저 추가한다. Vercel과 Cloud Run이 동일한 prefix를 사용하면 충돌이 발생한다.

### 제거 완료 prefix

| Prefix | 현재 상태 | 정리 기준 |
|--------|-----------|-----------|
| `ai:stream:v2:` | 서버 측 resumable stream state 제거 완료 | ai-assistant-design-cleanup-plan Task 1-C에서 제거 |
| `circuit:` | Redis-backed Vercel Circuit Breaker store 제거 완료 | ai-assistant-design-cleanup-plan Task 3-C에서 제거 |

---

## 기능별 상세

### 1. AI 응답 시맨틱 캐시 (Vercel)

**파일**: `src/lib/redis/ai-cache.ts` (래퍼: `src/lib/ai/cache/ai-response-cache.ts`)

- 64차원 token-hash-v1 임베딩 + cosine 유사도 + 토큰 오버랩 복합 점수
- 최소 복합 점수 0.82 미만이면 캐시 미스
- KEYS 대신 SCAN 사용 (Upstash O(N) 블로킹 방지)
- `invalidateSessionCache()`: 세션 단위 SCAN 2회 패턴

### 2. Rate Limiting (Vercel)

**파일**: `src/lib/redis/rate-limiter.ts`, `src/lib/security/rate-limiter.ts`

- `@upstash/ratelimit` slidingWindow 알고리즘
- 2-tier 구조: Redis primary → InMemoryRateLimiter fallback (항상 동작 보장)
- `ephemeralCache: new Map()` 로컬 캐시로 Redis 호출 감소

### 3. Guest PIN brute-force 방어 (Vercel)

**파일**: `src/app/api/auth/guest-login/route.ts`

- `auth:guest:pin:fail:{identity}`: 15분 관찰 윈도우의 실패 횟수
- `auth:guest:pin:lock:{identity}`: 5회 실패 후 60초 잠금
- Redis 장애 시 request-local in-memory fallback을 사용한다.

### 4. Job Queue 저장소 (Vercel)

**파일**: `src/app/api/ai/jobs/route.ts`

- v2.0 이후 Supabase 제거, Redis 단독 저장소
- `job:{jobId}` 키: status, result, error, metadata
- **⚠️ 단일 의존성**: Redis 장애 시 fallback 없음. Redis client 미초기화와 write 실패는 2026-05-20 Task R-3에서 503 fail-fast로 정렬했다.
- **현재 연결 상태**: `useHybridAIQuery`/`useQueryExecution`은 복잡도·강제 키워드 기준으로 Job Queue를 선택하고, `useAsyncAIQuery`가 `POST /api/ai/jobs`와 `/api/ai/jobs/{id}/stream`을 호출한다. Cloud Run `routes/jobs.ts`, `routes/jobs-processor.ts`, `job-notifier.ts`도 실제 처리 경로로 남아 있다.
- **도입 배경**: 과거 Vercel 장기 실행 timeout 회피를 위해 도입된 경로다. 관련 정리 작업은 Redis 정비 계획에서 추적한다.

### 5. 시스템 실행 플래그 (Vercel)

**파일**: `src/lib/redis/client.ts`

- `system:running` 키: boolean, TTL 없음
- `/api/system` 엔드포인트가 읽음

### 6. Cloud Run Rate Limiting

**파일**: `cloud-run/ai-engine/src/middleware/rate-limiter.ts`

- Redis Lua 스크립트로 minute/daily bucket을 원자적으로 갱신한다.
- endpoint group별 prefix: `rl:supervisor`, `rl:supervisor:health`, `rl:jobs:write`, `rl:jobs:read`, `rl:default`
- Redis 장애 시 in-memory sliding window fallback을 사용한다. 이 경우 container/revision 간 rate state 공유는 약해진다.

### 7. Provider 할당량 추적 (Cloud Run)

**파일**: `cloud-run/ai-engine/src/services/resilience/quota-store-redis.ts`

- Lua 스크립트로 원자적 INCR/쿨다운 관리
- 서버 기동 시 `restoreUsageFromRedis()` 호출로 상태 복구
- Circuit Breaker 내장: 3회 연속 실패 시 30초 차단 (in-memory 상태)

### 8. Langfuse 사용량 가드 (Cloud Run)

**파일**: `cloud-run/ai-engine/src/services/observability/langfuse-usage.ts`

- `langfuse:usage:{YYYY-MM}` 키로 월간 이벤트 카운터를 저장한다.
- 50K event/month 기준 90% 도달 시 Langfuse 전송을 자동 비활성화한다.
- Redis 복원 실패 시 in-memory counter로 동작하지만 컨테이너 재시작 시 사용량 기억은 사라진다.

### 9. 세션 메모리 (Cloud Run)

**파일**: `cloud-run/ai-engine/src/services/ai-sdk/session-memory.ts`

- `chat:history:{sessionId}`: 최대 20 메시지 (token bloat 방지)
- `tool:cache:{toolName}:{queryKey}`: 비싼 tool 결과 재사용 (기본 TTL 60s)
- `base-agent-session.ts`에서 매 요청마다 조회/저장

### 10. L2 데이터 캐시 (Cloud Run)

**파일**: `cloud-run/ai-engine/src/lib/cache-layer.ts`

- L1 in-memory → L2 Redis 2단계 캐시
- metrics: 60s / rag: 300s / analysis: 600s

---

## 제거/비활성화된 기능

| 기능 | 파일 | 상태 | 메모 |
|------|------|------|------|
| Resumable Stream 상태 저장 | `stream/v2/stream-state.ts`, `upstash-resumable.ts` | ✅ 제거 완료 | 2026-05-20 Task 1-C로 파일과 Redis 저장 분기 제거. `stream/v2` GET은 405 |
| Circuit Breaker 분산 저장소 | `src/lib/redis/circuit-breaker-store.ts` | ✅ 제거 완료 | 2026-05-20 Task 3-C로 미연결 Redis CB store와 `circuit:*` 사용 가능성을 제거. Vercel CB는 in-memory only |

---

## Upstash Free Tier 소비 예산

**월 500K 커맨드 한도 기준 예상 소비 (Vercel + Cloud Run 합산)**

| 소비원 | 커맨드/요청 | 월 30K 요청 기준 |
|--------|:----------:|:---------------:|
| AI 캐시 (SCAN+GET) | 1~2 | 30K~60K |
| AI 캐시 (SET, cache miss) | 1 | ~15K (50% miss 가정) |
| Rate Limit (분+일) | 2~3 | 60K~90K |
| Cloud Run rate limit | 1 | 30K |
| Guest PIN guard | 실패 로그인 시 1~4 | 일반 AI 요청 예산에는 미포함 |
| Job Queue (생성+조회) | 3~4 | 90K~120K |
| Cloud Run session | 2~3/turn | 60K~90K |
| Cloud Run quota (Lua EVAL) | 2~3 | 60K~90K |
| Langfuse usage guard | sampled event당 1 | 10% sampling 기준 ~3K |
| Cloud Run tool/L2 cache | 0~2 | ~30K |
| **합계 예상** | **12~19** | **378K~528K** |

> 월 30K 요청 기준으로 Free Tier 한도(500K)에 근접하거나 초과할 수 있다. 요청량이 증가하면 Job Queue 유지 여부, AI 캐시 히트율, Cloud Run L2 캐시 TTL, Langfuse sample rate가 1차 최적화 대상이다.
> Job Queue를 제품 경로에서 제거하면 월 30K 요청 기준 `job:*` 계열 약 90K~120K 커맨드를 줄일 수 있으나, 공통 보안과 Cloud Run quota 계층의 Redis 사용은 별도 판단 대상이다.

---

## 관련 문서

- [복원력 아키텍처](./resilience.md) — Circuit Breaker 패턴 상세
- [Free Tier 최적화](./free-tier-optimization.md) — 비용 가드레일
- [Upstash Pricing](https://upstash.com/pricing) — Free Tier command 한도 확인
- [Redis 정비 계획](../../../../reports/planning/redis-usage-cleanup-plan.md)
