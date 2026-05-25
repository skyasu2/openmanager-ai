> Owner: project
> Status: Completed
> Doc type: Plan
> Last reviewed: 2026-05-25
> Tags: ai-engine,routing,prefilter,groq,ai-sdk

# LLM-backed Pre-filter Routing Plan

- 상태: Completed
- 작성일: 2026-05-25
- TODO.md 연결: Active Tasks > LLM-backed pre-filter routing

## 목표

기존 deterministic `preFilterQuery()`를 유지하면서, confidence가 낮거나 agent hint가 없는 질의에만 Groq Scout 기반 structured classifier를 호출해 direct specialist routing의 회색지대를 줄인다.

```text
preFilterQuery(query)          # sync deterministic Tier 1
  -> confidence >= 0.75        # fast path, no LLM
  -> otherwise
preFilterQueryWithLLM(query)   # async wrapper
  -> Groq structured classify  # timeout/cache/error guarded
  -> resolveDirectRoutingTarget()
```

## 범위

- 포함: AI Engine routing classifier, async pre-filter wrapper, direct execution/stream wiring, deterministic unit tests
- 제외: embedding Tier 2, Root App routing 계약 변경, provider fallback mesh 재설계, live LLM QA 자동화

## 계약 (Contract)

### 변경 대상 파일

- `cloud-run/ai-engine/src/services/ai-sdk/routing/llm-intent-classifier.ts`
- `cloud-run/ai-engine/src/services/ai-sdk/agents/orchestrator-context.ts`
- `cloud-run/ai-engine/src/services/ai-sdk/agents/orchestrator-execution.ts`
- `cloud-run/ai-engine/src/services/ai-sdk/agents/orchestrator-execution-stream.ts`
- `cloud-run/ai-engine/src/services/ai-sdk/agents/orchestrator.ts`
- 관련 테스트: adjacent `*.test.ts`

### 입출력 계약

| 함수/API | 입력 타입 | 출력 타입 | 에러/제약 |
|----------|-----------|-----------|-----------|
| `preFilterQuery(query, context?)` | `string`, `PreFilterContext` | `PreFilterResult` | 기존 sync 동작 유지 |
| `classifyRoutingIntentWithLLM(query, options?)` | `string`, optional timeout/model | `{ suggestedAgent, confidence } \| null` | timeout/error/schema invalid 시 `null` |
| `preFilterQueryWithLLM(query, context?)` | `string`, `PreFilterContext` | `Promise<PreFilterResult>` | direct response 또는 confidence `>= 0.75`는 LLM skip |
| execution/stream direct routing | `MultiAgentRequest` | existing response/stream | pre-filter 결과 shape 변경 없음 |

### 임계값 및 fallback

- deterministic confidence `>= 0.75`: LLM 호출하지 않음
- deterministic direct response: LLM 호출하지 않음
- deterministic confidence `< 0.75` 또는 suggestedAgent 없음: LLM 후보
- LLM confidence `>= 0.75`: LLM 결과 사용
- LLM confidence `< 0.75`, timeout, error, missing provider: deterministic 결과 유지
- LLM cache: in-memory LRU, TTL 5분, 최대 200 entries
- timeout: 2초

### Structured classification label

| LLM label | `PreFilterResult.suggestedAgent` |
|-----------|----------------------------------|
| `metrics_query` | `Metrics Query Agent` |
| `advisor` | `Advisor Agent` |
| `analyst` | `Analyst Agent` |
| `reporter` | `Reporter Agent` |
| `general` | no specialist override |

## 테스트 시나리오

- [x] confidence `>= 0.75` deterministic result는 LLM을 호출하지 않고 그대로 반환한다.
- [x] unknown/continue deterministic result에서 LLM `metrics_query` confidence `0.9`가 `Metrics Query Agent`로 승격된다.
- [x] LLM confidence `0.6`은 deterministic fallback을 유지한다.
- [x] LLM timeout/error는 deterministic fallback을 유지한다.
- [x] 동일 query/context는 cache hit 시 LLM을 재호출하지 않는다.
- [x] execution path는 async wrapper 결과를 `resolveDirectRoutingTarget()`에 전달한다.
- [x] stream path는 async wrapper 결과를 `resolveDirectRoutingTarget()`에 전달한다.

## Task 목록

- [x] Task 0 — failing specs 작성
- [x] Task 1 — classifier + LRU/timeout 구현
- [x] Task 2 — orchestrator wrapper와 execution/stream wiring
- [x] Task 3 — targeted validation 및 문서 상태 갱신

## 단계별 커밋/푸시/배포 판단

| Task | 커밋 prefix | gitlab push | Cloud Run 재배포 | Vercel 재배포 |
|------|-------------|:-----------:|:----------------:|:-------------:|
| Task 0 | `test(spec):` | 선택 | ❌ | ❌ |
| Task 1-2 | `feat:` | 선택 | 변경 배포 시 필요 | ❌ |
| Task 3 | `docs:`/same commit | 선택 | ❌ | ❌ |

## 완료 기준

- [x] 테스트 시나리오 전체 통과
- [x] `cd cloud-run/ai-engine && npm run type-check` 통과
- [x] targeted vitest 통과
- [x] 변경이 live LLM 호출 없이 deterministic test로 검증됨

## 검증 결과

- `cd cloud-run/ai-engine && npx vitest run src/services/ai-sdk/routing/llm-intent-classifier.test.ts src/services/ai-sdk/agents/orchestrator-context.test.ts src/services/ai-sdk/agents/orchestrator-execution.timeout.test.ts` — 40 tests passed
- `cd cloud-run/ai-engine && npm run type-check` — passed
- `cd cloud-run/ai-engine && npm run test` — 143 files / 1508 tests passed

## 완료 메모

- `preFilterQuery()` sync 계약은 유지했다.
- `preFilterQueryWithLLM()` async wrapper가 confidence 낮은 handoff만 Groq structured classifier로 보강한다.
- LLM classifier는 AI SDK v6 `generateObject`, Zod schema, 2초 timeout, 5분/200-entry LRU cache를 사용한다.
- execution/stream direct routing은 wrapper 결과를 기존 `resolveDirectRoutingTarget()`에 전달한다.
