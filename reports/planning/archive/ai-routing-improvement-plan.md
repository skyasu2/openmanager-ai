> Owner: project
> Status: Completed
> Doc type: Plan
> Last reviewed: 2026-05-21
> Tags: ai,routing,semantic-intent,security,clarification

# AI 라우팅 아키텍처 개선 계획

- 상태: Completed
- 작성일: 2026-05-21
- TODO.md 연결: Recent Completed > AI 라우팅 아키텍처 개선
- 배경: 기존 설계 분석에서 식별된 신뢰 경계, 중복 호출, 책임 분산 문제 해소

---

## 목표

AI 라우팅 경계의 신뢰도를 높이되, 기존 portable domain 구조와 사용자-facing AI 동작을 깨뜨리지 않는다.

```
클라이언트 local guard/classifier
  -> 선택적 NLQ entity extraction
  -> Vercel BFF supervisor proxy
  -> Cloud Run semantic metadata normalization
  -> domain routing policy / direct agent routing
```

핵심 정리:
- Cloud Run이 신뢰할 수 없는 `intentFrame` 문자열을 그대로 routing signal로 쓰지 않는다.
- local `classifyQuery()`는 clarification/complexity 판단용임을 타입 이름으로 드러낸다.
- off-domain guard는 `useQueryExecution` 입력 경계에서만 실행한다.
- entity extraction 호출은 routing hint와 clarification 목적을 분리해 판단한다.

## 범위

포함:
- Cloud Run semantic intentFrame validation과 direct routing exact match hardening
- Root App local query classification 타입 명확화
- Root App off-domain guard 중복 제거
- Root App clarification/routing entity extraction trigger 분리
- 위 변경을 고정하는 unit/contract tests

제외:
- live LLM sampling, confidence threshold 변경, provider 변경
- Supabase schema 변경
- 세션 메모리 확장
- KRL corpus seed 변경
- production QA 강제 실행. 라우팅 runtime 변경이 배포될 때만 별도 QA 기록

---

## 현재 코드 사실

| 항목 | 현재 상태 | 판단 |
|------|-----------|------|
| Cloud Run intent normalization | `normalizeSupervisorIntentFrame()`이 `intent`/`domainId`를 non-empty string으로만 검증 | whitelist 또는 registry-aware validation 필요 |
| Direct routing semantic key | `semanticKey.includes(...)` 기반 | prefix/suffix injection에 약함 |
| Off-domain guard | `useQueryExecution.sendQuery()`와 `classifyQuery()`에서 중복 호출 | 입력 경계 단일화 필요 |
| Local classification field | `QueryClassification.intent`와 Cloud Run `intentFrame.intent` 이름 충돌 | `localIntent`로 리네임 |
| Entity extraction trigger | `clarificationRequest || shouldExtractSemanticIntentFrame(query)` 단일 조건 | 목적별 boolean 분리 필요 |

주의:
- Cloud Run assistant runtime에는 sample/portable domain 테스트가 있다. 따라서 `domainId`를 `openmanager-monitoring` 하나로만 하드코딩해 reject하면 안 된다.
- production Root App이 생성하는 semantic frame은 현재 `openmanager-monitoring`만 사용한다.

---

## 계약 (Contract)

### 변경 대상 파일

| 영역 | 파일 |
|------|------|
| Cloud Run metadata normalization | `cloud-run/ai-engine/src/services/ai-sdk/supervisor-semantic-metadata.ts` |
| Cloud Run direct routing | `cloud-run/ai-engine/src/services/ai-sdk/agents/orchestrator-direct-routing.ts` |
| Monitoring routing policy follow-up | `cloud-run/ai-engine/src/domains/monitoring/routing-policy.ts` |
| Root local classifier | `src/lib/ai/query-classifier.ts` |
| Root clarification generator | `src/lib/ai/clarification-generator.ts` |
| Root query execution | `src/hooks/ai/core/useQueryExecution.ts` |
| Root classifier tests | `src/lib/ai/query-classifier.test.ts` |
| Root clarification tests | `src/lib/ai/clarification-generator.test.ts` |
| Root query execution tests | `src/hooks/ai/core/useQueryExecution.test.ts` |
| Cloud Run targeted tests | existing tests adjacent to changed files |

### P1: Semantic Frame Trust Boundary

| 함수/API | 입력 | 출력 | 에러/거부 케이스 |
|----------|------|------|------------------|
| `normalizeSupervisorIntentFrame(value)` | unknown metadata intentFrame | `DomainIntentFrame | undefined` | 구조 불일치, unknown monitoring intent/capability, invalid domain/capability pairing |
| `resolveDirectRoutingTarget(preFilter, context)` | pre-filter result + optional intentFrame/inputType | deterministic routing target | low confidence frame ignored; unknown semantic key ignored |
| `getIntentCategory(query, intentFrame)` | query + optional intentFrame | monitoring intent category | low confidence/unknown semantic key falls back to regex |

Required behavior:
- Monitoring semantic keys are matched by exact known values, not substring search.
- Valid examples remain accepted:
  - `intent=incident_report`, `capabilityId=monitoring.incident_report`
  - `intent=metric_peak`, `capabilityId=monitoring.metric_peak`
  - `intent=ops_advice`, `capabilityId=monitoring.ops_advice`
- Injection-like examples are rejected or ignored as semantic signals:
  - `capabilityId=monitoring.not_incident_report`
  - `capabilityId=monitoring.incident_report_extra`
  - `intent=incident_report_bypass`
- Registered/portable non-monitoring domain frames used by existing runtime tests must not be broken. If a generic whitelist is introduced, it must be registry-aware or explicitly allow current test fixture domains.
- Confidence normalization remains compatible with `0.92` and `92` inputs.

### P2: Off-domain Guard Single Boundary

| 함수/API | 입력 | 출력 | 에러/거부 케이스 |
|----------|------|------|------------------|
| `classifyQuery(query)` | user query | local classification | no direct off-domain guard call |
| `useQueryExecution.sendQuery(query)` | user query | deterministic guard exit or query execution | off-domain exits before entity extraction |
| `useQueryExecution.executeQuery(query)` | user query | deterministic guard exit or transport call | off-domain exits before LLM/async path |

Required behavior:
- `getOffDomainGuardrail()` remains the source of truth for off-domain detection.
- `useQueryExecution` remains the input boundary that blocks/downgrades off-domain requests.
- `classifyQuery()` no longer returns off-domain because it no longer runs the guard.
- Existing infra-context coding queries remain allowed by `getOffDomainGuardrail()` rules.

### P4: Local Intent Rename

| 타입/API | 변경 전 | 변경 후 |
|----------|---------|---------|
| `QueryClassification.intent` | local clarification/complexity intent | removed |
| `QueryClassification.localIntent` | absent | local clarification/complexity intent |

Required behavior:
- `localIntent` union must match the actual classifier surface. Current valid values are `general`, `monitoring`, and `analysis` after P2 removes `off-domain`.
- Do not add unused `guide` or `coding` values unless tests prove active return paths.
- `clarification-generator.ts` must read `classification.localIntent`.
- Development logging in `useQueryExecution.ts` must use `localIntent`.
- No Cloud Run request payload field is renamed by this task.

### P3: Entity Extraction Trigger Split

| 함수/API | 입력 | 출력 | 에러/거부 케이스 |
|----------|------|------|------------------|
| `sendQuery()` clarification flow | query + classification | optional clarification or execution | entity extraction blocked result surfaces user error |
| `shouldExtractSemanticIntentFrame(query)` | query | boolean routing hint need | no side effect |
| `generateClarification(query, classification, entities?)` | query + local classification + optional entities | clarification request or null | no extraction side effect |

Required behavior:
- Compute:
  - `needsRoutingHint = shouldExtractSemanticIntentFrame(query)`
  - `initialClarificationRequest = generateClarification(query, classification)`
  - `needsClarificationCheck = initialClarificationRequest !== null`
- Call `extractEntitiesCached(query)` only when `needsRoutingHint || needsClarificationCheck`.
- Populate `refs.semanticIntentFrame.current` only when `needsRoutingHint` and `entities.intentFrame` exists.
- Populate `refs.semanticPreprocessing.current` only when extraction actually ran.
- Re-run clarification only when `needsClarificationCheck` was true.
- Do not let a routing-only intentFrame automatically suppress a clarification unless the existing `generateClarification(..., entities)` contract says so.

---

## 테스트 시나리오 (구현 전 확정)

### P1

- [x] `normalizeSupervisorIntentFrame()` rejects unknown monitoring intent such as `incident_report_bypass`.
- [x] `normalizeSupervisorIntentFrame()` rejects mismatched monitoring capability such as `intent=metric_peak`, `capabilityId=monitoring.incident_report`.
- [x] `resolveDirectRoutingTarget()` routes exact `monitoring.incident_report` to Reporter.
- [x] `resolveDirectRoutingTarget()` ignores `monitoring.not_incident_report` and falls back to pre-filter.
- [x] `getIntentCategory()` no longer treats `monitoring.not_incident_report` as RCA.
- [x] Existing sample/portable domain contract tests continue to pass.

### P2

- [x] `classifyQuery('비트코인 가격 알려줘')` no longer returns off-domain classification.
- [x] `sendQuery('비트코인 가격 알려줘')` exits before entity extraction and LLM transport.
- [x] `executeQuery('파이썬 피보나치 코드 짜줘')` still returns deterministic guard response before LLM transport.
- [x] Infra-context coding query remains allowed by `getOffDomainGuardrail()` and classifies as local analysis/monitoring as appropriate.

### P4

- [x] TypeScript rejects `classification.intent` references.
- [x] `generateClarification()` uses `classification.localIntent === 'analysis'`.
- [x] Development log prints `localIntent`.
- [x] Existing clarification tests pass after fixture rename.

### P3

- [x] Routing-only semantic query calls `extractEntitiesCached()` once and does not create clarification when none was initially needed.
- [x] Clarification-only query calls `extractEntitiesCached()` once and re-runs clarification with entities.
- [x] Query needing both routing hint and clarification calls extraction once.
- [x] Attachment queries still skip clarification/entity extraction and execute directly.
- [x] `entities.blocked` still surfaces the existing user-facing error and stops execution.

---

## Task 목록

구현 착수 전 이 plan의 Status가 `Approved`였음을 확인했다.

- [x] Task 0 — P1 failing tests
  - 커밋: `test(spec): add semantic frame trust boundary specs`
  - 완료 기준: P1 테스트가 현재 코드에서 실패함
- [x] Task 1 — P1 implementation
  - 커밋: `fix(ai): harden semantic frame routing trust boundary`
  - 완료 기준: Cloud Run targeted tests, AI Engine type-check pass
- [x] Task 2 — P2/P4 failing tests
  - 커밋: `test(spec): add local classifier boundary specs`
  - 완료 기준: off-domain/classification rename tests가 현재 코드에서 실패함
- [x] Task 3 — P2/P4 implementation
  - 커밋: `refactor(ai): separate local classification from guardrails`
  - 완료 기준: root targeted tests, `type-check`, `lint` pass
- [x] Task 4 — P3 failing tests
  - 커밋: `test(spec): add entity extraction trigger split specs`
  - 완료 기준: trigger split tests가 현재 코드에서 실패함
- [x] Task 5 — P3 implementation
  - 커밋: `refactor(ai): split clarification and routing extraction triggers`
  - 완료 기준: root targeted tests, `type-check`, `lint`, `test:quick`, `test:contract` pass
- [x] Task 6 — plan/TODO completion update
  - 커밋: `docs(planning): close ai routing improvement plan`
  - 완료 기준: TODO status와 plan status가 실제 완료 상태와 일치

---

## 완료 기록

- 완료일: 2026-05-21
- 완료 커밋:
  - `2b6e286e2 test(spec): add semantic frame trust boundary specs`
  - `ce45998f3 fix(ai): harden semantic frame routing trust boundary`
  - `08071a9e5 test(spec): add local classifier boundary specs`
  - `30cabcf16 refactor(ai): separate local classification from guardrails`
  - `833151e80 test(spec): add entity extraction trigger split specs`
  - `2a9566f25 refactor(ai): split clarification and routing extraction triggers`
- 검증:
  - AI Engine targeted P1 tests: 3 files / 100 tests PASS
  - AI Engine `npx tsc --noEmit` PASS
  - AI Engine full tests: 138 files / 1374 tests PASS
  - Root P2/P4 targeted tests: 3 files / 130 tests PASS
  - Root P3 targeted tests: 3 files / 44 tests PASS
  - Root `type-check`, `lint`, `test:quick`, `test:contract` PASS

---

## 단계별 검증 게이트

| Task | 필수 검증 | 추가 검증 |
|------|-----------|-----------|
| P1 tests/implementation | `cd cloud-run/ai-engine && npx vitest run src/services/ai-sdk/supervisor-semantic-metadata.test.ts src/services/ai-sdk/agents/orchestrator-direct-routing.test.ts src/domains/monitoring/routing-policy.test.ts` | `cd cloud-run/ai-engine && npx tsc --noEmit` |
| P2/P4 tests/implementation | `npx vitest run src/lib/ai/query-classifier.test.ts src/lib/ai/clarification-generator.test.ts src/hooks/ai/core/useQueryExecution.test.ts` | `npm run type-check`, `npm run lint` |
| P3 tests/implementation | `npx vitest run src/hooks/ai/core/useQueryExecution.test.ts tests/ai-sidebar/useHybridAIQuery.clarification.test.ts tests/ai-sidebar/useHybridAIQuery.contract.test.ts` | `npm run test:quick`, `npm run test:contract` |
| Final | `npm run type-check`, `npm run lint`, `npm run test:quick`, `npm run test:contract`, `git diff --check` | AI Engine full tests if P1 blast radius grows |

실 LLM 호출 또는 production QA는 이 plan의 local/contract 검증으로 대체한다. 라우팅 runtime 변경이 release에 포함될 때만 별도 Vercel + Playwright MCP QA를 기록한다.

---

## 완료 기준

- P1 semantic frame trust boundary가 exact/registered validation으로 고정됨
- P2 off-domain guard가 `useQueryExecution` 입력 경계로 단일화됨
- P4 local classification 타입명이 `localIntent`로 정렬됨
- P3 entity extraction trigger가 routing/clarification 목적별로 분리됨
- 모든 테스트 시나리오가 통과함
- TODO.md Active Task가 완료 또는 다음 조건부 상태로 갱신됨
