> Owner: project
> Status: Draft
> Last reviewed: 2026-05-07

# MSW Test Infra Integrity Plan

- 상태: Draft
- 작성일: 2026-05-07
- TODO.md 연결: Backlog > MSW 테스트 인프라 정합성 개선

## 목표

MSW/Vitest 기반 테스트가 실제로 검증하는 대상을 명확히 하고, 외부 호출 누락과 hardcoded mock으로 인한 false pass를 줄인다.

핵심 방향은 테스트 수를 늘리는 것이 아니라 기존 테스트의 신뢰도를 높이는 것이다.

```text
현재 문제
  ├─ 계약 테스트 일부가 MSW/실 route 대신 inline fetch mock 검증
  ├─ integration/live-connectivity 이름과 실제 실행 방식 불일치
  ├─ MSW unhandled request가 warn이라 외부 호출 누락을 차단하지 못함
  └─ AI provider mock이 현재 runtime provider 정책과 드리프트

개선 방향
  ├─ gate에 남길 20% 핵심 계약 테스트만 엄격화
  ├─ 비용 발생 가능 테스트는 MSW-free 수동 전용 config로 격리
  ├─ 중복/하드코딩 mock 테스트는 신규 추가보다 전환/삭제 우선
  └─ 테스트 방법론 기준으로 회귀 탐지력이 낮은 테스트를 재분류
```

## 비용/과잉 테스트 금지 원칙

- 자동 게이트(`test:quick`, `test:contract`, GitLab validate)에서 실 LLM, Supabase, Vercel, Cloud Run, Redis, GCP Metadata 호출을 추가하지 않는다.
- 테스트 개선으로 외부 API 비용, LLM 토큰, Cloud Run/Redis 명령 수, Vercel 함수 호출 수가 증가하면 안 된다.
- broad E2E, live connectivity, production QA를 기본 게이트에 추가하지 않는다.
- 새 테스트 파일/케이스 추가보다 기존 false-pass 테스트의 전환, 통합, 삭제를 우선한다.
- `test:contract` runtime은 현재 수준을 유지한다. 목표는 “더 많은 테스트”가 아니라 “핵심 경계의 실패 감지”다.
- 새로운 matrix 조합 추가는 금지한다. provider/env/browser 조합이 필요하면 대표 케이스 1개와 schema guard 1개로 제한한다.
- 구현 중 테스트 수가 2배 이상 늘어나는 설계는 중단하고 plan을 재검토한다.

## 발견된 문제

| Severity | 대상 | 근거 | 영향 | 개선 방향 |
|----------|------|------|------|-----------|
| P1 | `tests/api/api-contract.test.ts` | `global.fetch = vi.fn()`으로 계약 응답을 직접 생성 | GitLab validate의 `test:contract`가 실제 route/MSW handler 변경을 놓칠 수 있음 | MSW handler 또는 실제 route handler 호출 기반으로 전환. 로컬 Zod schema는 production schema/import 기준 우선 |
| P1 | `config/testing/msw-setup.ts` | `onUnhandledRequest: 'warn'` | mock 누락 또는 원치 않는 외부 요청이 실패로 차단되지 않음 | 기본 contract/node suite는 strict error. 의도적 live test만 별도 config |
| P2 | `tests/api/core-endpoints.integration.test.ts` | `realFetch = globalThis.fetch` 후 `global.fetch`를 hardcoded mock으로 재정의 | integration처럼 보이지만 실제 서버 계약을 검증하지 않음 | 이름/분류 수정 또는 실제 route handler 단위 테스트로 축소 |
| P2 | `tests/api/ai-supervisor.integration.test.ts` | `/api/ai/supervisor` 응답을 inline mock으로 생성 | supervisor route contract drift 탐지력이 낮음 | 기존 `ai-supervisor-stream.contract.test.ts`와 중복 제거. 필요한 케이스만 route schema/handler 기준으로 유지 |
| P2 | `test:external-connectivity` | `vitest.config.main.ts` 사용으로 MSW/setup mock 포함 | 외부 연결 테스트라는 이름과 실행 환경 불일치 | `setupFiles: []` 전용 config로 분리하고 수동/명시 실행만 허용 |
| P2 | MSW AI handlers | OpenAI/Cohere 중심 mock | 현재 Groq/Cerebras/Mistral/Gemini/OpenRouter runtime 정책과 불일치 | 미사용 handler 제거 또는 현재 provider boundary에 맞춘 최소 handler로 갱신 |
| P3 | `src/test/setup.ts`, `src/test/setup.node.ts` | 전역 `fetch` 기본 mock | unit test에는 편하지만 contract/integration 성격을 흐림 | suite별 setup 분리. contract/live suite는 전역 fetch mock 미사용 |
| P3 | `src/__mocks__/msw/browser.ts`, `getHandlersByEnvironment()` | import/호출 경로 없음 | 개발 MSW 전략이 문서상 존재하지만 실제 미연결 | 개발 MSW가 필요 없으면 제거, 필요하면 명시 entrypoint 연결 |

## 테스트 방법론 적합성 검토

| 방법론 | 현재 상태 | 판단 | 개선 원칙 |
|--------|-----------|------|-----------|
| Pareto Principle | 핵심 gate인 `test:contract` 안에 low-signal inline mock 테스트가 섞임 | 부분 부합, 핵심 20% 집중은 미흡 | `/api/ai/supervisor/stream/v2`, `/api/servers-unified`, `/api/ai/status`, external-call boundary처럼 장애 영향이 큰 20%만 엄격화 |
| Pesticide Paradox | 같은 hardcoded mock happy path를 반복 검증 | 미흡 | 테스트 수 추가 대신 mock 누락 strict화, schema/handler SSOT 참조, 대표 negative path 1개로 새로운 결함 유형 탐지 |
| Test Pyramid | unit/contract 중심 전략은 맞음 | 구조는 부합 | integration/live 테스트 이름과 config를 분리해 pyramid 의미를 회복 |
| Risk-Based Testing | 실외부 호출 비용 보호 원칙은 있음 | 부분 부합 | 비용/외부 호출 경계와 GitLab gate 테스트를 최우선 위험으로 관리 |
| Contract-First Testing | Zod schema와 contract test를 사용 | 부분 부합 | 테스트 로컬 schema 복제보다 production schema 또는 route response normalizer 참조 우선 |
| FIRST 원칙 | 빠르고 deterministic한 테스트 다수 보유 | 부분 부합 | integration 명칭의 mock test를 제거해 Independent/Trustworthy를 강화 |
| Mock Integrity | 문서상 원칙은 있음 | 미흡 | 목업은 가능한 실제 SSOT 기반으로 생성하고, 목업만 맞아서 통과하는 테스트를 줄임 |

## 범위

### 포함

- MSW unhandled request policy 재검토
- contract/live/connectivity suite config 분리
- `test:contract` 내 inline fetch mock 제거 또는 역할 재분류
- 현재 AI provider 정책 기준으로 MSW handler 유지 여부 결정
- 테스트 방법론 기준에 맞춘 중복/저신호 테스트 정리

### 제외

- 실 LLM 호출 자동화 추가
- production Playwright broad QA 추가
- Cloud Run/Supabase/Vercel/Redis live 호출을 기본 CI gate에 추가
- 테스트 커버리지 숫자 확대 목적의 신규 테스트 대량 추가
- AI 답변 품질 exact-match 테스트 추가

## 계약 (Contract)

> Status를 Approved로 올리기 전에 아래 계약을 구현자가 최종 확정한다.

### 변경 후보 파일

- `config/testing/msw-setup.ts`
- `config/testing/vitest.config.contract.ts`
- `config/testing/vitest.config.main.ts`
- `config/testing/vitest.config.ci.ts`
- 신규 가능: `config/testing/vitest.config.external-connectivity.ts`
- `src/__mocks__/msw/handlers/index.ts`
- `src/__mocks__/msw/handlers/ai/*`
- `tests/api/api-contract.test.ts`
- `tests/api/core-endpoints.integration.test.ts`
- `tests/api/ai-supervisor.integration.test.ts`
- `tests/integration/external-services-connection.test.ts`

### 테스트/비용 계약

| 구분 | 계약 |
|------|------|
| 자동 gate 외부 호출 | 0회 유지 |
| 자동 gate LLM token 사용 | 0 유지 |
| `test:contract` 범위 | 핵심 API/AI 계약만 유지. broad integration 포함 금지 |
| live connectivity | `RUN_EXTERNAL_CONNECTIVITY_TESTS=true`와 MSW-free config에서만 실행 |
| test count | 기존 false-pass 테스트 전환/삭제 우선. 신규 테스트는 대표 guard만 추가 |
| failure mode | unhandled request는 contract/node suite에서 실패해야 함 |

### 테스트 시나리오

- [ ] `test:contract`에서 MSW handler 누락 요청은 실패한다.
- [ ] `api-contract`는 inline `global.fetch` mock만으로 통과하지 않는다.
- [ ] live connectivity suite는 shared MSW/setup mock 없이 실행된다.
- [ ] 현재 provider 정책과 맞지 않는 OpenAI/Cohere 중심 AI mock은 gate contract에서 사용되지 않는다.
- [ ] 기존 `test:quick`과 `test:contract` runtime/비용이 유의미하게 증가하지 않는다.

## Task 목록

- [ ] Task 0 — 구현 전 contract/failing spec 최소화: 위 테스트 시나리오 중 핵심 2~3개만 선택
- [ ] Task 1 — MSW strict boundary: unhandled request policy와 suite별 예외 경로 정리
- [ ] Task 2 — contract suite 정리: `api-contract` inline fetch mock 제거/전환/재분류
- [ ] Task 3 — integration/live suite 정리: mock integration과 live connectivity config 분리
- [ ] Task 4 — provider handler 정리: 미사용 OpenAI/Cohere handler 제거 또는 current provider 기준 최소화
- [ ] Task 5 — 방법론 재검토: Pareto/Pesticide/Risk 기준으로 남긴 테스트와 제거한 테스트 이유 기록

## 단계별 커밋/푸시/배포 판단

| Task | 커밋 prefix | gitlab push | Cloud Run 재배포 | Vercel 재배포 |
|------|-------------|:-----------:|:----------------:|:-------------:|
| Task 0 | `test(spec):` | 선택 | ❌ | ❌ |
| Task 1~4 | `test:` / `refactor:` | ✅ | ❌ | ❌ |
| Task 5 | `docs:` | ✅ | ❌ | ❌ |

## 검증 기준

- [ ] `npm run test:contract`
- [ ] `npm run test:quick`
- [ ] `npm run type-check`
- [ ] `npm run lint`
- [ ] `npm run docs:budget`
- [ ] `npm run docs:ai-consistency`
- [ ] `git diff --check`
- [ ] live connectivity 검증이 필요할 경우에만 별도 수동 실행하고, 비용/외부 호출 발생 가능성을 실행 전 보고

## 완료 기준

- [ ] GitLab validate에 포함된 contract tests가 inline mock false pass를 만들지 않음
- [ ] 외부 호출/비용 발생 가능 테스트가 기본 gate에서 분리됨
- [ ] 테스트 수 증가보다 중복 제거/재분류가 우선 적용됨
- [ ] Pareto/Pesticide/Risk-Based/Contract-First 관점의 최종 판단이 plan 또는 완료 보고에 기록됨
