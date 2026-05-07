# Observability 가이드 (Langfuse 중심)

> LLM 트레이싱(Langfuse)과 기본 런타임 로그 점검 가이드
> Owner: documentation
> Status: Active
> Doc type: How-to
> Last reviewed: 2026-05-07
> Canonical: docs/guides/observability.md
> Tags: observability,langfuse,monitoring

## 개요

이 프로젝트는 배포된 애플리케이션 관측에 Sentry를 사용하지 않습니다.
LLM 호출 트레이싱은 Langfuse, 일반 런타임 오류 확인은 Vercel/Cloud Run 로그와 프로젝트 logger를 사용합니다.

| 도구 | 용도 | 적용 범위 | 플랜 |
|------|------|----------|------|
| **Langfuse** | LLM 호출 트레이싱, 토큰 사용량 | Cloud Run AI Engine | Hobby (무료, 50K events/월) |
| **Vercel Logs** | Frontend/API 런타임 오류 확인 | Vercel Frontend | Vercel |
| **Cloud Logging/Pino** | AI Engine 서버 로그 | Cloud Run AI Engine | GCP |

```
┌──────────────────────────────────────────────────────┐
│  사용자 브라우저                                      │
│  └─ AI 채팅 요청                                     │
│       ↓                                             │
│  Vercel (Next.js)                                   │
│  └─ X-Trace-Id 헤더 → Cloud Run                     │
│       ↓                                             │
│  Cloud Run (AI Engine)                              │
│  ├─ Pino/Cloud Logging (서버 로그)                   │
│  └─ Langfuse SDK → Langfuse (LLM 트레이싱)           │
└──────────────────────────────────────────────────────┘
```

---

## Part 1: Langfuse (LLM 트레이싱)

### 1.1 Langfuse란?

오픈소스 LLM Observability 플랫폼. AI Engine의 모든 LLM 호출을 추적합니다:
- **Traces**: Supervisor 실행 단위 (질문 → 답변 전체 흐름)
- **Generations**: 개별 LLM 호출 (모델, 토큰, 지연시간)
- **Spans**: 도구 호출 (tool 실행 시간)
- **Scores**: 기본 운영 루프에서는 사용하지 않음. AI 품질 판정은 `reports/qa/` 기록과 코드·프롬프트 재검증으로 관리

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
      "outputPreview": "현재 18대 서버 중...",
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
5. **Scores** 탭: 기본 운영 루프에서는 사용하지 않음. 품질 판정은 QA run 기록을 기준으로 확인
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

## Part 2: Frontend/API 런타임 오류 확인

Sentry는 2026-05-07 cleanup에서 제거되었습니다.
Frontend/API 런타임 오류는 아래 경로로 확인합니다:

- Vercel Dashboard → Project → Logs/Functions
- Vercel deployment log와 GitLab tag pipeline smoke
- `src/lib/logging` 기반 서버 로그
- 브라우저 console/network와 Playwright QA evidence

Sentry 관련 API route, SDK, tunnel, source map upload 설정은 현재 실행 경로에 없습니다.

---

## Part 3: 통합 점검 체크리스트

### 일상 점검 (주 1회)

```bash
# 1. Langfuse 사용량 확인
curl -H "X-API-Key: $SECRET" https://ai-engine-xxx.run.app/monitoring \
  | jq '.langfuse'
# → usagePercent < 70 확인

# 2. 대시보드 확인
# Langfuse: https://us.cloud.langfuse.com → Dashboard 탭
# Vercel:   Project → Logs/Functions 탭
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

# 3. Frontend/API 에러 로그 확인
# Vercel Dashboard → Project → Logs/Functions
```

### 장애 대응

| 증상 | 원인 가능성 | 확인 방법 |
|------|-----------|----------|
| Langfuse 이벤트 안 보임 | 쿼터 초과 (자동 차단) | `/monitoring` → `isDisabled` 확인 |
| Langfuse 이벤트 안 보임 | API 키 만료/오류 | `/monitoring/traces` → 에러 응답 확인 |
| Langfuse 이벤트 안 보임 | Redis 복원 실패 | Cloud Run 로그에서 `[Langfuse]` 검색 |
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

## 관련 문서

- [시스템 아키텍처](../reference/architecture/system/system-architecture-current.md)
- [Cloud Run README](../../cloud-run/README.md) - AI Engine 서비스 상세
- [배포 토폴로지](../reference/architecture/system/system-architecture-current.md#9-deployment-topology)
- [트러블슈팅](../troubleshooting/common-issues.md)

_Last Updated: 2026-05-07_
