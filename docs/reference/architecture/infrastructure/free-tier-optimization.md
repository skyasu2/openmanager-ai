# Free Tier 최적화 & 성능 전략

> 무료 티어 가드레일, 비용 최적화, Web Vitals 성능 전략 레퍼런스
> Owner: platform-architecture
> Status: Active
> Doc type: Reference
> Last reviewed: 2026-04-29
> Canonical: docs/reference/architecture/infrastructure/free-tier-optimization.md
> Tags: free-tier,cost,performance,web-vitals,optimization
>
> **프로젝트 버전**: v8.11.65 | **Updated**: 2026-04-30

## 개요

이 프로젝트는 실 서비스 배포 기준 **`Vercel Pro` 고정비를 제외한 가변 운영 비용 ₩0**를 목표로 설계되었습니다. `Vercel`은 **유일한 유료 예외**이지만, Pro 기능은 꼭 필요할 때만 제한적으로 사용하고, 기본 설계와 운영 사용량은 **무료 티어 수준**을 유지해야 합니다. Free로 전환해도 핵심 서비스 경로가 깨지지 않아야 하며, 나머지 인프라는 무료 티어 내에서 동작하도록 **가드레일이 코드 수준에서 강제**됩니다.

> **⚠️ [주의: 코딩용 AI 등 개발 환경 비용 제외]**
> ₩0 운영 비용 원칙은 오직 배포되어 스탠드얼론으로 동작하는 서비스(Vercel, Cloud Run, 무료 LLM API 등)에만 해당됩니다. 코드를 기획/작성하는 과정에서 개발자가 별도로 지출하는 AI 코딩 에디터(Cursor, Claude Code 등)의 유료 비용은 본 문서의 `₩0 설계 제약`과 무관하므로, 추후 문서를 참조할 때 혼동하지 않도록 분리하여 인지해야 합니다.

### 인프라 비용 요약

| 서비스 | 플랜 | 월 제한 | 현재 사용 | 비용 |
|--------|------|---------|----------|------|
| **Vercel** | Pro (예외) | 꼭 필요한 기능만 사용, 기본 사용량은 무료 티어 수준 유지 | ~5% | 고정 Pro 비용만 허용 |
| **Google Cloud Run** | Free Tier | 180K vCPU-sec, 360K GB-sec, 2M 요청 | ~10% | ₩0 |
| **Google Cloud Tasks** | Free Tier | 1M billable operations/월 | <1% | ₩0 |
| **Google Cloud Build** | Free Tier | 2,500 build-min/월 (`e2-standard-2`) | ~5% | ₩0 |
| **Artifact Registry** | Free Tier | 0.5GB storage/월 | 감시 필요 | ₩0 |
| **Secret Manager** | Free Tier | 6 active versions, 10K access ops/월 | 감시 필요 | ₩0 |
| **Supabase** | Free | 500MB DB, 1GB 스토리지 | ~15% | ₩0 |
| **Upstash Redis** | Free | 500K commands/월, 256MB data | ~20% | ₩0 |
| **Langfuse** | Hobby | 50K 이벤트/월 | ~5% | ₩0 |
| **Sentry** | Free | 50K 이벤트/월 | ~3% | ₩0 |
| **LLM Providers** | Free Tier | 프로바이더별 상이 | 변동 | ₩0 |
| **합계** | | | | **Vercel Pro 제외 시 ₩0** |

Vercel은 현재 **유일한 유료 예외**로 Pro를 사용합니다. 다만 이는 성능/운영 완충을 위한 선택일 뿐이며, Pro 기능을 상시 전제로 설계해서는 안 됩니다. 정말 필요할 때만 사용하고, 기본 사용량은 무료 티어 수준에 머물러야 합니다. Free로 전환해도 핵심 경로는 유지되고, 악화가 허용되는 것은 응답 지연/빌드 여유/운영 편의성 정도로 제한합니다. 실환경 테스트와 배포 후에는 Vercel Usage 대시보드를 확인해 추가 비용 발생 징후가 없는지 점검합니다. QA/테스트 중 문제가 생겨 Pro 기능이나 한도를 더 쓰고 싶어질 때도, 먼저 Usage와 비용 영향을 확인한 다음에만 예외 확대를 검토합니다.

Reference (baseline links, re-verify before policy changes):
- https://vercel.com/pricing
- https://vercel.com/docs/limits/overview
- https://vercel.com/docs/limits/fair-use-guidelines
- https://cloud.google.com/free/docs/free-cloud-features
- https://cloud.google.com/run/pricing
- https://cloud.google.com/tasks/pricing
- https://upstash.com/docs/redis/overall/pricing

---

## Google Cloud Free Tier 회계 경계

Google Cloud는 하나의 "통합 무료 큐/런타임 크레딧"을 제공하는 방식이 아니라, **billing account 단위로 서비스별 Free Tier 한도와 할인**을 적용합니다. Cloud Run, Cloud Tasks, Cloud Build, Artifact Registry, Secret Manager는 각각 과금 단위가 다르지만 초과분은 같은 billing account에 합산 청구되므로, 운영 관점에서는 **GCP 월간 비용 예산**으로 함께 감시합니다.

| 서비스 | 무료 한도 적용 단위 | 이 프로젝트에서의 비용 해석 |
|--------|------------------|---------------------------|
| Cloud Run | 요청, vCPU-sec, GB-sec | Cloud Tasks가 worker를 호출하면 `/api/jobs/process` 요청과 실행 시간이 Cloud Run 사용량에 잡힙니다. |
| Cloud Tasks | API call 또는 push delivery attempt, 32KB chunk 단위 | 정상 job은 `CreateTask`와 push delivery가 각각 operation을 만듭니다. retry가 늘면 delivery attempt도 늘어납니다. |
| Cloud Build | build-minutes | `deploy.sh`는 custom machine type을 금지하고 기본 build path만 사용합니다. |
| Artifact Registry | image storage | Cloud Run 사용량이 무료여도 이미지 보관이 0.5GB를 넘으면 별도 과금될 수 있어 cleanup policy를 감시합니다. |
| Secret Manager | active secret versions, access operations | secret version을 불필요하게 늘리거나 잦은 수동 검증을 반복하면 별도 한도를 소모합니다. |

현재처럼 실사용자가 거의 없고 production QA를 최소화하면 Cloud Tasks 1M operations/월보다 Cloud Run CPU 시간, Upstash Redis command, LLM provider RPM/RPD가 먼저 병목이 될 가능성이 큽니다.

## Part 1: Cloud Run Free Tier 가드레일

### 무료 한도

```
Monthly Free:
- vCPU:    180,000 sec = 50시간 active time
- Memory:  360,000 GB-sec = 200시간 (512Mi 기준)
- Requests: 2,000,000
```

### 가드레일 구현 (`deploy.sh`)

`deploy.sh`에 **하드코딩된 제한값**이 있으며, 이 값을 변경하면 배포가 차단됩니다:

```bash
# Non-negotiable free-tier limits
FREE_TIER_MIN_INSTANCES="0"      # 항상 scale-to-zero
FREE_TIER_MAX_INSTANCES="1"      # 최대 1개 인스턴스
FREE_TIER_CONCURRENCY="16"       # 동시 요청 16
FREE_TIER_CPU="1"                # 1 vCPU
FREE_TIER_MEMORY="512Mi"         # 512MB
FREE_TIER_TIMEOUT="300"          # 5분 타임아웃
```

### 3단계 검증

```
1. deploy.sh 변수 검증
   ├── MIN_INSTANCES == 0?
   ├── MAX_INSTANCES == 1?
   ├── CPU == 1?
   └── MEMORY == 512Mi?

2. cloudbuild.yaml 정합성 검증
   ├── --min-instances == 0?
   ├── --max-instances == 1?
   ├── --concurrency == 16?
   └── --memory == 512Mi?

3. 금지 옵션 검사
   └── --machine-type, e2-highcpu-8, n1-highcpu-8 포함 시 → ❌ 즉시 차단
```

`FREE_TIER_GUARD_ONLY=true`로 실행하면 검증만 수행하고 배포는 건너뜁니다:
```bash
FREE_TIER_GUARD_ONLY=true bash deploy.sh  # CI에서 가드레일만 검증
```

### Cloud Run 비용 최적화 플래그

| 플래그 | 효과 |
|--------|------|
| `--cpu-throttling` | 요청 처리 중에만 CPU 과금 (유휴 시 무과금) |
| `--no-session-affinity` | 인스턴스 고정 방지 → scale-to-zero 촉진 |
| `--cpu-boost` | Cold start 시 CPU 2배 할당 (과금 없음) |
| `--min-instances 0` | 트래픽 없을 때 인스턴스 0으로 축소 |

### Cloud Build 비용 최적화

| 항목 | 설정 | 이유 |
|------|------|------|
| 머신 타입 | 기본값 (`machineType` 미지정) | 공식 Free Tier는 `e2-standard-2` 2,500 build-min/월 기준이며, `e2-highcpu-8` 같은 custom machine은 금지 |
| 빌드 타임아웃 | `deploy.sh` 600초 | 불필요한 빌드 시간 방지 |
| 이미지 정리 | 최신 3개 유지 | Artifact Registry 스토리지 절약 |
| 소스 정리 | 최신 10개만 유지 | Cloud Storage 절약 |
| 리비전 정리 | 최신 3개만 유지 | 오래된 revision 자동 삭제 |

### Async Job Queue 비용 상한 감각

Cloud Tasks 자체는 월 첫 1M billable operations가 무료라 현재 트래픽 규모에서는 병목 가능성이 낮습니다. 실제 비용 압력은 Cloud Tasks가 전달한 worker 요청이 Cloud Run에서 얼마나 오래 실행되는지에 따라 결정됩니다.

| 평균 job 실행 시간 | Cloud Run CPU 무료분 기준 월 처리 여유 |
|------------------|------------------------------------|
| 300초 | 약 600 jobs |
| 60초 | 약 3,000 jobs |
| 30초 | 약 6,000 jobs |

위 계산은 1 vCPU active time `180,000 vCPU-sec/월`만 단순 나눈 값입니다. 실제 운영에서는 retry, cold start, health/smoke 요청, LLM provider quota, Redis SSE polling command를 함께 차감합니다. 현재 production queue guard는 `max-dispatches-per-second=1`, `max-concurrent-dispatches=2`, `max-attempts=3`으로 보수화되어 있습니다.

---

## Part 2: Supabase Free Tier 보호

### Keep-Alive 메커니즘

Supabase 무료 티어는 **1주일 미사용 시 자동 일시 정지**.

```yaml
# .github/workflows/keep-alive.yml
schedule:
  - cron: '0 0 * * 0,3'  # 수/일 09:00 KST
```

- REST API ping → HTTP 200 확인
- Vercel `/api/health` 동시 확인

### 데이터베이스 용량 관리

| 테이블 | 용도 | 크기 | 관리 |
|--------|------|------|------|
| `ai_feedback` | AI 피드백 저장 | ~1MB | 자동 증가 |
| `incident_reports` | 장애 보고서 | ~2MB | 승인 기반 |
| `server_logs` | 서버 로그 | ~5MB | TTL 정리 |
| `knowledge_base` | RAG 벡터 (pgvector) | ~10MB | 주기적 백필 |

---

## Part 3: Upstash Redis 최적화

### 무료 한도

- 월 500,000 commands
- 256MB 데이터

### Job Queue 상태 저장 경계

현재 async Job Queue는 **Redis와 Cloud Tasks를 함께 사용**합니다. Redis는 queue worker가 아니라 상태 저장소이며, Cloud Tasks가 실제 worker HTTP delivery를 담당합니다.

| 계층 | 역할 | 비용/한도 관점 |
|------|------|---------------|
| Upstash Redis | `job:{id}`, `job:progress:{id}`, 최종 result/error, SSE polling source | job 생성/진행률 갱신/폴링마다 Redis command 사용 |
| Cloud Tasks | `/api/jobs/process` HTTP task delivery, retry, dispatch/concurrency guard | 32KB 단위 billable operation, 월 첫 1M operations 무료 |
| Cloud Run | 실제 AI worker 실행 | 1 vCPU/512Mi/timeout 300s free-tier guard 유지 |

Redis 장애 시 async Job Queue는 결과를 보존할 수 없으므로 fail-fast합니다. Cloud Tasks만으로는 브라우저가 최종 답변을 읽을 source of truth가 생기지 않습니다.

### Stream 저장/재개 비용 경고

Streaming resume chunk 저장은 `AI_RESUMABLE_STREAMS_ENABLED=true`일 때만 활성화됩니다. 기본값은 비활성이라 일반 streaming 응답은 Redis chunk 저장 비용을 만들지 않습니다. 단, async Job Queue 경로는 별도이며 job 상태/진행률/결과 저장을 위해 Redis를 계속 사용합니다.

| 경로 | Redis 동작 |
|------|-----------|
| resumable 스트림 시작 (`AI_RESUMABLE_STREAMS_ENABLED=true`) | session `SET` + meta `SET` + chunk마다 `RPUSH`/`EXPIRE` |
| 재개 조회 | session `GET` + meta `GET` + `LRANGE` (반복 가능) |
| 종료/정리 | session `DEL` + data/meta `DEL` |
| async Job Queue | job `SET`, progress `SET`, SSE stream `MGET` polling |

> **포트폴리오 제약**: 명령 수는 청크 수와 resume/cleanup 경로에 따라 달라집니다. 응답 청크 증가, 재시도 확대, 재개 polling 증가는 모두 Redis 사용량 증가로 직결됩니다.
> 동시 사용자가 늘어나면 500K commands/월 한도가 빠르게 병목이 될 수 있습니다.

### Pipeline 배칭

Circuit Breaker 상태 저장 시 개별 호출 대신 Pipeline으로 묶어 커맨드 수를 절약:

```typescript
// ❌ Bad: 3 커맨드
await redis.hset(key, data);
await redis.expire(key, ttl);
await redis.hgetall(key);

// ✅ Good: 1 Pipeline = 1 커맨드로 집계
const pipeline = redis.pipeline();
pipeline.hset(key, data);
pipeline.expire(key, ttl);
await pipeline.exec();
```

### Redis 장애 시 Graceful Degradation

| 기능 | Redis 정상 | Redis 장애 |
|------|----------|----------|
| Circuit Breaker | 분산 상태 (인스턴스 간 공유) | InMemory 폴백 (인스턴스 독립) |
| Job Queue | Redis 상태/결과 저장 + Cloud Tasks worker delivery | job 생성/조회 503, Cloud Tasks 단독 복구 불가 |
| Stream 재개 | 세션/청크 Redis 저장 | 신규 세션으로 시작 |
| AI Cache | Redis L2 캐시 | Memory LRU만 사용 |

---

## Part 4: Langfuse Free Tier 보호

### 자동 보호 시스템

코드에 자동 쿼터 보호 로직이 구현되어 있습니다:

| 사용률 | 동작 |
|--------|------|
| < 70% (35,000) | ✅ 정상 운영 |
| 70% | ⚠️ 콘솔 경고 로그 |
| 80% | ⚠️ 콘솔 경고 로그 |
| 90% (45,000) | 🛑 **자동 비활성화** — 이벤트 전송 중단 |
| 월 변경 시 | 🔄 카운터 자동 리셋 |

- 카운터: Redis에 영속화 (컨테이너 재시작 시 복원)
- Redis 실패 시: 인메모리 카운터로 폴백
- 프로덕션 기본 샘플링: 10% (`LANGFUSE_SAMPLE_RATE`)

---

## Part 5: LLM 프로바이더 비용 제어

### ⚠️ 핵심 제약: AI 성능 강화 ≠ 스펙 업

> **이 프로젝트의 포트폴리오 제약**:
> AI 응답 품질 향상 = 에이전트 추가 호출 = API 요청 수 증가 = 무료 티어 소진 가속.
> 성능 개선은 반드시 **캐싱 강화, 응답 재사용, 라우팅 최적화** 방향으로만 진행해야 합니다.
> LLM 모델 업그레이드, 에이전트 추가 호출, 병렬 실행 확대는 모두 **무료 한도 영향 검토 후** 결정합니다.

### 프로바이더별 무료 한도 (SSOT)

| 프로바이더 | RPM | TPM | RPD | TPD | 실제 병목 |
|-----------|----:|----:|----:|----:|---------|
| **Groq** (Llama 4 Scout) | 30 | 500,000 | 1,000 | — | RPD (일 1K 소진 빠름) |
| **Cerebras Llama 3.1-8b** | 30 | 60,000 | 14,400 | 1,000,000 | 8K context 제약 |
| **Cerebras Qwen 235B Preview** | 5 | 30,000 | 14,400 | 1,000,000 | runtime 제외(Preview/high traffic) |
| **Mistral** (large-latest) | 2 | 30,000 | ~500 | — | RPM·RPD 모두 극도로 낮음 |
| **Gemini Flash-Lite** | 15 | 250,000 | 1,000 | — | RPD (Vision 전용) |
| **OpenRouter Free** | — | — | — | — | 응답 느림, Vision fallback |

> 수치는 2026-04-30 기준 확인치. 공급사 정책이 수시 변경되므로 모델 전략 변경 전 재확인 필수.
> 런타임 SSOT: `quota-tracker.ts` `PROVIDER_QUOTAS` 상수.

### Agent별 Provider 순서 (SSOT)

| Agent | 1st | 2nd | 3rd | 비고 |
|-------|-----|-----|-----|------|
| **Supervisor** (single) | Groq | Cerebras | Mistral | 단순 쿼리 1 LLM 호출 |
| **Orchestrator** | Groq | Cerebras | Mistral | 라우팅 JSON만 생성 — Groq-first로 Cerebras RPM 절약 |
| **NLQ Agent** | Groq | Cerebras | Mistral | 16K+ context 요구 |
| **Analyst Agent** | Cerebras | Groq | Mistral | 32K+ context 요구 |
| **Reporter Agent** | Cerebras | Groq | Mistral | 32K+ context 요구 |
| **Advisor Agent** | Cerebras | Groq | Mistral | 32K+ context 요구 |
| **Vision Agent** | Gemini | OpenRouter | — | 이미지/스크린샷 전용 |

> SSOT: `agent-runtime-policy.ts` → `AGENT_RUNTIME_POLICIES` / `ORCHESTRATOR_RUNTIME_POLICY`

**Orchestrator Groq-first 이유 (v8.11.65)**:
멀티 에이전트 쿼리 시 Orchestrator(라우팅) + Analyst/Reporter/Advisor(실행)가 연속으로 동일 provider를 사용하면 Cerebras RPM 5회/분 한도를 한 쿼리에서 2회 소비합니다. Orchestrator는 짧은 JSON 라우팅만 생성하므로 Groq-first로 전환해 Cerebras RPM 소비를 쿼리당 1회로 줄입니다.

### 모델 ID 환경변수 (즉시 교체 가능)

| 환경변수 | 기본값 | 대상 Provider |
|---------|-------|--------------|
| `CEREBRAS_MODEL_ID` | `llama3.1-8b` | Cerebras production runtime |
| `GROQ_MODEL_ID` | `meta-llama/llama-4-scout-17b-16e-instruct` | Groq |
| `MISTRAL_MODEL_ID` | `mistral-large-latest` | Mistral |
| `GEMINI_VISION_MODEL_ID` | `gemini-2.5-flash-lite` | Gemini Vision |

> 코드 수정 없이 환경변수만 변경하면 모델이 즉시 교체됩니다. 2026-04-30 기준 현재 계정에서 `gpt-oss-120b`는 목록에는 보이나 chat completions 404라 runtime 제외, `llama3.1-8b`만 production smoke가 통과했습니다.

### RPM 자동 대응 (Quota Admission Gate)

```
LLM 호출 전: reserveProviderQuota(provider, estimatedTokens)
  → Redis EVAL atomic: cooldown 확인 → RPM/RPD 85% 임계 도달 시 예약 거부
  → 예약 거부 → 다음 provider로 즉시 전환 (실제 429 없음)
  → Redis 불가: in-memory fallback (withUsageLock 직렬화)

LLM 호출 후: reconcileProviderQuotaReservation(reservation, actualTokens)
  → 실제 사용량으로 예약 보정
```

차단 임계값: 일일 토큰 80%, 일일/분당 요청 85%, 분당 토큰 85%.

> **개발 환경 AI (Claude/Codex/Gemini CLI)는 별개 예산** — 개발자 구독 선납 비용이며 위 표와 무관합니다.

---

## Part 6: 성능 최적화

### Universal Vitals 시스템

Web Vitals 방법론을 **모든 테스트 영역으로 확장**한 자체 시스템 (`src/lib/testing/universal-vitals.ts`).

| 카테고리 | 메트릭 | Good | Poor |
|----------|--------|------|------|
| **Web Performance** | LCP | ≤2500ms | >4000ms |
| | FID | ≤100ms | >300ms |
| | CLS | ≤0.1 | >0.25 |
| | TTFB | ≤800ms | >1800ms |
| | INP | ≤200ms | >500ms |
| **API Performance** | response-time | ≤100ms | >1000ms |
| | cold-start | ≤500ms | >3000ms |
| | p99 | ≤500ms | >2000ms |
| | error-rate | ≤0.1% | >1% |
| **Build Performance** | build-time | ≤30s | >120s |
| | bundle-size | ≤200KB | >500KB |
| | type-check-time | ≤10s | >30s |
| | tree-shaking | ≥90% | <70% |
| **Database** | query-time | ≤10ms | >100ms |
| | connection-time | ≤50ms | >200ms |
| **Reliability** | uptime | ≥99.9% | <99% |
| | MTTR | ≤300s | >1800s |

### Vercel Edge 캐시 전략

SWR (Stale-While-Revalidate) 프리셋을 API 응답에 적용:

```typescript
// 대시보드 API
headers.set('Cache-Control', 'public, s-maxage=300, stale-while-revalidate=600');

// 실시간 API
headers.set('Cache-Control', 'public, s-maxage=30, stale-while-revalidate=60');

// 인증된 API (캐시 금지)
headers.set('Cache-Control', 'private, no-store');
```

### Next.js 빌드 최적화

| 설정 | 값 | 효과 |
|------|-----|------|
| `SKIP_ENV_VALIDATION` | `true` | 환경변수 없이도 빌드 성공 |
| `NEXT_TELEMETRY_DISABLED` | `1` | 불필요한 텔레메트리 비활성 |
| `experimental.optimizeCss` | `true` | CSS 최적화 |
| Dynamic imports | 적극 활용 | 초기 번들 크기 감소 |

---

## Part 7: GitHub Actions 비용 제어

### 현재 정책

| 항목 | 설정 | 이유 |
|------|------|------|
| 리포지토리 | Public | Public = 무제한 Actions 분 |
| Simple Deploy | 비활성화 | Vercel이 빌드하므로 중복 방지 |
| 동시성 제어 | `cancel-in-progress: true` | 같은 브랜치 이전 실행 자동 취소 |
| docs 변경 | CI 스킵 | `paths-ignore: docs/**` |
| `[skip ci]` | 지원 | 문서/설정 변경 시 CI 완전 스킵 |

### Private 전환 대비

Public → Private 전환 시 Actions 분 제한(2,000분/월)이 적용됩니다. 이를 대비해:
- Simple Deploy는 이미 `workflow_dispatch` (수동)으로 전환 완료
- Quality Gates는 주 1회 스케줄로 제한
- CI Core Gates는 `cancel-in-progress`로 중복 실행 방지

---

## 관련 문서

- [CI/CD 파이프라인](../../../development/ci-cd.md) - GitHub Actions 워크플로우 상세
- [Docker 가이드](../../../development/docker.md) - Cloud Run 컨테이너 설정
- [Observability 가이드](../../../guides/observability.md) - Langfuse/Sentry 비용 관리
- [복원력 아키텍처](./resilience.md) - 장애 대응 패턴

_Last Updated: 2026-04-30_
