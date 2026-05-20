# 복원력 아키텍처 (Circuit Breaker & Fallback)

> Circuit Breaker, Retry-with-Fallback, Graceful Shutdown 등 시스템 복원력 패턴 레퍼런스
> Owner: platform-architecture
> Status: Active
> Doc type: Reference
> Last reviewed: 2026-05-20
> Canonical: docs/reference/architecture/infrastructure/resilience.md
> Tags: resilience,circuit-breaker,fallback,retry,error-handling
>
> **프로젝트 버전**: v8.11.184+ | **Updated**: 2026-05-20

## 개요

이 프로젝트는 외부 AI 프로바이더(Cerebras, Groq, Mistral, Z.AI, Google Gemini)에 의존하는 구조이므로, **장애 전파 차단**과 **자동 복구**를 위한 다층 복원력 패턴을 적용합니다.

현재 운영값의 기준 구현은 `cloud-run/ai-engine/deploy.sh`,
`cloud-run/ai-engine/src/config/timeout-config.ts`,
`cloud-run/ai-engine/src/services/resilience/retry-with-fallback.ts`,
`cloud-run/ai-engine/src/services/resilience/provider-fallback-control.ts`,
`cloud-run/ai-engine/src/lib/prompt-guard.ts`입니다. 이 문서는 해당 구현을 설명하는 reference이며, 정책/제약의 SSOT는 `docs/guides/ai/ai-standards.md`를 우선합니다.

```
사용자 요청
  │
  ├── [Frontend] Vercel
  │   ├── Circuit Breaker (InMemory 전용 — Redis 분산 CB는 미연결, 2026-05-20 기준)
  │   ├── Unified Cache (LRU + SWR)
  │   └── Error Boundary (React)
  │
  └── [Backend] Cloud Run AI Engine
      ├── Request-Level Retry + Provider Chain Fallback
      ├── Circuit Breaker (서비스별 독립)
      ├── Vision Agent 3단 Fallback
      └── Graceful Shutdown (30초 타임아웃)
```

---

## Part 1: Circuit Breaker 패턴

### 설계 원칙

[Microsoft Circuit Breaker Pattern](https://learn.microsoft.com/en-us/azure/architecture/patterns/circuit-breaker) 기반.

```
                ┌─────────┐
        성공    │ CLOSED  │  실패 쌓임
      ┌────────│ (정상)   │────────┐
      │        └─────────┘        │
      │              ▲            ▼
      │              │      ┌─────────┐
      │         성공  │      │  OPEN   │  자동 리셋
      │              │      │ (차단)   │──────┐
      │              │      └─────────┘      │
      │              │            │          │
      │              │      resetTimeout 경과 │
      │              │            ▼          │
      │              │      ┌─────────┐      │
      │              └──────│HALF_OPEN│      │
      │                     │ (시험)   │──────┘
      │                     └─────────┘  실패
      └──────────────────────────────────────┘
```

### 상태 전이

| 상태 | 조건 | 동작 |
|------|------|------|
| `CLOSED` | 정상 | 모든 요청 통과 |
| `OPEN` | failures ≥ threshold | 요청 즉시 차단, 폴백 사용 |
| `HALF_OPEN` | resetTimeout 경과 | 시험 요청 허용, 성공 시 CLOSED 복원 |

### 플랫폼별 설정

| 설정 | Vercel | Cloud Run |
|------|--------|-----------|
| Failure Threshold | 3회 | 5회 |
| Success Threshold (HALF_OPEN) | 2회 성공 → CLOSED | 2회 성공 → CLOSED |
| Open Duration | 60,000ms (60초) | 30,000ms (30초) |
| 타임아웃 처리 | failure 카운트 제외 | failure 카운트 제외 |

### 구현 위치

| 계층 | 파일 | 설명 |
|------|------|------|
| Breaker 코어 | `src/lib/ai/circuit-breaker.ts` | `AIServiceCircuitBreaker` 클래스 (394줄) |
| 이벤트 시스템 | `src/lib/ai/circuit-breaker/events.ts` | 상태 전이 이벤트 발행 |
| 상태 저장 인터페이스 | `src/lib/ai/circuit-breaker/state-store.ts` | `IDistributedStateStore` |
| InMemory 저장소 | `src/lib/ai/circuit-breaker/state-store.ts` | 단일 인스턴스용 메모리 저장 |
| Redis 분산 저장소 | `src/lib/redis/circuit-breaker-store.ts` | Upstash Redis 기반 분산 상태 구현 (미연결) |

### 분산 상태 관리 (Redis) — 현재 미연결

> **2026-05-20 현황**: `RedisCircuitBreakerStore`와 `IDistributedStateStore` 구현이 완성되어 있으나, `initializeRedisCircuitBreaker()`가 request path에서 호출되지 않는다. Vercel Circuit Breaker는 현재 항상 InMemory 저장소만 사용한다.
>
> **비연결 결정 근거**: Cloud Run AI Engine이 multi-provider key rotation으로 provider 장애를 직접 흡수한다(Part 2 참조). Vercel BFF level CB가 필요한 시나리오는 Cloud Run 서비스 **전체 다운**이며, 이 경우도 각 Vercel 인스턴스의 InMemory CB가 단독으로 차단한다. 분산 CB(Redis)는 비용 대비 효과가 낮아 인터페이스 제거(ai-assistant-design-cleanup-plan.md Task 3-C) 방향으로 정리 예정이다.

설계상 Redis 분산 CB가 연결될 경우의 동작:
```
인스턴스 A (OPEN) →  Redis  ← 인스턴스 B (CLOSED)
                    circuit:serviceName
                    ┌─ state: "OPEN"
                    ├─ failures: 3
                    ├─ lastFailTime: 1739...
                    ├─ threshold: 3
                    └─ resetTimeout: 60000
```

- **Redis Hash**(`HSET/HGETALL`)로 상태 저장
- **TTL 5분** 자동 만료 (자가 복구)
- **Pipeline**으로 명령 배칭 (무료 티어 최적화)
- Redis 장애 시 InMemory 폴백 자동 전환

### 실행 래퍼 (Executor with Fallback)

```typescript
import { executeWithCircuitBreakerAndFallback } from '@/lib/ai/circuit-breaker';

const result = await executeWithCircuitBreakerAndFallback(
  'ai-supervisor',               // 서비스 이름
  () => callCloudRunAI(query),   // Primary: Cloud Run 호출
  () => localFallbackResponse()  // Fallback: 로컬 응답
);

// result.source === 'primary' | 'fallback'
```

**타임아웃 에러 특별 처리**: AbortError(타임아웃)는 failure 카운트에서 제외됩니다. 네트워크 타임아웃은 프로바이더 장애가 아니라 일시적 지연일 수 있으므로, OPEN 전이를 방지합니다.

---

## Part 2: Request-Level Retry + Provider Fallback (Cloud Run)

### Provider Mesh

Cloud Run AI Engine은 LLM 호출 시 **자동 프로바이더 전환**을 수행합니다.

```
Group A 요청(Supervisor/Metrics Query/Orchestrator)
  → Groq (llama-4-scout)
     → Z.AI (glm-4.5-flash)
       → Mistral (mistral-small-latest)
         → Cerebras (gpt-oss-120b fallback)

Analyst/Verifier 장문 요청
  → Mistral (mistral-small-latest)
     → Groq (llama-4-scout)
       → Z.AI (glm-4.5-flash)
         → Cerebras (gpt-oss-120b fallback)

Reporter 장문 요청
  → Z.AI (glm-4.5-flash)
     → Mistral (mistral-small-latest)
       → Groq (llama-4-scout)
         → Cerebras (gpt-oss-120b fallback)
```

| 프로바이더 | 모델 | 역할 | 특징 |
|-----------|------|------|------|
| **Groq** | llama-4-scout | Group A primary | Supervisor/Metrics Query 중심 텍스트 경로 |
| **Mistral** | mistral-small-latest | Analyst/Advisor primary | 32K 장문 경로와 높은 RPM guard에 맞춤 |
| **Z.AI** | glm-4.5-flash | Reporter primary / text fallback | 128K context, conservative 5 RPM guard |
| **Cerebras** | gpt-oss-120b | Text mesh fallback | 65K context. `llama3.1-8b`는 2026-05-27 deprecation 대응으로 runtime 기본값에서 제거됨 |

### Retry 전략

```typescript
// cloud-run/ai-engine/src/services/resilience/retry-with-fallback.ts
const DEFAULT_RETRY_CONFIG = {
  maxRetries: 2,           // 프로바이더당 최대 2회 재시도
  initialDelayMs: 500,     // 첫 재시도 500ms 대기
  maxDelayMs: 5000,        // 최대 5초 대기
  fallbackDelayMs: 150,    // provider 전환 전 기본 지연
  fallbackJitterMs: 250,   // provider 전환 지터 (0~250ms)
  retryBudgetPerMinute: 120, // process-wide retry/fallback budget (anti-amplification)
  timeoutMs: 60000,        // 프로바이더별 60초 타임아웃
};
```

**Same-provider retry backoff**: `delay = min(initialDelay * 2^attempt, maxDelay)`  
**Provider fallback delay**: `delay = fallbackDelayMs + random(0..fallbackJitterMs)` (thundering herd 완화)
**Retry budget guard**: 분당 retry/fallback 총량을 제한해 장애 시 재시도 증폭(cascading retry storm) 방지

### 트래픽 급증 방어 (2026-04-18 반영)

Cloud Run AI Engine은 비용/가용성 보호를 위해 아래 3중 방어를 사용합니다.

1. Cloud Run 런타임 상한
   - `max-instances=1`
   - `concurrency=16` (기존 80에서 하향)
2. 분당/일일 rate limiting
   - write/read endpoint별 버킷 분리 (`supervisor`, `jobs write/read`, `health`)
3. Endpoint group별 in-flight cap (load shedding)
   - `supervisor`: 4
   - `jobs/process`: 2
   - `embedding`: 6
   - cap 초과 시 즉시 `429`, `Retry-After=2`, `limitScope=concurrency`
4. Retry amplification guard
   - `retry-with-fallback` process-wide retry budget: `120/min`
   - 예산 소진 시 provider 전환/추가 재시도를 중단하고 fail-fast
5. Jittered `Retry-After`
   - `minute` / `concurrency` 429는 `+0~2s` jitter를 추가해 동시 재시도 파동을 완화
   - `daily` 429는 사용자 안내 정확도를 위해 jitter 없이 정확한 reset 기준 유지
6. Client-side `Retry-After` enforcement
   - `useHybridAIQuery`가 마지막 `rate-limit` error details를 메모리 ref로 유지
   - `sendQuery` / `executeQuery`는 cooldown 만료 전 fail-fast로 차단해 UI dismiss 또는 수동 retry가 서버 cooldown을 우회하지 못하게 함
   - cooldown 만료 시 ref를 자동 제거해 정상 스트리밍/Job Queue 흐름으로 복귀
7. Structured-output fallback alignment
   - `generateText + Output.object` 기반 structured-output fallback helper도 provider 전환 시 공통 retry budget / fallback jitter 정책을 공유
   - routing용 structured-output 실패와 text fallback parse 실패 모두 동일한 anti-amplification guard를 적용
   - 남은 차이는 route-specific fallback 판단 로직뿐이며, delay/budget 정책은 text retry 경로와 정렬됨

### 에러 분류

| 에러 타입 | 동작 | HTTP 코드 |
|----------|------|----------|
| Rate Limit | **Fallback** (다음 프로바이더) | 429 |
| Service Unavailable | **Fallback** | 502, 503, 504 |
| Unauthorized | **Fallback** | 401, 403 |
| Server Error | **Retry** (같은 프로바이더) | 500 |
| Timeout | **Retry** | 408, ECONNRESET |
| Client Error | **즉시 실패** | 400, 404 |

> 메시지 기반 탐지도 적용: `"rate limit"`, `"429"`, `"503"`, `"unavailable"` 등 키워드 매칭

### Vision Agent Provider Fallback

이미지 분석(Vision)은 별도의 fallback chain을 가집니다:

```
Vision 요청 → Gemini (gemini-2.5-flash-lite)
                │  실패
                ▼
              Z.AI Vision (glm-4.6v-flash)
                │  실패
                ▼
              Analyst Agent (텍스트 기반 분석으로 대체)
```

- Gemini가 사용할 수 없으면 Z.AI Vision을 사용합니다.
- 둘 다 사용할 수 없을 때만 텍스트 기반 Analyst Agent로 graceful degradation합니다.

### 타임아웃 계층 (Nested Timeout Chain)

Cloud Run AI Engine은 **계층적 타임아웃**으로 각 레벨에서 독립적으로 시간을 제어합니다.

```
Cloud Run (300s hard limit)
  └── Supervisor (50s hard / 45s soft / 40s warning)
       └── Supervisor Stream (120s hardStreaming / 96s warningStreaming)
            └── Orchestrator (90s hard / 10s routing decision / 60s warning)
                 └── Agent (45s hard / 35s warning)
                      └── Subtask (35s hard / 28s warning)
                      └── Tool (25s hard / 5s retry / 20s warning)
```

구현: `cloud-run/ai-engine/src/config/timeout-config.ts`

| 레벨 | Hard Timeout | Warning | 비고 |
|------|:-----------:|:-------:|------|
| Cloud Run | 300s | - | 플랫폼 제한, 10s margin |
| Supervisor (non-stream) | 50s | 40s | Soft 45s에서 정리 시작 |
| Supervisor (stream) | 120s | 96s | `hardStreaming` + `warningStreaming` |
| Orchestrator | 90s | 60s | 라우팅 결정 10s |
| Agent | 45s | 35s | agent별 maxSteps=2~5 |
| Subtask | 35s | 28s | 개별 작업 단위 |
| Tool | 25s | 20s | 재시도 5s |
| Reporter Pipeline | 45s | - | 이터레이션당 20s |

외부 서비스 타임아웃: LLM API 30s, Tavily 15s, Supabase 10s, Redis 5s

---

### 쿼타 기반 선제적 폴백 (Quota Tracker)

프로바이더 할당량 소진을 방지하기 위해 **사전 임계값**에서 폴백을 결정합니다.

구현: `cloud-run/ai-engine/src/services/resilience/quota-tracker.ts`

```
사용률 체크
  ├── 일일 토큰 ≥ 80%  → 선제적 폴백 (다음 프로바이더)
  ├── 분당 요청 ≥ 85%  → 대기 or 폴백 (wait < 30s면 대기)
  ├── 분당 토큰 ≥ 85%  → 대기 or 폴백
  └── 일일 토큰 ≥ 95%  → 즉시 스킵 (대기 없음)
```

| 임계값 | 비율 | 동작 |
|--------|:----:|------|
| Daily Token | 80% | 선제적 폴백 (다음 프로바이더 전환) |
| Minute Request | 85% | 대기 시간 계산, 30초 미만이면 대기 후 재시도 |
| Minute Token | 85% | 동일 |
| Critical Daily | 95% | 즉시 스킵 (해당 프로바이더 완전 회피) |

**프로바이더별 할당량**:

| Provider | 일일 토큰 | 분당 요청 | 분당 토큰 |
|----------|:---------:|:--------:|:--------:|
| Cerebras | 24M | 60 | 60K |
| Groq | 100K | 30 | 12K |
| Mistral | 1M/월 | 30 | 30K |
| Gemini | 360M | 15 | 250K |

---

## Part 3: 에러 처리 전략

### Frontend 에러 계층

| 계층 | 구현 | 파일 |
|------|------|------|
| 글로벌 에러 바운더리 | 사용자 복구 UI + `logger` 기록 | `src/app/error.tsx` |
| Server/Edge 요청 에러 | Vercel Function Logs + `instrumentation.ts` 환경 검증 | `instrumentation.ts` |
| AI Supervisor 에러 | traceId 포함 구조화 로그 + 표준 에러 응답 | `src/app/api/ai/supervisor/error-handler.ts` |
| 클라이언트 라우팅 | 브라우저 Console/Network + Playwright QA evidence | `src/app` |

### Cloud Run 에러 처리

| 패턴 | 구현 |
|------|------|
| Graceful Shutdown | `SIGTERM` → 진행 중 요청 완료 대기 (최대 30초) → 강제 종료 |
| API Key 보안 | `timingSafeEqual` 기반 비교 (timing attack 방어) |
| Rate Limiter 식별 | API Key suffix 대신 SHA-256 해시 기반 식별자 |
| Handoff 이벤트 | 무한 증가 방지 → O(1) 링 버퍼 (최대 50건) |
| Prompt Injection | `lastIndex` 리셋 + 16개 패턴 (EN+KO) |
| Heap 메모리 | 256MB 제한 (512Mi 컨테이너 headroom 확보) |

### 빈 데이터 방어 (Data Fallback)

```
OTel 번들 로딩
  ├── Primary: public/data/otel-data/hourly/*.json
  ├── Runtime loader: src/data/otel-data/index.ts (fetch/fs async)
  ├── Cloud Run fallback: cloud-run/ai-engine/data/otel-processed/hourly/*.json
  └── Last fallback: 빈 슬롯 동적 생성 (무중단 응답 보장)
```

---

## Part 4: 캐시 전략 (다층 캐시)

### Unified Cache System (v3.1)

`src/lib/cache/unified-cache.ts` — 3개 중복 캐시를 하나로 통합.

| 레벨 | 저장소 | TTL | 용도 |
|------|--------|-----|------|
| L1 | Memory LRU (5,000 항목) | 30s~1h | 빠른 반복 조회 |
| L2 | Redis (Upstash) | API별 설정 | 인스턴스 간 공유 |
| SWR | Vercel CDN | `s-maxage` + `stale-while-revalidate` | Edge 캐시 |

### TTL 계층 프리셋

```typescript
export const CacheTTL = {
  SHORT: 30,     // 실시간 데이터 (서버 메트릭)
  MEDIUM: 300,   // 대시보드 (5분)
  LONG: 1800,    // 분석 결과 (30분)
  STATIC: 3600,  // 정적 데이터 (1시간)
};
```

### SWR (Stale-While-Revalidate) 프리셋

```typescript
export const SWRPreset = {
  REALTIME:  { maxAge: 0,    sMaxAge: 30,   staleWhileRevalidate: 60   },
  DASHBOARD: { maxAge: 60,   sMaxAge: 300,  staleWhileRevalidate: 600  },
  AI:        { maxAge: 300,  sMaxAge: 1800, staleWhileRevalidate: 3600 },
  STATIC:    { maxAge: 1800, sMaxAge: 3600, staleWhileRevalidate: 7200 },
};
```

---

## Part 5: 상태 모니터링

### Circuit Breaker 상태 조회

```typescript
import { getAIStatusSummary } from '@/lib/ai/circuit-breaker';

const status = getAIStatusSummary();
// {
//   circuitBreakers: { 'ai-supervisor': { state: 'CLOSED', failures: 0 } },
//   stateStore: 'redis' | 'in-memory',
//   stats: { totalBreakers: 2, openBreakers: 0, totalFailures: 0 }
// }
```

### Cloud Run `/monitoring` 엔드포인트

```bash
curl -H "X-API-Key: $SECRET" https://ai-engine-xxx.run.app/monitoring
```

응답에 Circuit Breaker 상태, 에이전트 상태, Langfuse 사용량이 포함됩니다.

---

## Part 6: 외부 서비스 의존성 & Graceful Degradation 맵

Redis(Upstash)와 Supabase가 다운될 때 시스템이 어떻게 동작하는지 정리합니다.

### Redis (Upstash) 의존성

| 사용처 | 역할 | Redis 없을 때 동작 |
|--------|------|-------------------|
| AI 응답 캐시 (`lib/redis/ai-cache.ts`) | 동일 쿼리 결과 재사용 | cache miss 처리 — AI 매번 새로 호출, 느려지지만 정상 동작 |
| Rate Limiter (`lib/redis/rate-limiter.ts`) | API 요청 횟수 제한 | 인스턴스별 메모리 폴백 — 인스턴스 간 공유 안 됨 |
| Job Queue (`api/ai/jobs/**`, Cloud Run `job-notifier`) | async job 상태, progress, 결과 전달 | Redis 단독 의존 — job 생성/조회/stream이 503 또는 실패 |
| 시스템 실행 플래그 (`system:running`) | Vercel 서버리스의 사용자-facing 실행 상태 SSOT | Redis 값이 없으면 프로세스 기반 상태로 후퇴하거나 unknown 처리 |
| 게스트 PIN 잠금 (`api/auth/guest-login/route.ts`) | 브루트포스 차단 (5회 실패→60초 잠금) | 인스턴스별 메모리 폴백 — 인스턴스 재시작 시 카운트 초기화 |
| Cloud Run Rate Limiter (`middleware/rate-limiter.ts`) | Supervisor/job/read endpoint 제한 | in-memory fallback — revision/container 간 공유 약화 |
| Cloud Run quota/cooldown (`quota-store-redis.ts`) | Provider quota 원자 예약과 cooldown 공유 | in-memory fallback — 재시작/rolling revision 간 상태 보존 약화 |
| Cloud Run session/tool/L2 cache | 대화 히스토리와 tool/data cache | cache miss 또는 짧은 컨텍스트로 후퇴 |
| Langfuse usage guard (`langfuse-usage.ts`) | 월간 이벤트 사용량 가드 | in-memory fallback — 재시작 시 카운터 복원 불가 |
| Circuit Breaker 분산 저장 (`lib/redis/circuit-breaker-store.ts`) | 인스턴스 간 차단 상태 공유 | 현재 request path 미연결 — 제거 예정 |
| AI 스트림 resume 상태 | 스트림 중단 후 재연결 | 2026-05-20 제거 완료. `stream/v2` GET은 Redis 조회 없이 405 |

**결론**: Redis 다운 시 streaming/direct AI 경로와 일반 대시보드는 대부분 degradation으로 버틴다. 그러나 async Job Queue는 Redis 단독 의존이므로 정상 동작하지 않으며, `system:running`과 보안/할당량 상태는 인스턴스별 fallback 또는 unknown 상태로 약해진다. 상세 사용 현황과 정리 기준은 [Redis 사용 현황](./redis-usage.md)을 따른다.

### Supabase 의존성

| 사용처 | 역할 | Supabase 없을 때 동작 |
|--------|------|----------------------|
| GitHub OAuth 로그인 (`lib/auth/api-auth.ts`) | JWT 서명 검증 | 로그인 불가 — guest PIN 로그인은 Supabase 무관하여 계속 동작 |
| Knowledge Retrieval Lite (`search_knowledge_text` RPC) | 지식베이스 텍스트 검색 | RPC 실패 시 BM25 인메모리 경로 또는 빈 결과 반환 |
| 로그인 감사 로그 (`lib/auth/login-audit.ts`) | 보안 이벤트 기록 | graceful — 로그 소실, 기능 영향 없음 |
| 헬스체크 (`api/health/route.ts`) | DB 상태 표시 | `error` 상태 노출, 서비스는 정상 운영 |

**결론**: Supabase 다운 시 GitHub 로그인이 막힙니다. guest PIN 로그인·AI 대화·대시보드는 정상 동작합니다.

---

## Part 7: 의존성 버전 정렬 정책

루트 앱(Vercel)과 AI Engine(Cloud Run)은 독립 배포 단위이나, 아래 핵심 패키지는 버전을 정렬해 로깅 동작 및 타입 호환을 유지한다.

| 패키지 | 정렬 기준 | 이유 |
|--------|----------|------|
| `zod` | 동일 major | 향후 타입 공유 가능성 대비; v3 ↔ v4는 API 시그니처 파괴적 변경 |
| `pino` | 동일 major | 로깅 포맷·transport 동작 일관성 |
| `typescript` | 동일 exact 버전 | 타입 체크 결과 호환 필수 |
| `@ai-sdk/*` | 루트 기준 AI Engine 후행 허용 | SDK 계약 변경 충격 흡수 |

**이중화 발생 시 처리**:
1. 기술 부채 계획서 또는 유지보수 이슈에 항목 기록
2. 다음 정기 유지보수 사이클(~30커밋 또는 1주)에서 정렬
3. 정렬 완료 커밋 메시지에 `[DEPS]` 태그 포함

**npm audit 대응 의사결정**:
```
npm audit 결과
  ├─ same-major 패치 존재? → 즉시 업그레이드
  ├─ force downgrade 필요? → 금지, upstream 패치 대기
  └─ 의존 패키지가 원인? → 내부 구현 대체 검토
                          (사례: @google-cloud/pino-logging-gcp-config → logger.ts 직접 구현)
```

**이력**:
- 2026-05: AI Engine zod v3→v4 마이그레이션 완료 (`zod@4.4.3`)
- 2026-05: AI Engine pino v9→v10 정렬 완료 (`pino@10.3.1`)
- 2026-05: AI Engine `@google-cloud/pino-logging-gcp-config` 제거 → `logger.ts` 내부 구현 완료

---

## 관련 문서

- [AI Engine 아키텍처](../ai/ai-engine-architecture.md) - 에이전트 실행 구조
- [보안 아키텍처](./security.md) - 인증/보안 계층
- [의존성 정책](./dependency-policy.md) - 버전 정렬과 npm audit 대응 기준
- [Observability 가이드](../../../guides/observability.md) - Langfuse, 구조화 로그, 에러 확인 경로
- [Free Tier 최적화](./free-tier-optimization.md) - 비용 제약 하의 설계

_Last Updated: 2026-05-11_
