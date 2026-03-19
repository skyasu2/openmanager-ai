# Free Tier 최적화 & 성능 전략

> 무료 티어 가드레일, 비용 최적화, Web Vitals 성능 전략 레퍼런스
> Owner: platform-architecture
> Status: Active
> Doc type: Reference
> Last reviewed: 2026-02-20
> Canonical: docs/reference/architecture/infrastructure/free-tier-optimization.md
> Tags: free-tier,cost,performance,web-vitals,optimization
>
> **프로젝트 버전**: v8.0.0 | **Updated**: 2026-02-20

## 개요

이 프로젝트는 실 서비스 배포 기준 **`Vercel Pro` 고정비를 제외한 가변 운영 비용 ₩0**를 목표로 설계되었습니다. `Vercel`은 **유일한 유료 예외**이지만, Pro 기능은 꼭 필요할 때만 제한적으로 사용하고, 기본 설계와 운영 사용량은 **무료 티어 수준**을 유지해야 합니다. Free로 전환해도 핵심 서비스 경로가 깨지지 않아야 하며, 나머지 인프라는 무료 티어 내에서 동작하도록 **가드레일이 코드 수준에서 강제**됩니다.

> **⚠️ [주의: 코딩용 AI 등 개발 환경 비용 제외]**
> ₩0 운영 비용 원칙은 오직 배포되어 스탠드얼론으로 동작하는 서비스(Vercel, Cloud Run, 무료 LLM API 등)에만 해당됩니다. 코드를 기획/작성하는 과정에서 개발자가 별도로 지출하는 AI 코딩 에디터(Cursor, Claude Code 등)의 유료 비용은 본 문서의 `₩0 설계 제약`과 무관하므로, 추후 문서를 참조할 때 혼동하지 않도록 분리하여 인지해야 합니다.

### 인프라 비용 요약

| 서비스 | 플랜 | 월 제한 | 현재 사용 | 비용 |
|--------|------|---------|----------|------|
| **Vercel** | Pro (예외) | 꼭 필요한 기능만 사용, 기본 사용량은 무료 티어 수준 유지 | ~5% | 고정 Pro 비용만 허용 |
| **Google Cloud Run** | Free Tier | 180K vCPU-sec, 2M 요청 | ~10% | ₩0 |
| **Google Cloud Build** | Free Tier | 120분/일 (e2-medium) | ~5% | ₩0 |
| **Supabase** | Free | 500MB DB, 1GB 스토리지 | ~15% | ₩0 |
| **Upstash Redis** | Free | 10K 커맨드/일 | ~20% | ₩0 |
| **Langfuse** | Hobby | 50K 이벤트/월 | ~5% | ₩0 |
| **Sentry** | Free | 50K 이벤트/월 | ~3% | ₩0 |
| **LLM Providers** | Free Tier | 프로바이더별 상이 | 변동 | ₩0 |
| **합계** | | | | **Vercel Pro 제외 시 ₩0** |

Vercel은 현재 **유일한 유료 예외**로 Pro를 사용합니다. 다만 이는 성능/운영 완충을 위한 선택일 뿐이며, Pro 기능을 상시 전제로 설계해서는 안 됩니다. 정말 필요할 때만 사용하고, 기본 사용량은 무료 티어 수준에 머물러야 합니다. Free로 전환해도 핵심 경로는 유지되고, 악화가 허용되는 것은 응답 지연/빌드 여유/운영 편의성 정도로 제한합니다. 실환경 테스트와 배포 후에는 Vercel Usage 대시보드를 확인해 추가 비용 발생 징후가 없는지 점검합니다. QA/테스트 중 문제가 생겨 Pro 기능이나 한도를 더 쓰고 싶어질 때도, 먼저 Usage와 비용 영향을 확인한 다음에만 예외 확대를 검토합니다.

Reference (checked: 2026-02-20):
- https://vercel.com/pricing
- https://vercel.com/docs/limits/overview
- https://vercel.com/docs/limits/fair-use-guidelines

---

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
FREE_TIER_CONCURRENCY="80"       # 동시 요청 80
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
   ├── --concurrency == 80?
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
| 머신 타입 | 기본값 (e2-medium) | 무료: 120분/일, `e2-highcpu-8`은 무료 대상 아님 |
| 빌드 타임아웃 | 600초 | 불필요한 빌드 시간 방지 |
| 이미지 정리 | 최신 2개만 유지 | Artifact Registry 스토리지 절약 |
| 소스 정리 | 최신 10개만 유지 | Cloud Storage 절약 |
| 리비전 정리 | 최신 3개만 유지 | 오래된 revision 자동 삭제 |

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

- 일일 10,000 커맨드
- 256MB 데이터

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
| Job Queue | Redis 저장/조회 | 에러 응답 반환 |
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

### 무료 티어 프로바이더 체인

| 우선순위 | 프로바이더 | 무료 한도 | 제한 |
|---------|-----------|---------|------|
| 1 | Cerebras | 추론 무료 | Rate limit 있음 |
| 2 | Groq | 월 14,400 요청 | 분당 30 요청 |
| 3 | Mistral | 월 $5 크레딧 | 모델별 상이 |
| Vision 1 | Google Gemini | 일 1,500 요청 | 분당 15 요청 |
| Vision 2 | OpenRouter Free | 무제한 (무료 모델) | 느린 응답 |

### Rate Limit 자동 대응

```
429 Too Many Requests (Cerebras)
  → 자동 전환: Groq
    → 429 (Groq)
      → 자동 전환: Mistral
```

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

_Last Updated: 2026-02-15_
