> Owner: project
> Status: In Progress
> Doc type: Plan
> Last reviewed: 2026-06-07
> Tags: refactor,line-guard,ai-engine,large-files

# Line Guard Runtime Hotspots Refactor Plan

- 상태: In Progress
- 작성일: 2026-06-07
- TODO.md 연결: Backlog > Line guard runtime hotspot refactor
- 기준 게이트: `npm run line-guard`

## 목표

현재 저장소의 800줄 초과 파일을 성격별로 분리해 평가하고, 실제 런타임 유지보수 위험이 있는 파일만 리팩터링 대상으로 지정한다.

즉시 목표는 `npm run line-guard` fail 2건을 0건으로 복구하는 것이다. 테스트, 데이터, 리포트, lockfile처럼 대용량이 정상인 파일은 별도 근거 없이 분리하지 않는다.

## 기준선

### line-guard 기준선

2026-06-07 기준 `npm run line-guard` 결과:

```text
result: FAIL
scanned roots: src, cloud-run/ai-engine/src
include tests: no
include data: no
warn files: 48
fail files: 2

fail:
  - cloud-run/ai-engine/src/domains/monitoring/current-metrics-evidence-request.ts (991)
  - cloud-run/ai-engine/src/services/ai-sdk/supervisor-single-agent.ts (830)
```

### 800줄 초과 tracked text 파일 분류

`git ls-files` 기준으로 빌드 산출물, 외부 라이브러리, untracked 임시 파일은 제외했다.

| 분류 | 800줄 초과 | 판단 |
|------|-----------:|------|
| Runtime Source | 2 | 즉시 분리 대상. 현재 `line-guard` fail을 유발한다. |
| Runtime Style | 1 | `globals.css`는 크지만 line-guard 대상이 아니다. CSS order 회귀 위험 때문에 별도 스타일 작업 때만 검토한다. |
| Test/Fixture | 22 | 대부분 시나리오 밀도와 회귀 방어 목적이다. 느림, flakiness, ownership 문제가 확인될 때만 분리한다. |
| Ops Script | 6 | 운영 스크립트는 P3 후보. 지금 line-guard 복구 범위에는 포함하지 않는다. |
| Docs/Plan | 5 | 문서/스펙/이력 파일이다. 문서 예산이나 중복 문제가 없으면 유지한다. |
| Data/Config/Report | 31 | generated/append-only 데이터, OTel 샘플, QA 이력, lockfile이다. 수동 분리 대상이 아니다. |

## 분석 평가

### P1 — `current-metrics-evidence-request.ts`

| 항목 | 내용 |
|------|------|
| 현재 줄 수 | 991 |
| 성격 | Monitoring deterministic evidence request parser |
| 주요 책임 | intent frame 파싱, free-text message 파싱, status/target/metric 정규화, ranking/current/trend/health request 생성, follow-up contextual target 표시 |
| 문제 | 패턴 우선순위와 request builder 호출이 한 파일의 긴 if-ladder에 누적되어 신규 grammar 추가 때 회귀 위험이 크다. |
| 판단 | 즉시 분리 필요 |

권장 분리 방향:

| 신규/유지 파일 | 책임 |
|----------------|------|
| `current-metrics-evidence-request.ts` | public facade: export type 유지, guardrail early return, frame parser/message parser 호출, contextual target post-process |
| `current-metrics-evidence-frame-parser.ts` | `intentFrame` 기반 deterministic request 변환 |
| `current-metrics-evidence-message-parser.ts` | free-text classification 기반 request 변환 |
| `current-metrics-evidence-status.ts` | explicit status filter, top-bottom/healthy-only health helper |
| 기존 `current-metrics-evidence-request-utils.ts` | metric/ranking/trend builder helper 유지. 새 책임을 무리하게 추가하지 않음 |

완료 기준:

- `current-metrics-evidence-request.ts`를 450줄 이하 facade로 축소
- 새 helper 파일은 각각 650줄 이하 유지
- `parseCurrentMetricsEvidenceRequest()` export와 return shape 변경 없음
- 최근 보강한 sourceIntent(`ranking-cross-metric`, `server-compare`, `multi-metric-directional-filter`, `top-bottom-health`) 동작 유지

### P2 — `supervisor-single-agent.ts`

| 항목 | 내용 |
|------|------|
| 현재 줄 수 | 830 |
| 성격 | Supervisor non-stream execution entrypoint |
| 주요 책임 | mode 결정, deterministic domain evidence shortcut, off-domain guardrail, multi-agent fallback, single-agent retry loop, provider attempt, tool result collection, response enrichment, health check |
| 문제 | entrypoint와 실행 attempt 세부가 한 파일에 있어 provider/retry/evidence 변경의 리뷰 범위가 커진다. |
| 판단 | 즉시 분리 필요 |

권장 분리 방향:

| 신규/유지 파일 | 책임 |
|----------------|------|
| `supervisor-single-agent.ts` | public entrypoint: `executeSupervisor()`, `executeSupervisorStream` re-export, `checkSupervisorHealth()` |
| `supervisor-multi-agent-mode.ts` | `executeMultiAgentMode()`와 degraded single fallback 연결 |
| `supervisor-single-agent-mode.ts` | retry loop, quality retry, degraded metadata 적용 |
| `supervisor-single-agent-attempt.ts` | provider 선택, circuit breaker, runtime host LLM generate 호출 |
| `supervisor-single-agent-results.ts` | tool result collection, RAG source extraction, deterministic summary fallback, enrichment metadata 조립 |

완료 기준:

- `supervisor-single-agent.ts`를 450줄 이하 facade로 축소
- provider order, retry count, timeout, model params, circuit breaker key 변경 없음
- metadata fields(`provider`, `modelId`, `stepsExecuted`, `finalAgent`, `assistantRuntime`, `domainEvidence`, degraded metadata) 유지
- `executeSupervisor()`와 `checkSupervisorHealth()` import path compatibility 유지

### P3 — 관찰 대상

| 대상 | 현재 판단 |
|------|-----------|
| `src/styles/globals.css` (1484) | 즉시 분리하지 않는다. CSS import order, Tailwind layer, visual regression 부담이 더 크다. 스타일 작업이 생기면 `tokens/base/components/overrides` 단위로 별도 plan을 만든다. |
| `current-metrics-evidence-provider.test.ts` (3812) | source parser 분리 후 테스트 ownership이 불명확해지면 follow-up으로 `request-parser`, `ranking`, `current`, `trend`, `health` suites를 나눈다. 지금은 회귀 방어 가치가 더 크다. |
| QA/OTel JSON, lockfiles, Lighthouse/QA reports | generated/append-only 성격. 사람이 읽기 쉽게 분리하는 리팩터링 대상이 아니다. |
| `scripts/qa/record-qa-run.js`, `scripts/data/otel-fix.ts`, `scripts/mcp/mcp-health-check-codex.sh` | 운영 스크립트다. 다음 기능 변경 때 함수 단위 모듈화를 검토하되 이번 line-guard 복구에는 포함하지 않는다. |

## 범위

포함:

- `current-metrics-evidence-request.ts`와 직접 helper만 분리
- `supervisor-single-agent.ts`와 직접 helper만 분리
- public export/import compatibility 유지
- 관련 AI Engine targeted tests와 `npm run line-guard` 통과
- 필요 시 source split에 맞춘 최소 테스트 import 정리

제외:

- AI 응답 품질 정책 변경
- provider/model 우선순위, retry, timeout, quota, circuit breaker 정책 변경
- monitoring evidence schema 또는 API response shape 변경
- `globals.css` 스타일 아키텍처 분리
- 대형 테스트/fixture 전면 분리
- generated data, QA report, lockfile 분리
- 배포 자동 진행

## 계약 (Contract)

### 변경 대상 파일

- `cloud-run/ai-engine/src/domains/monitoring/current-metrics-evidence-request.ts`
- 신규 후보: `cloud-run/ai-engine/src/domains/monitoring/current-metrics-evidence-frame-parser.ts`
- 신규 후보: `cloud-run/ai-engine/src/domains/monitoring/current-metrics-evidence-message-parser.ts`
- 신규 후보: `cloud-run/ai-engine/src/domains/monitoring/current-metrics-evidence-status.ts`
- `cloud-run/ai-engine/src/services/ai-sdk/supervisor-single-agent.ts`
- 신규 후보: `cloud-run/ai-engine/src/services/ai-sdk/supervisor-multi-agent-mode.ts`
- 신규 후보: `cloud-run/ai-engine/src/services/ai-sdk/supervisor-single-agent-mode.ts`
- 신규 후보: `cloud-run/ai-engine/src/services/ai-sdk/supervisor-single-agent-attempt.ts`
- 신규 후보: `cloud-run/ai-engine/src/services/ai-sdk/supervisor-single-agent-results.ts`

### 입출력 계약

| 함수/API | 입력 | 출력 | 유지 조건 |
|----------|------|------|-----------|
| `parseCurrentMetricsEvidenceRequest()` | `DomainEvidenceRequest` | `ParsedCurrentMetricsEvidenceRequest \| null` | public export path와 모든 field 이름 유지 |
| `ParsedCurrentMetricsEvidenceRequest` | type export | type export | `intent`, `capabilityId`, `sourceIntent`, metric/ranking/trend/filter fields 유지 |
| `executeSupervisor()` | `SupervisorRequest` | `Promise<SupervisorResponse \| SupervisorError>` | deterministic shortcut, off-domain guardrail, multi/single mode semantics 유지 |
| `checkSupervisorHealth()` | 없음 | `Promise<SupervisorHealth>` | provider/model/tool count shape 유지 |
| `executeSupervisorStream` re-export | 기존 import path | 기존 export | re-export 유지 |

### 동작 계약

- `npm run line-guard` threshold 완화 금지
- semantic query routing, deterministic evidence, sourceIntent 문자열 변경 금지
- pattern 우선순위는 기존 테스트가 표현하는 순서를 유지
- single-agent LLM call 옵션(`stopWhen`, `temperature`, `maxOutputTokens`, timeout, maxRetries) 변경 금지
- Langfuse trace event/generation/finalize 호출의 핵심 metadata 유지
- degraded fallback metadata와 no-provider fallback 응답 유지

### 테스트 시나리오

- [ ] `line-guard baseline`: 현재 fail 2건이 계획에 기록되어 있다.
- [ ] `current metrics parser parity`: `parseCurrentMetricsEvidenceRequest()` 관련 기존 provider tests가 동일하게 통과한다.
- [ ] `ranking/current/trend/health grammar parity`: P28/P29/G-1 보강 케이스가 sourceIntent와 request shape를 유지한다.
- [ ] `supervisor deterministic shortcut parity`: deterministic domain evidence 응답이 provider `deterministic` metadata를 유지한다.
- [ ] `supervisor degraded fallback parity`: multi-agent 실패 후 single fallback 정책과 metadata가 유지된다.
- [ ] `supervisor provider attempt parity`: no-provider, circuit-open, tool result collection, RAG source extraction 동작이 유지된다.
- [ ] `line-guard final`: 800줄 이상 fail 0건, 새 runtime source 파일 800줄 이상 0건.

## Task 목록

> 착수 전 Status가 Approved인지 확인한다. 기존 `npm run line-guard`가 이미 failing gate이므로 Task 0은 인위적인 새 실패 테스트가 아니라 현재 failing gate와 targeted regression suite를 기준선으로 고정한다.

- [x] Task 0 — 기준선 고정
  - `npm run line-guard` fail 2건 기록
  - 대상 파일 public export/import 사용처 확인
  - targeted test 명령 확정
  - 권장 커밋: `test(spec): line guard runtime hotspots baseline`

- [ ] Task 1 — current metrics request parser 분리
  - frame parser와 message parser를 별도 파일로 이동
  - status/health helper를 작은 모듈로 분리
  - `current-metrics-evidence-request.ts`를 facade로 축소
  - 완료 기준: parser targeted tests와 AI Engine type-check 통과

- [ ] Task 2 — supervisor single-agent execution 분리
  - multi-agent mode wrapper 분리
  - single-agent retry loop와 provider attempt 분리
  - tool result/result metadata builder 분리
  - 완료 기준: supervisor targeted tests와 AI Engine type-check 통과

- [ ] Task 3 — 테스트 ownership 정리 여부 판단
  - Task 1 이후 `current-metrics-evidence-provider.test.ts`가 새 모듈 경계와 심하게 어긋나는지 확인
  - 필요 시 parser/ranking/current/trend/health describe 단위만 분리
  - 불필요하면 현 상태 유지로 명시

- [ ] Task 4 — 최종 검증과 문서 정리
  - `npm run line-guard` PASS
  - AI Engine 필수 검증 PASS
  - plan/TODO 상태 갱신
  - 배포가 필요하면 별도 사용자 승인 후 GitLab tag pipeline 사용

## 검증 명령

우선 실행:

```bash
npm run line-guard
cd cloud-run/ai-engine && npm run type-check
cd cloud-run/ai-engine && npm test -- current-metrics-evidence-provider.test.ts
cd cloud-run/ai-engine && npm test -- supervisor-multi-fallback.test.ts supervisor-domain-wiring.contract.test.ts
```

최종 실행:

```bash
cd cloud-run/ai-engine && npm run test
npm run line-guard
npm run docs:budget
npm run docs:ai-consistency
git diff --check
```

Root App 파일을 추가로 건드릴 경우에만 다음을 추가한다:

```bash
npm run type-check
npm run lint
npm run test:quick
npm run test:contract
```

## 단계별 커밋/푸시/배포 판단

| Task | 커밋 prefix | gitlab push | Cloud Run 재배포 | Vercel 재배포 |
|------|-------------|:-----------:|:----------------:|:-------------:|
| Task 0 | `test(spec):` | 선택 | 아니오 | 아니오 |
| Task 1 | `refactor:` | 선택 | 아직 아니오 | 아니오 |
| Task 2 | `refactor:` | 선택 | 검증 완료 후 판단 | 아니오 |
| Task 3 | `test:` 또는 생략 | 선택 | 아니오 | 아니오 |
| Task 4 | `docs:` / `test(qa):` | 예 | tag 배포 요청 시만 | frontend 변경 시만 |

## 코드리뷰 게이트

| 시점 | 리뷰 대상 |
|------|-----------|
| Task 0 완료 후 | 현재 failing gate와 targeted tests가 계약을 충분히 표현하는지 |
| Task 1 완료 후 | parser helper 경계, pattern priority 회귀 여부 |
| Task 2 완료 후 | provider/retry/metadata/trace 계약 회귀 여부 |
| 전체 완료 후 | line-guard fail 0, 새 파일 대형화 여부, 검증 누락 여부 |

## 완료 기준

- [ ] `npm run line-guard` fail 0
- [ ] `current-metrics-evidence-request.ts` 450줄 이하
- [ ] `supervisor-single-agent.ts` 450줄 이하
- [ ] 신규 runtime source 파일 800줄 이상 없음
- [ ] AI Engine type-check 통과
- [ ] 관련 targeted tests 통과
- [ ] AI Engine 전체 test 통과
- [ ] docs guard와 `git diff --check` 통과
- [ ] TODO.md와 plan status 갱신
