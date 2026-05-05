# 복원력 아키텍처 (Circuit Breaker & Fallback)

> Circuit Breaker, Retry-with-Fallback, Graceful Shutdown 등 시스템 복원력 패턴 레퍼런스
> Owner: platform-architecture
> Status: Active
> Doc type: Reference
> Last reviewed: 2026-05-05
> Canonical: docs/reference/architecture/infrastructure/resilience.md
> Tags: resilience,circuit-breaker,fallback,retry,error-handling
>
> **프로젝트 버전**: v8.11.97 | **Updated**: 2026-05-05

## 개요

이 프로젝트는 외부 AI 프로바이더(Cerebras, Groq, Mistral, Google, OpenRouter)에 의존하는 구조이므로, **장애 전파 차단**과 **자동 복구**를 위한 다층 복원력 패턴을 적용합니다.

현재 운영값의 기준 구현은 `cloud-run/ai-engine/deploy.sh`,
`cloud-run/ai-engine/src/config/timeout-config.ts`,
`cloud-run/ai-engine/src/services/resilience/retry-with-fallback.ts`,
`cloud-run/ai-engine/src/services/resilience/provider-fallback-control.ts`,
`cloud-run/ai-engine/src/lib/prompt-guard.ts`입니다. 이 문서는 해당 구현을 설명하는 reference이며, 정책/제약의 SSOT는 `docs/guides/ai/ai-standards.md`를 우선합니다.

```
사용자 요청
  │
  ├── [Frontend] Vercel
  │   ├── Circuit Breaker (InMemory + Redis 분산)
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
| Redis 분산 저장소 | `src/lib/redis/circuit-breaker-store.ts` | Upstash Redis 기반 분산 상태 (257줄) |

### 분산 상태 관리 (Redis)

서버리스(Vercel)에서는 인스턴스 간 상태가 공유되지 않는 한계가 있습니다.

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

### 3-way Provider Chain

Cloud Run AI Engine은 LLM 호출 시 **자동 프로바이더 전환**을 수행합니다.

```
Group A 요청(Supervisor/NLQ)
  → Groq (llama-4-scout)
     → Cerebras (llama3.1-8b)
       → Mistral (mistral-small-latest)

Group B 요청(Analyst/Reporter/Advisor/Verifier)
  → Cerebras (llama3.1-8b; 16K/32K context floor 경로는 capability gate로 skip)
     → Groq (llama-4-scout)
       → Mistral (mistral-small-latest)
```

| 프로바이더 | 모델 | 역할 | 특징 |
|-----------|------|------|------|
| **Groq** | llama-4-scout | Group A primary | Supervisor/NLQ 중심 텍스트 경로 |
| **Cerebras** | llama3.1-8b | Short-context fallback / Group B first candidate when context permits | 8K context 제약으로 long-context 경로는 Groq로 전환 |
| **Mistral** | mistral-small-latest | Tertiary | 무료 티어 친화적 최후 폴백 |

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
   - `generateObjectWithFallback()`도 provider 전환 시 공통 retry budget / fallback jitter 정책을 공유
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

### Vision Agent 3단 Fallback

이미지 분석(Vision)은 별도의 fallback chain을 가집니다:

```
Vision 요청 → Gemini (gemini-2.5-flash-lite)
                │  실패
                ▼
              OpenRouter (google/gemma-3-27b-it:free)
                │  실패
                ▼
              Analyst Agent (텍스트 기반 분석으로 대체)
```

- OpenRouter Vision은 기본적으로 tool-calling 비활성화 (`OPENROUTER_VISION_TOOL_CALLING=false`)
- 무료 티어 모델 호환성을 위해 `models` 체인 주입

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
| Agent | 45s | 35s | maxSteps=7 |
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
| 글로벌 에러 바운더리 | `Sentry.captureException` + 컴포넌트 태그 | `src/app/error.tsx` |
| Server/Edge 요청 에러 | `onRequestError()` 자동 캡처 | `instrumentation.ts` |
| AI Supervisor 에러 | `Sentry.withScope()` + traceId 태그 | `src/app/api/ai/supervisor/error-handler.ts` |
| 클라이언트 라우팅 | `onRouterTransitionStart` | `instrumentation-client.ts` |
| Sentry Tunnel | 애드블록 우회 프록시 | `src/app/sentry-tunnel/route.ts` |

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

## 관련 문서

- [AI Engine 아키텍처](../ai/ai-engine-architecture.md) - 에이전트 실행 구조
- [보안 아키텍처](./security.md) - 인증/보안 계층
- [Observability 가이드](../../../guides/observability.md) - Langfuse/Sentry 모니터링
- [Free Tier 최적화](./free-tier-optimization.md) - 비용 제약 하의 설계

_Last Updated: 2026-05-05_
