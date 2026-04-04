# Observability 가이드 (Langfuse + Sentry)

> LLM 트레이싱(Langfuse)과 에러 모니터링(Sentry) 설정, 점검, 트러블슈팅
> Owner: documentation
> Status: Active
> Doc type: How-to
> Last reviewed: 2026-04-04
> Canonical: docs/guides/observability.md
> Tags: observability,langfuse,sentry,monitoring

## 개요

이 프로젝트는 두 가지 Observability 도구를 사용합니다:

| 도구 | 용도 | 적용 범위 | 플랜 |
|------|------|----------|------|
| **Langfuse** | LLM 호출 트레이싱, 토큰 사용량, 피드백 | Cloud Run AI Engine | Hobby (무료, 50K events/월) |
| **Sentry** | 런타임 에러 캡처, 성능 모니터링 | Vercel Frontend (+ Cloud Run) | Free (50K events/월) |

```
┌──────────────────────────────────────────────────────┐
│  사용자 브라우저                                       │
│  ├─ Sentry Client SDK → /api/sentry-tunnel → Sentry │
│  └─ AI 채팅 요청                                      │
│       ↓                                              │
│  Vercel (Next.js)                                    │
│  ├─ Sentry Server SDK → Sentry (에러/성능)            │
│  └─ X-Trace-Id 헤더 → Cloud Run                      │
│       ↓                                              │
│  Cloud Run (AI Engine)                               │
│  ├─ Langfuse SDK → Langfuse (LLM 트레이싱)            │
│  └─ 피드백 → Langfuse Score                           │
└──────────────────────────────────────────────────────┘
```

---

## Part 1: Langfuse (LLM 트레이싱)

### 1.1 Langfuse란?

오픈소스 LLM Observability 플랫폼. AI Engine의 모든 LLM 호출을 추적합니다:
- **Traces**: Supervisor 실행 단위 (질문 → 답변 전체 흐름)
- **Generations**: 개별 LLM 호출 (모델, 토큰, 지연시간)
- **Spans**: 도구 호출 (tool 실행 시간)
- **Scores**: 사용자 피드백 (좋아요/싫어요) + 실행 성공 여부

### 1.2 계정 설정

1. [langfuse.com](https://langfuse.com) 가입 (GitHub OAuth 지원)
2. 새 프로젝트 생성
3. Settings → API Keys에서 키 발급:
   - **Secret Key**: `sk-lf-...`
   - **Public Key**: `pk-lf-...`

### 1.3 환경변수

```bash
# cloud-run/ai-engine/.env (로컬 개발)
LANGFUSE_SECRET_KEY=sk-lf-xxxxx
LANGFUSE_PUBLIC_KEY=pk-lf-xxxxx
LANGFUSE_BASE_URL=https://us.cloud.langfuse.com   # US 리전 (기본값)

# GCP Secret Manager (프로덕션)
# LANGFUSE_CONFIG secret에 JSON으로 저장됨
# deploy.sh가 자동으로 주입
```

### 1.4 점검 방법

#### 방법 1: `/monitoring` 엔드포인트 (사용량 상태)

```bash
# 로컬
curl http://localhost:8080/monitoring

# 프로덕션 (인증 필요)
curl -H "X-API-Key: $CLOUD_RUN_API_SECRET" \
  https://ai-engine-xxx.run.app/monitoring
```

응답 예시:
```json
{
  "status": "ok",
  "langfuse": {
    "eventCount": 1234,
    "limit": 50000,
    "usagePercent": 2,
    "isDisabled": false,
    "monthKey": "2026-02",
    "testMode": false,
    "sampleRate": "10%"
  },
  "circuits": { ... },
  "agents": { ... }
}
```

점검 포인트:
- `isDisabled: false` → 정상 (true면 쿼터 90% 초과로 자동 차단됨)
- `usagePercent` < 70 → 안전 (70%/80%에서 로그 경고 발생)
- `eventCount` → 이번 달 누적 이벤트 수

#### 방법 2: `/monitoring/traces` 엔드포인트 (최근 트레이스)

```bash
# 프로덕션
curl -H "X-API-Key: $CLOUD_RUN_API_SECRET" \
  https://ai-engine-xxx.run.app/monitoring/traces
```

응답 예시:
```json
{
  "status": "ok",
  "count": 10,
  "traces": [
    {
      "id": "trace-abc123",
      "name": "supervisor-execution",
      "sessionId": "sess-456",
      "inputPreview": "서버 상태 요약해줘...",
      "outputPreview": "현재 15대 서버 중...",
      "createdAt": "2026-02-13T10:00:00Z"
    }
  ],
  "dashboardUrl": "https://us.cloud.langfuse.com/project"
}
```

#### 방법 3: Langfuse 대시보드 (웹 UI)

1. [us.cloud.langfuse.com](https://us.cloud.langfuse.com) 로그인
2. 프로젝트 선택
3. **Traces** 탭: 전체 실행 흐름 확인
4. **Generations** 탭: LLM 호출 상세 (모델, 토큰, 비용)
5. **Scores** 탭: 사용자 피드백 + supervisor mode audit 통계
6. **Dashboard** 탭: 사용량 요약, 비용 추이

### 1.5 Free Tier 보호 시스템

코드에 자동 보호 로직이 구현되어 있습니다:

| 사용률 | 동작 |
|--------|------|
| < 70% | 정상 운영 |
| 70% (35,000) | 콘솔 경고 로그 |
| 80% (40,000) | 콘솔 경고 로그 |
| 90% (45,000) | **자동 비활성화** — 이벤트 전송 중단 |
| 월 변경 시 | 카운터 자동 리셋 |

- 카운터는 Redis에 영속화 (컨테이너 재시작 시 복원)
- Redis 실패 시 인메모리 카운터로 폴백

### 1.6 추적되는 항목

| 유형 | 이름 | 내용 |
|------|------|------|
| **Trace** | `supervisor-execution` | AI 질문→답변 전체 흐름 |
| **Generation** | `{provider}/{model}` | LLM 호출 (입력, 출력, 토큰) |
| **Span** | `tool:{toolName}` | 도구 호출 (입력, 출력, 소요시간) |
| **Event** | `agent-handoff` | 에이전트 간 핸드오프 |
| **Score** | `user-feedback` | 사용자 좋아요(1)/싫어요(0) |
| **Score** | `execution-success` | 실행 성공(1)/실패(0) |
| **Score** | `timeout-occurred` | 타임아웃 여부 |
| **Score** | `requested-mode-*` | 요청 모드 (`single` / `multi` / `auto`) |
| **Score** | `resolved-mode-*` | 실제 실행 모드 (`single` / `multi`) |
| **Score** | `mode-source-*` | 모드 결정 이유 (`explicit`, `auto_complexity`, `auto_default`, `single_disallowed_upgrade`) |
| **Score** | `auto-resolved-*` | `auto` 요청이 실제로 어디로 수렴했는지 |
| **Score** | `complexity-selected-*` | 복잡도 휴리스틱이 고른 실행 모드 |

### 1.7 Supervisor Mode Audit 해석법

`supervisor-execution` trace는 mode audit metadata와 함께 score도 남깁니다. 운영에서는 아래 score 조합을 먼저 봅니다.

| Score | 의미 | 운영 해석 |
|------|------|----------|
| `requested-mode-auto` | 기본 요청이 `auto`로 들어옴 | 일반 사용자 트래픽 기준선 |
| `resolved-mode-single` | 실제 단일 경로 실행 | free-tier 친화 요청 비율 |
| `resolved-mode-multi` | 실제 멀티 경로 실행 | 고비용/고정밀 요청 비율 |
| `mode-source-auto_complexity` | 복잡도 휴리스틱으로 결정 | 정상 auto 라우팅 |
| `mode-source-single_disallowed_upgrade` | explicit `single` 요청이 정책상 `multi`로 승격됨 | 정책 충돌 또는 클라이언트 오용 신호 |
| `auto-resolved-single` | `auto` 요청이 최종적으로 `single` 실행 | 저복잡도 질의 비율 |
| `auto-resolved-multi` | `auto` 요청이 최종적으로 `multi` 실행 | 복합/전문 질의 비율 |
| `complexity-selected-single` | 휴리스틱이 `single`을 선택 | cheap path 선택량 |
| `complexity-selected-multi` | 휴리스틱이 `multi`를 선택 | specialist path 선택량 |

권장 확인 순서:

1. `requested-mode-auto` 대비 `auto-resolved-single` / `auto-resolved-multi` 비율을 본다.
2. `resolved-mode-multi`가 급증했으면 같은 시간대의 `mode-source-*`와 `agent-handoff`를 같이 본다.
3. `mode-source-single_disallowed_upgrade`가 반복되면 클라이언트가 explicit `single`을 계속 보내고 있는지 점검한다.
4. `resolved-mode-multi`는 높은데 `agent-handoff`가 낮으면 pre-filter specialist path가 많이 타는 상태로 해석한다.

이상 징후 예시:

- `requested-mode-auto`는 안정적인데 `resolved-mode-multi`만 급증: 복잡도 휴리스틱 drift 또는 질의 성격 변화 가능성
- `mode-source-single_disallowed_upgrade` 증가: 클라이언트 계약 위반 또는 legacy caller 존재 가능성
- `complexity-selected-multi` 증가와 함께 `timeout-occurred` 증가: multi path 비용/지연 재점검 필요

### 1.8 Langfuse Dashboard 추천 구성

Langfuse 공식 문서 기준으로 metrics는 custom dashboard와 metrics API에서 공통으로 집계할 수 있고, 최근 v4 기준에서는 고카디널리티 차원(`traceId`, `sessionId`, 일부 `userId`) 그룹핑에 top-N 제한이 생겼습니다. OpenManager의 mode audit은 이 제약을 피하도록 score 이름 중심으로 보는 것이 가장 안정적입니다.

권장 운영 규칙:

1. trace 범위는 먼저 `name = supervisor-execution`으로 좁힌다.
2. mode audit은 trace/session 단위 drill-down보다 score 집계부터 본다.
3. 고카디널리티 차원(`traceId`, `sessionId`, `userId`) 그룹핑은 기본 대시보드에서 피하고, 꼭 필요하면 top-N으로 제한한다.
4. 환경별 비교가 필요하면 score filter를 직접 건다. Langfuse v4에서는 score의 environment filter가 더 엄격하게 적용된다.

추천 대시보드 위젯:

| 위젯 이름 | 기준 score | 시간 범위 | 해석 |
|----------|-------------|-----------|------|
| **Mode Mix 24h** | `resolved-mode-single`, `resolved-mode-multi` | 최근 24시간 | 실제 실행 모드 비율 확인 |
| **Auto Resolution 24h** | `requested-mode-auto`, `auto-resolved-single`, `auto-resolved-multi` | 최근 24시간 | auto 요청이 single/multi 어디로 수렴하는지 확인 |
| **Policy Collision 7d** | `mode-source-single_disallowed_upgrade` | 최근 7일 | explicit `single` 호출이 정책과 충돌하는지 확인 |
| **Complexity Drift 7d** | `complexity-selected-single`, `complexity-selected-multi` | 최근 7일 | 휴리스틱이 어느 방향으로 이동하는지 확인 |
| **Multi Risk Overlay 24h** | `resolved-mode-multi`, `timeout-occurred` | 최근 24시간 | multi 증가와 지연/타임아웃 동반 여부 확인 |

운영 순서:

1. **Scores 탭**에서 `resolved-mode-multi`와 `mode-source-single_disallowed_upgrade`를 먼저 확인한다.
2. 이상 징후가 있으면 **Traces 탭**에서 `name = supervisor-execution`으로 drill-down 한다.
3. multi 증가 원인을 볼 때는 같은 시간대의 `agent-handoff`, generation latency, provider 분포를 같이 본다.
4. 장기 추세는 **Custom Dashboard**에 위 5개 위젯만 올리고, 나머지는 ad-hoc 분석으로 남긴다.

OpenManager 권장 baseline:

- `resolved-mode-single`가 `auto` 요청의 다수를 유지해야 free-tier 친화적이다.
- `mode-source-single_disallowed_upgrade`는 지속적으로 0 또는 근접한 값이어야 한다.
- `resolved-mode-multi`가 상승할 때 `timeout-occurred`가 같이 오르면 휴리스틱 또는 provider fallback 재점검이 필요하다.

---

## Part 2: Sentry (에러 모니터링)

### 2.1 아키텍처

```
브라우저 에러 → Sentry Client SDK
                  ↓
              /api/sentry-tunnel (애드블록 우회 프록시)
                  ↓
              Sentry EU (ingest.de.sentry.io)
                  ↑
              Sentry Server SDK ← 서버 에러
```

- **Organization**: `om-4g`
- **Project**: `javascript-nextjs`
- **Region**: EU (DE)
- **SDK**: `@sentry/nextjs` v10.37

### 2.2 환경변수

```bash
# .env.local (Vercel Frontend)
SENTRY_DSN=https://xxx@xxx.ingest.de.sentry.io/xxx
NEXT_PUBLIC_SENTRY_DSN=https://xxx@xxx.ingest.de.sentry.io/xxx  # 클라이언트용

# 선택 (소스맵 업로드, 현재 비활성)
SENTRY_AUTH_TOKEN=sntrys_xxx
SENTRY_ORG=om-4g
SENTRY_PROJECT=javascript-nextjs
```

> DSN이 설정되지 않으면 `instrumentation.ts`의 fallback DSN이 사용됩니다.

### 2.3 점검 방법

#### 방법 1: 상태 확인 API

```bash
# 로컬 (개발 환경 — Sentry 비활성 상태 확인)
curl http://localhost:3000/api/debug/sentry-test?action=info

# 프로덕션 (인증 필요)
curl -H "x-api-key: $TEST_API_KEY" \
  https://openmanager-vibe-v5-skyasus-projects.vercel.app/api/debug/sentry-test?action=info
```

응답 예시:
```json
{
  "status": "ok",
  "sentry": {
    "enabled": true,
    "dsn": "configured",
    "dsnSource": "env",
    "environment": "production",
    "clientInitialized": true,
    "sdkEnabled": true,
    "sdkDsn": "set"
  }
}
```

점검 포인트:
- `enabled: true` → 프로덕션에서 활성 (개발 환경은 항상 false)
- `dsn: "configured"` → DSN 설정됨
- `clientInitialized: true` → SDK 초기화 완료

#### 방법 2: 테스트 에러 전송

```bash
# 테스트 에러 발생 → Sentry에 캡처되는지 확인
curl -H "x-api-key: $TEST_API_KEY" \
  "https://...vercel.app/api/debug/sentry-test?action=error"
# → {"status":"error_sent","message":"Test error captured and sent to Sentry"}

# 테스트 메시지 전송
curl -H "x-api-key: $TEST_API_KEY" \
  "https://...vercel.app/api/debug/sentry-test?action=message"
# → {"status":"message_sent","message":"Test message sent to Sentry"}
```

전송 후 [sentry.io](https://sentry.io) 대시보드에서 이벤트 확인.

#### 방법 3: Sentry 대시보드 (웹 UI)

1. [sentry.io](https://sentry.io) 로그인
2. Organization: `om-4g` → Project: `javascript-nextjs`
3. **Issues** 탭: 에러 목록 (그룹화됨)
4. **Performance** 탭: API 응답시간, 트랜잭션 추적
5. **Stats** 탭: 이벤트 사용량, 쿼터 확인

### 2.4 Free Tier 최적화 설정

| 설정 | 값 | 이유 |
|------|-----|------|
| `tracesSampleRate` | 0.3 (30%) | 월 10K 트랜잭션 제한, ~70% 사용 |
| `replaysSessionSampleRate` | 0 | Replay 비활성화 (이벤트 절약) |
| `replaysOnErrorSampleRate` | 0 | Replay 비활성화 |
| `sourcemaps.disable` | true | 소스맵 업로드 비활성화 |
| `enabled` | production only | 개발/테스트 환경에서 이벤트 미전송 |

### 2.5 에러 캡처 지점

| 위치 | 파일 | 캡처 방식 |
|------|------|----------|
| 글로벌 에러 바운더리 | `src/app/error.tsx` | `Sentry.captureException()` + 컴포넌트 태그 |
| Server/Edge 요청 에러 | `instrumentation.ts` | `onRequestError()` 자동 캡처 |
| AI Supervisor 에러 | `src/app/api/ai/supervisor/error-handler.ts` | `Sentry.withScope()` + traceId 태그 |
| Sentry Tunnel | `src/app/sentry-tunnel/route.ts` | 클라이언트 이벤트 프록시 |
| 클라이언트 라우팅 | `instrumentation-client.ts` | `onRouterTransitionStart` |

### 2.6 Sentry Tunnel (애드블록 우회)

브라우저 애드블록커가 `sentry.io` 도메인을 차단할 수 있으므로, 자체 API 라우트(`/api/sentry-tunnel`)를 통해 이벤트를 프록시합니다:

```
브라우저 → /api/sentry-tunnel (자체 도메인) → sentry.io (실제 전송)
```

`next.config.mjs`에서 tunnel 경로가 설정되어 있으며, CSP 헤더에 Sentry CDN과 인제스트 도메인이 허용됩니다.

---

## Part 3: 통합 점검 체크리스트

### 일상 점검 (주 1회)

```bash
# 1. Langfuse 사용량 확인
curl -H "X-API-Key: $SECRET" https://ai-engine-xxx.run.app/monitoring \
  | jq '.langfuse'
# → usagePercent < 70 확인

# 2. Sentry 상태 확인
curl -H "x-api-key: $KEY" \
  "https://...vercel.app/api/debug/sentry-test?action=info" \
  | jq '.sentry'
# → enabled: true, clientInitialized: true 확인

# 3. 대시보드 확인
# Langfuse: https://us.cloud.langfuse.com → Dashboard 탭
# Sentry:   https://sentry.io → Stats 탭 → 쿼터 확인
```

### 배포 후 점검

```bash
# 1. AI Engine 헬스체크
curl https://ai-engine-xxx.run.app/health

# 2. Langfuse 연결 확인 (최근 트레이스 있는지)
curl -H "X-API-Key: $SECRET" \
  https://ai-engine-xxx.run.app/monitoring/traces \
  | jq '.count'
# → 0보다 크면 정상

# 3. Sentry 테스트 에러 전송
curl -H "x-api-key: $KEY" \
  "https://...vercel.app/api/debug/sentry-test?action=error"
# → Sentry 대시보드에서 "Sentry Test Error" 확인
```

### 장애 대응

| 증상 | 원인 가능성 | 확인 방법 |
|------|-----------|----------|
| Langfuse 이벤트 안 보임 | 쿼터 초과 (자동 차단) | `/monitoring` → `isDisabled` 확인 |
| Langfuse 이벤트 안 보임 | API 키 만료/오류 | `/monitoring/traces` → 에러 응답 확인 |
| Langfuse 이벤트 안 보임 | Redis 복원 실패 | Cloud Run 로그에서 `[Langfuse]` 검색 |
| Sentry 이벤트 안 보임 | 개발 환경 (정상) | `enabled: production only` 설계 |
| Sentry 이벤트 안 보임 | DSN 미설정 | `/api/debug/sentry-test?action=info` → `dsn` 확인 |
| Sentry 이벤트 안 보임 | 애드블록 + Tunnel 오류 | `/api/sentry-tunnel` 응답 확인 |
| 쿼터 초과 경고 | 이벤트 폭증 | 샘플링 비율 조정 검토 |

---

## Part 4: 환경변수 전체 목록

### Langfuse (Cloud Run AI Engine)

| 변수 | 필수 | 설명 |
|------|:----:|------|
| `LANGFUSE_SECRET_KEY` | ✅ | Langfuse Secret Key (`sk-lf-...`) |
| `LANGFUSE_PUBLIC_KEY` | ✅ | Langfuse Public Key (`pk-lf-...`) |
| `LANGFUSE_BASE_URL` | - | 기본값: `https://us.cloud.langfuse.com` |
| `LANGFUSE_SAMPLE_RATE` | - | 기본값: `0.1` (10% 샘플링) |
| `LANGFUSE_TEST_MODE` | - | `true` 설정 시 100% 트레이싱 + 즉시 flush |

### Sentry (Vercel Frontend)

| 변수 | 필수 | 설명 |
|------|:----:|------|
| `SENTRY_DSN` | - | Server-side DSN (fallback DSN 내장) |
| `NEXT_PUBLIC_SENTRY_DSN` | - | Client-side DSN (fallback DSN 내장) |
| `SENTRY_AUTH_TOKEN` | - | 소스맵 업로드용 (현재 비활성) |
| `SENTRY_ORG` | - | 조직명: `om-4g` |
| `SENTRY_PROJECT` | - | 프로젝트명: `javascript-nextjs` |

> Sentry는 fallback DSN이 코드에 내장되어 있어 환경변수 없이도 동작합니다 (프로덕션 한정).

---

## 관련 문서

- [시스템 아키텍처](../reference/architecture/system/system-architecture-current.md)
- [Cloud Run README](../../cloud-run/README.md) - AI Engine 서비스 상세
- [배포 토폴로지](../reference/architecture/system/system-architecture-current.md#9-deployment-topology)
- [트러블슈팅](../troubleshooting/common-issues.md)

_Last Updated: 2026-04-04_
