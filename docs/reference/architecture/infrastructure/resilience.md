# 복원력 아키텍처 (Circuit Breaker & Fallback)

> Circuit Breaker, Retry-with-Fallback, Graceful Shutdown 등 시스템 복원력 패턴 레퍼런스
> Owner: platform-architecture
> Status: Active
> Doc type: Reference
> Last reviewed: 2026-02-17
> Canonical: docs/reference/architecture/infrastructure/resilience.md
> Tags: resilience,circuit-breaker,fallback,retry,error-handling
>
> **프로젝트 버전**: v8.2.0 | **Updated**: 2026-02-22

## 개요

이 프로젝트는 외부 AI 프로바이더(Cerebras, Groq, Mistral, Google, OpenRouter)에 의존하는 구조이므로, **장애 전파 차단**과 **자동 복구**를 위한 다층 복원력 패턴을 적용합니다.

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
요청 → Cerebras (llama-3.3-70b)
         │  429/500 에러
         ▼
       Groq (llama-3.3-70b-versatile)
         │  429/500 에러
         ▼
       Mistral (mistral-small-2506)
         │  실패
         ▼
       ❌ 최종 실패 (모든 프로바이더 소진)
```

| 프로바이더 | 모델 | 역할 | 특징 |
|-----------|------|------|------|
| **Cerebras** | llama-3.3-70b | Primary | 가장 빠른 추론 속도 |
| **Groq** | llama-3.3-70b-versatile | Secondary | 높은 가용성 |
| **Mistral** | mistral-small-2506 | Tertiary | 안정적 폴백 |

### Retry 전략

```typescript
// cloud-run/ai-engine/src/services/resilience/retry-with-fallback.ts
const DEFAULT_RETRY_CONFIG = {
  maxRetries: 2,           // 프로바이더당 최대 2회 재시도
  initialDelayMs: 500,     // 첫 재시도 500ms 대기
  maxDelayMs: 5000,        // 최대 5초 대기
  timeoutMs: 60000,        // 프로바이더별 60초 타임아웃
};
```

**Exponential Backoff**: `delay = min(initialDelay * 2^attempt + jitter, maxDelay)`

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
Vision 요청 → Gemini (gemini-2.0-flash)
                │  실패
                ▼
              OpenRouter (nvidia/nemotron-nano-12b-v2-vl)
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
       └── Orchestrator (50s hard / 10s routing decision)
            └── Agent (45s hard / 35s warning)
                 └── Subtask (30s hard / 25s warning)
                      └── Tool (25s hard / 5s retry / 20s warning)
```

구현: `cloud-run/ai-engine/src/config/timeout-config.ts`

| 레벨 | Hard Timeout | Warning | 비고 |
|------|:-----------:|:-------:|------|
| Cloud Run | 300s | - | 플랫폼 제한, 10s margin |
| Supervisor | 50s | 40s | Soft 45s에서 정리 시작 |
| Orchestrator | 50s | 30s | 라우팅 결정 10s |
| Agent | 45s | 35s | maxSteps=7 |
| Subtask | 30s | 25s | 개별 작업 단위 |
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
| Prompt Injection | `lastIndex` 리셋 + 15개 패턴 (EN+KO) |
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

_Last Updated: 2026-02-22_
