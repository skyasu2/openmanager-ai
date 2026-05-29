# 테스트 전략 가이드

> OpenManager 테스트 전략과 우선순위를 정의한 가이드
> Owner: documentation
> Status: Active
> Doc type: How-to
> Last reviewed: 2026-05-29
> Canonical: docs/guides/testing/test-strategy.md
> Tags: testing,strategy,quality,conversational-qa

---

## Overview

OpenManager AI의 기본 테스트 전략은 **Risk-Based Local-First + Contract-First** 입니다.

- 기본 검증 경로는 `Vitest + MSW` 기반 로컬 테스트
- 외부 API/LLM 실호출은 자동 회귀에서 제외
- Playwright는 로컬 핵심 사용자 플로우 검증에 한정
- Playwright 기본 구성(Chromium 기본, DevTools 비활성화, Vercel bypass header)은 유지하되 `test:e2e:critical`은 release/보조 CI 게이트로 유지
- GitLab CI frontend validate는 `type-check`, `lint:ci`, `test:quick`, `test:contract`, `docs:components:verify` 중심의 deterministic gate를 유지
- 최종 릴리즈 QA는 필요할 때 Vercel production + Playwright MCP로 수행하고 `reports/qa`에 기록

> 핵심 원칙: 무료 티어를 보호하면서도, 회귀를 빠르게 탐지한다. "과도한 텍스트 기반 커버리지(%) 쫓기"를 철저히 배제하고 작동 검증에만 집중한다.

---

## 0. Methodology Baseline (OpenManager 기준)

OpenManager의 테스트 방법론 기준은 아래 흐름이다.

```text
Risk / Cost filter
  -> Local contract + unit checks
  -> Minimal UI flow checks
  -> Release-facing QA / optional live smoke
```

| 방법론 | OpenManager 적용 기준 |
|------|----------------------|
| Risk-Based Testing | 제품 리스크와 비용 리스크가 높은 경계부터 검증한다. 우선순위는 AI stream/API 계약, auth/session, OTel 데이터 SSOT, artifact schema, env/deploy boundary, 비용 발생 경로 순이다. |
| Pareto / Defect Clustering | 모든 파일을 균등하게 테스트하지 않는다. 결함이 집중되는 핵심 20% 경계에 `test:contract`, schema guard, 대표 상태 전이 테스트를 배치한다. |
| Pesticide Paradox | 같은 hardcoded happy-path mock을 반복해서 신뢰하지 않는다. 운영 결함이 발견되면 기존 테스트 데이터를 교체하거나 계약 guard로 전환하고, false-pass 테스트는 추가보다 수정/삭제를 우선한다. |
| Test Pyramid | 많은 로컬 계약/단위 테스트, 적은 핵심 E2E, 더 적은 production QA를 유지한다. GUI/E2E로 커버리지를 늘리는 방식은 기본 전략이 아니다. |
| Test Size Classification | Small/Medium은 기본 gate에 허용하고, Large는 opt-in으로 둔다. Large에는 외부 네트워크, 실제 LLM, Supabase/Vercel/Cloud Run live 호출, 긴 대기가 포함된다. |
| Contract-First | API/AI stream/도구 결과는 consumer mock만 맞추지 않는다. production schema, shared normalizer, route contract, MSW handler 중 최소 하나가 실제 계약과 연결되어야 한다. |
| FIRST | 기본 gate는 Fast, Independent, Repeatable, Self-validating, Timely해야 한다. flaky, 느림, 네트워크 의존이 생기면 기본 gate에서 제외하거나 contract test로 축소한다. |

### 비용/과잉 테스트 금지선

- 자동 gate에서 실 LLM, Supabase, Vercel, Cloud Run, Redis, GCP Metadata 호출을 새로 만들지 않는다.
- 새 테스트 수를 늘리기 전에 기존 false-pass 테스트를 고쳐 같은 비용으로 신뢰도를 올린다.
- coverage percentage 목표를 두지 않는다. 핵심 계약과 사용자 경로가 깨지는지에 집중한다.
- matrix 조합을 늘리지 않는다. 대표 시나리오 1개와 schema/normalizer guard를 우선한다.
- 테스트 실행 시간이 체감상 두 배로 늘어나면 즉시 계획을 재검토한다.

---

## 1. Test Pyramid (운영 기준)

```
         🔺 제한적 수동 스모크 (선택)
        ──────────────────────────────
       🔺🔺 대화형 AI QA (개발 중 직접 질의)
      ─────────────────────────────────────
     🔺🔺🔺 로컬 핵심 E2E (Playwright)
    ─────────────────────────────────
   🔺🔺🔺🔺 계약/단위 테스트 (Vitest + MSW)
  ───────────────────────────────────────────
```

### 레이어별 역할

| 레이어 | 도구 | 목적 | 기본 실행 |
|------|------|------|-----------|
| 계약/단위 | Vitest, MSW, Zod | 요청/응답 형식, 상태 전이, UI 로직 | 항상 |
| 로컬 핵심 E2E | Playwright | 게스트 로그인, 대시보드 렌더, 핵심 상호작용 | release/수동 + 필요 시 로컬 |
| 대화형 AI QA | AI 어시스턴트 직접 질의 | **AI 답변의 유용성** 검증 — "응답했는가"가 아닌 "유용하게 응답했는가" | AI 관련 변경 시 필수 |
| 수동 스모크 | 브라우저 + health check | 배포 직후 최소 생존 확인 | 선택 |

---

## 1.5 대화형 AI QA (Conversational AI QA)

> 핵심 개념: **"AI로 만드는 AI"** — OpenManager AI 어시스턴트에게 직접 질의하면서 개발하는 방식.
> 코드 테스트는 "구현이 맞는가"를 검증하지만, 대화형 QA는 "AI가 의미 있는 답을 하는가"를 검증한다.

### 언제 실행하는가

다음 파일/영역이 변경되었을 때 반드시 실행:

| 변경 영역 | 파일 예시 |
|----------|----------|
| 프롬프트/지침 수정 | `cloud-run/ai-engine/src/domains/monitoring/supervisor-prompt.ts` |
| 에이전트 라우팅 수정 | `orchestrator-factory.ts`, `orchestrator-execution.ts`, `matchPatterns` |
| 지식 베이스 갱신 | `ops-knowledge*.ts`, `knowledge-retrieval*.ts` |
| 사전 계산 데이터 구조 변경 | `precomputed-state.ts`, `DomainDataSource` 구현체 |
| AI 응답 파싱/포맷 변경 | `supervisor-stream.ts`, `stream-data-handler.ts` |

### 표준 질의 세트 (Standard Question Set)

개발 중 AI 어시스턴트에게 아래 5개 질문을 순서대로 질의하고 결과를 평가한다.

```
Q1. [현재 상태] "현재 서버 전체 상태를 요약해줘"
    → 기대: 서버 수, 경보 수, 주요 이슈 언급. 숫자가 실제 데이터와 ±10% 이내.

Q2. [특정 서버] "web-server-01 상태를 자세히 알려줘"
    → 기대: 해당 서버의 CPU/메모리/디스크 지표 + 최근 로그 요약.

Q3. [트렌드 분석] "지난 24시간 중 가장 부하가 높았던 시간대는 언제야?"
    → 기대: 특정 시간대 언급 + 근거 지표. "알 수 없음"이면 fail.

Q4. [인시던트] "지금 당장 조치가 필요한 서버가 있어?"
    → 기대: CRITICAL/WARNING 서버 목록 또는 "현재 없음" 명확한 판단.

Q5. [맥락 연속성] "방금 분석한 서버 중 네트워크 문제가 있는 것만 골라줘"
    → 기대: 이전 Q2/Q4 답변을 참조한 맥락 있는 응답.
```

### 평가 기준

단위 테스트와 달리 정답 문자열을 매칭하지 않는다. 아래 기준으로 유용성(Usefulness)을 평가한다.

| 판정 | 기준 |
|------|------|
| **Pass** | 구체적 수치/서버명 포함, 실제 데이터와 논리적으로 일치, 맥락 연결됨 |
| **Warn** | 응답은 했지만 수치 없이 모호하거나, 질문과 다소 어긋남 |
| **Fail** | "알 수 없습니다", 빈 응답, 전혀 관련 없는 답변, 오류 메시지 |

**Fail/Warn 발생 시 → 코드 수정 루프**:
1. Warn/Fail 질의와 기대 답변을 `reports/qa/` 에 메모
2. `supervisor-prompt.ts` 또는 에이전트 라우팅 수정
3. 재질의로 Pass 확인 후 커밋

### 실행 방법

```bash
# 1. 개발 서버 또는 Production에서 AI 어시스턴트 열기
#    (내부 공개 모드: 게스트 PIN 또는 x-test-secret 검증 → developer disclosure 활성)

# 2. 표준 5개 질문 순서대로 질의

# 3. 결과가 Warn 또는 Fail이면 QA 기록 없이 즉시 프롬프트/라우팅 수정

# 4. 전체 Pass 확인 후 릴리즈 QA에 포함 가능
```

### 기록 방법

AI 관련 릴리즈 QA(broad/release-gate scope)에는 대화형 QA 결과를 `qa-run-input.json`의 `coveredSurfaces`에 `"conversational-ai-qa"` 항목으로 포함한다.

```json
{
  "coveredSurfaces": ["conversational-ai-qa", "dashboard", "ai-chat"],
  "expertAssessments": [
    {
      "surface": "conversational-ai-qa",
      "result": "pass",
      "notes": "5개 표준 질의 전부 Pass. web-server-01 CPU 수치 실데이터 ±5% 이내"
    }
  ]
}
```

### Vision Agent 실이미지 QA 예외

Vision Agent의 실제 이미지/스크린샷 판독은 표준 5문항 대화형 QA나 일반 release gate에 자동 포함하지 않는다.

- 실행 조건: 사용자가 명시적으로 Vision 실이미지 확인을 요청하거나, Vision routing/provider 계약을 직접 수정한 경우에만 수동 smoke로 1회 실행
- 기본 검증: `Vitest` 계약 테스트와 provider selection mock으로 routing/fallback을 검증
- 금지: 매 QA마다 Gemini Vision 실이미지 호출을 반복하거나 provider matrix로 확장
- 기록: 실호출을 했다면 `reports/qa`에 수동 QA로 기록하고, 사용한 이미지 수·provider·model·응답 성공 여부만 남긴다

현재 검증 이력:
- Gemini Vision primary는 `v8.11.184` / `QA-20260519-0538`에서 Playwright PNG 1장으로 production 수동 smoke를 확인했다.
- Z.AI `glm-4.6v-flash` Vision fallback은 `QA-20260519-0539`에서 한 차례 historical smoke를 통과했지만, `QA-20260520-0541`에서 upstream overload로 HTTP 500이 재현되어 2026-05-20 runtime fallback 계약에서 제거했다.
- 위 확인 이후에도 Vision 실이미지 호출은 manual-only 원칙을 유지한다. 같은 provider를 반복 확인하거나 provider matrix를 확장하지 않는다. 현재 runtime Vision provider는 Gemini 하나뿐이다.

---

## 1.7 테스트 커버리지 정책 (Coverage Policy)

> **"숫자 채우기식 테스트 커버리지(%) 달성 지양"**

1인 개발 포트폴리오 및 Vibe Coding의 특성 상, 과도한 단위 테스트 작성을 강제하지 않습니다.
- **Coverage Tool (Istanbul/v8) 미사용**: 80% 이상 커버리지 달성 같은 인위적인 지표를 목표로 삼지 않습니다.
- **실용주의 (Pragmatism)**: "수정했을 때 화면이 터지지 않는가?", "API가 에러를 뱉지 않는가?" 를 즉각 확인하는 스모크 방식에 집중합니다.
- **AI 한계 인정**: AI 코딩의 생산성을 극한으로 끌어올리려면, 테스트 코드 작성에 AI 토큰과 시간을 낭비하기보다 핵심 비즈니스 로직(계약/스키마) 검증에 집중해야 합니다.

---

## 1.8 API 라우트 커버리지 정책

`src/app/api/**/**/route.ts` 파일은 아래 등급 기준으로 계약 테스트를 유지한다.

| 등급 | 기준 | 필수 시나리오 |
|------|------|--------------|
| Critical | AI 질의 진입점, 인증 게이트 | 인증 실패(401) / 정상 응답 / rate limit(429) |
| High | 서버·메트릭 데이터 API | 응답 형식 / 필터 파라미터 처리 |
| Medium | 상태·헬스체크·wake-up API | healthy / degraded 분기 |
| Low | 유틸리티 (version, csrf) | 최소 smoke (200 반환) |

테스트 없이 머지 가능한 유일한 예외:
- `src/app/api/(auth)/**` — Next-Auth 내부 위임 처리
- `src/app/api/error-report/**` — 단순 외부 로그 포워드

**2026-05-11 보강 완료 route**:
- `src/app/api/ai/supervisor/route.ts` — Critical 계약(401/429/400/job redirect/fallback/Cloud Run JSON)
- `src/app/api/ai/status/route.ts`, `src/app/api/ai/wake-up/route.ts` — Medium 상태·warmup 분기
- `src/app/api/servers/route.ts`, `src/app/api/metrics/route.ts`, `src/app/api/csrf-token/route.ts` — High/Low legacy·metric·token 계약

---

## 2. What We Test By Default

### 포함

- React 컴포넌트/훅 상태 전이
- AI 요청 payload 계약 (`messages`, `sessionId`, headers)
- AI 스트림 이벤트 형식(SSE data event 구조)
- 대시보드 핵심 렌더링/접근성/오류 페이지

### 기본 제외

- PR/로컬 자동화에서의 실 LLM 추론 호출
- Vercel 프로덕션 URL 직격 자동 E2E
- 장시간(분 단위) 네트워크 대기 기반 테스트

---

## 3. Commands (현재 표준)

```bash
# 빠른 로컬 회귀
npm run test:quick

# 계약 테스트 묶음
npm run test:contract

# 운영/외부 의존 심화 점검 (선택)
npm run test:external-connectivity
npm run test:cloud-contract
npm run vitals:integration

# 로컬 핵심 E2E
npm run test:e2e:critical

# 개발 중 최소 게이트
npm run test:gate

# 로컬 전체 CI 재현(필요 시)
npm run ci:local
```

## 3.1 외부/느린 테스트 실행 가이드 (선택)

- `npm run test:external-connectivity`:
  - `.env`에 외부 서비스 키/엔드포인트가 모두 설정돼야 함
  - `RUN_EXTERNAL_CONNECTIVITY_TESTS=true` 조건을 충족하지 않으면 전체 스킵
  - 실제 Upstash/Supabase/Google AI/Vercel/Google Cloud 환경 확인 목적

- `npm run test:cloud-contract`:
  - Cloud Run AI 엔진 공개 계약 엔드포인트(`health`, `warmup`, `monitoring`, `supervisor`) 계약 검증
  - `CLOUD_RUN_AI_URL`이 없으면 테스트 전체 스킵

- `npm run vitals:integration`:
  - `web-vitals` 실측 수집 통합 테스트 실행
  - 내부에서 `RUN_SLOW_TESTS=true`를 설정해 `tests/performance/web-vitals-integration.test.ts`의 스킵 가드를 통과시킴

주의: 두 스위트는 네트워크/요금/응답 시간 변동 영향이 있으므로 기본 CI 게이트에는 포함하지 않습니다.

---

## 4. CI/Release Gate (실행 주기 조율)

### Canonical GitLab 기본 게이트 (branch / MR / main)

1. `npm run type-check`
2. `npm run lint:ci`
3. `npm run test:quick`
4. `npm run test:contract`
5. `npm run docs:components:verify`

AI Engine 변경 시 별도 `validate_ai_engine` job이 `cloud-run/ai-engine`에서 `npm run type-check`와 `npm run test`를 실행합니다.
Storybook/UI 경로 변경 시 `validate_storybook_smoke`, bundle 관련 경로 변경 시 `validate_bundle_budget`이 추가로 동작합니다.

### 릴리즈/강화 게이트 (main 병합 전 또는 수동)

1. `npm run ci:local`
2. `npm run test:e2e:critical`
3. `npm run test:cloud:essential` (Cloud Run 변경 시)
4. Vercel production + Playwright MCP final QA (릴리즈 게이트에서 필요할 때)

### 정기/수동 Deep Gate (선택)

1. `npm run test:e2e:all`
2. `npm run test:e2e:external` (외부 의존 시나리오 점검 시)

---

## 5. Cost Guardrails

- 무료 티어 보호를 위해 테스트 기본값은 외부 서비스 호출 0회에 가깝게 유지
- 실추론/실클라우드 검증이 꼭 필요하면 수동 1회 스모크로 제한
- 새 테스트 작성 시 "이 테스트가 외부 토큰/요금을 소비하는가"를 먼저 판단
- CI 사용량 급증을 막기 위해 E2E는 `critical` 스위트를 릴리즈/수동 강화 게이트로만 유지하고, `all/external`은 정기/수동으로 분리

---

## 6. Flaky Guardrails (AI 비결정성 대응)

- AI 답변의 정확 문장/수치 문자열 매칭(assert) 금지
- E2E에서는 렌더링 컨테이너, 상태 전이, 오류 복구 등 안정 신호만 검증
- AI 응답 검증은 `test:contract` + MSW 모킹으로 우선 처리
- 동일 시나리오가 반복 flaky면 E2E에서 제거하고 계약 테스트로 전환

---

## 7. Mock Integrity Rules (무의미 통과 방지)

- 목업은 실코드와 분리된 하드코딩 객체를 복제하지 않고, 가능한 한 실제 모듈을 기준(`importOriginal`)으로 부분 오버라이드한다.
- 설정/스키마/에이전트 목록 테스트는 "실제 source of truth를 기반으로 생성한 목업"만 허용한다.
- API 응답 목업은 Zod/계약 테스트(`test:contract`)와 함께 관리해 필드 추가/삭제 시 테스트가 즉시 실패하도록 유지한다.
- "목업만 맞아서 통과"하는 케이스를 줄이기 위해, 핵심 경로는 최소 1개 이상 실제 설정 참조 테스트를 함께 둔다.

---

## Related Documents

- [E2E Testing Guide](./e2e-testing-guide.md)
- [MSW Test Infra Integrity Plan](../../../reports/planning/archive/msw-test-infra-integrity-plan.md)

## Methodology References

- [ASTQB / ISTQB Seven Testing Principles](https://astqb.org/istqb-foundation-level-seven-testing-principles/) — exhaustive testing limits, defect clustering, pesticide paradox, context-dependent testing.
- [ISTQB Glossary: Risk-Based Testing](https://istqb-glossary.page/risk-based-testing/) — risk level guides the test process from early project stages.
- [Martin Fowler: Test Pyramid](https://martinfowler.com/bliki/TestPyramid.html) — balanced portfolio with more focused low-level tests than broad GUI tests.
- [Google Testing Blog: Test Sizes](https://testing.googleblog.com/2010/12/test-sizes.html) — Small/Medium/Large classification by network, database, external systems, and runtime limits.
- [Pact Docs: Contract Testing](https://docs.pact.io/) — integration messages conform to a shared contract without deploying every dependency.
- [Quick Start](../../QUICK-START.md)
- [AI Standards](../ai/ai-standards.md)
- [Operations](../../operations/README.md)
- [Deployment Guide](../../operations/deployment-guide.md)
