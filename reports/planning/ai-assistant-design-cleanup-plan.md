> Owner: project
> Status: Approved
> Doc type: Plan
> Last reviewed: 2026-05-20
> Tags: ai,cleanup,refactor,circuit-breaker,routing,security,dead-code

# AI 어시스턴트 설계 정비 계획

**작성 배경**: 2026-05-20 정적 코드 분석으로 발견한 결함·불일치·사문화 코드를 정비한다.
**분석 범위**: `src/hooks/ai/`, `src/app/api/ai/`, `src/lib/ai/`, `cloud-run/ai-engine/src/`
**TODO.md 연결**: Active → 본 계획서 완료 후 Completed로 기록
**연관 계획서**: [redis-usage-cleanup-plan.md](redis-usage-cleanup-plan.md) — Redis 사문화 코드(Task 1-C·3-C)와 Job Queue 503 개선(Task R-3)을 함께 추적한다.

---

## 발견 요약

| 구분 | 항목 수 | 영향 |
|------|:------:|------|
| 🔴 Critical 결함 | 2 | 버그·기능 무효화 (Task 1-B는 2026-05-20 Major 재분류) |
| 🟠 Major 불일치 | 4 | 다른 경로마다 다른 동작 (Task 1-B 포함) |
| 🟡 Minor 코드 품질 | 4 | 사문화·오해 유발 |

> **2026-05-20 재분류**: Task 1-B (stream/v2 Circuit Breaker)를 🔴 Critical → 🟠 Major로 재분류.  
> 근거: Cloud Run multi-provider key rotation이 provider 장애를 직접 흡수하므로 Vercel BFF level CB는 Cloud Run 서비스 전체 다운 시나리오만 커버하면 충분. 상세는 Task 1-B 본문 참조.

## 2026-05-20 추가 검토 — Vercel AI SDK v6 적용 기준

확인 기준:
- 공식 AI SDK 문서 기준 현재 최신 축은 v6이며, repo root와 `cloud-run/ai-engine` 모두 `ai@6.0.175`를 사용한다.
- Agents 문서 기준 `ToolLoopAgent`는 일반 agent loop의 기본 권장 패턴이나, 복잡한 구조화 workflow는 `generateText`/`streamText` 직접 제어를 허용한다. 따라서 OpenManager의 현재 `BaseAgent(ToolLoopAgent)` + forced-routing `generateText`/`streamText` 하이브리드 구조는 재작성 대상이 아니라 계약 명확화 대상이다.
- Loop control 문서 기준 `stopWhen`/`prepareStep`는 step 수·tool 선택·context 관리를 명시적으로 제한하는 축이다. AI Engine의 `buildAgentLoopSettings()`와 `stopWhen: [hasToolCall('finalAnswer'), stepCountIs(N)]`는 유지한다.
- Resume stream 문서 기준 resumption은 `useChat({ resume: true })`, active stream persistence, Redis stream storage, POST/GET endpoint가 모두 맞아야 하며 abort 기능과 호환되지 않는다. 이 프로젝트는 `stopChat`/abort와 Free Tier 원칙을 중시하므로 현 단계에서는 client resume 활성화보다 server resumable 제거가 적합하다.
- Stream protocol 문서 기준 custom backend는 UI message stream header `x-vercel-ai-ui-message-stream: v1`을 유지해야 한다. `stream/v2`의 `UI_MESSAGE_STREAM_HEADERS`는 이미 이 계약을 만족하므로 제거/변경 금지다.
- Testing 문서 기준 AI SDK 경로는 `ai/test`의 `MockLanguageModelV3`와 stream simulator로 deterministic하게 검증해야 한다. 실 LLM/provider 호출은 QA smoke로 분리하고 unit/contract에는 넣지 않는다.
- Telemetry 문서 기준 `experimental_telemetry`는 입력/출력 기록이 기본 활성화될 수 있다. 이 계획 범위에서는 신규 AI SDK telemetry를 켜지 않고, 기존 `X-AI-*` headers, QA latency observation, Cloud Run/Langfuse 경로를 우선한다. 추후 도입 시 `recordInputs: false`, `recordOutputs: false`를 기본 계약으로 둔다.

프로젝트 적용 결론:
- `stream/v2`는 AI SDK UIMessageStream proxy로 유지한다. Cloud Run agent runtime을 모두 Vercel BFF로 끌어올리는 재설계는 범위 밖이다.
- `ToolLoopAgent` 추가 도입보다 dead path 제거, stream protocol 계약 유지, retry/CB/fallback 증폭 방지, deterministic tests 보강이 우선이다.
- Redis/Upstash를 새 운영 의존으로 확대하지 않는다. 이미 꺼져 있는 resume 기능은 코드와 문서에서도 비활성/제거 방향으로 정렬한다.

### Hybrid runtime boundary

OpenManager는 Vercel-only AI SDK 앱이 아니다. Vercel은 frontend/BFF/protocol boundary를 맡고,
Cloud Run은 AI Engine compute/runtime boundary를 맡는다.

```text
Browser
  |
  | @ai-sdk/react useChat + UIMessage
  v
Vercel / Next.js BFF
  - auth / rate limit / session owner
  - request normalization / local route decision forwarding
  - AI SDK UIMessageStream protocol proxy
  - timing headers / output filter / frontend fallback
  |
  | HTTPS + X-API-Key + UIMessageStream-compatible SSE
  v
Cloud Run ai-engine
  - multi-agent supervisor
  - provider mesh / quota / provider circuit breakers
  - ToolLoopAgent + generateText/streamText runtime
  - monitoring tools / precomputed OTel state / report pipelines
```

| 계층 | 맡는 책임 | AI SDK 공식 기능 사용 수준 |
|------|-----------|--------------------------|
| Browser / React | `useChat`, message state, stream callbacks, abort/stop UX | 높음 |
| Vercel BFF | AI SDK UI stream protocol, custom transport endpoint, auth/rate-limit/fallback wrapper | 중간~높음 |
| Cloud Run AI Engine | agent loop, provider selection, tools, long-running AI work, domain runtime | 높음 (`ToolLoopAgent`, `generateText`, `streamText`) |
| Vercel AI Gateway / Vercel-only agent hosting | provider gateway 중심 routing, Vercel function-only agent runtime | 낮음 또는 의도적 미사용 |

따라서 이 계획의 목표는 "Vercel AI SDK 공식 예제를 100% Vercel 함수 안에 재현"하는 것이 아니다.
목표는 아래 두 조건을 동시에 만족하는 것이다.

- AI SDK 호환성: frontend는 공식 UIMessageStream protocol과 `useChat` 계약을 안정적으로 사용한다.
- Cloud Run ownership: AI-heavy compute, provider mesh, tool loop, monitoring-domain runtime은 Cloud Run에서 운영한다.

이 기준으로 보면 "공식 기능을 절반만 쓴다"는 표현은 정량 수치로는 부정확하지만,
"AI SDK UI/protocol/core primitive는 적극 사용하고, Vercel-only hosting/gateway/resume stack은 프로젝트 요구에 맞게 일부만 채택한다"가 정확하다.

### Task dependency graph

Task 1-A는 독립 root-cause fix가 아니라 **Task 2-B의 legacy 202 redirect 제거에 종속되는 안전망**이다.
실행 순서는 아래 관계를 따른다.

```text
Task 2-B: legacy /api/ai/supervisor 202 job-queue redirect 제거
  └─ resolves root cause of Task 1-A
       └─ Task 1-A: 202가 남는 예외 경로를 빈 응답 오류로 바꾸지 않는 방어 처리

Task 1-B: stream/v2 Circuit Breaker 삽입
  └─ 2-B와 독립인 P2/Major 경로. stream fallback 계약/테스트가 필요하므로 규모는 M
```

| 의존성 | 실행 기준 | 이유 |
|--------|-----------|------|
| 2-B → 1-A | 같은 커밋 묶음 또는 2-B 선행 | 2-B가 legacy 202 redirect root cause를 제거한다. 1-A는 잔여/회귀 방어다. |
| 2-B 없는 1-A 단독 처리 | 금지하지는 않지만 임시 방어로만 기록 | 202를 안내 메시지로 처리해도 라우팅 이중화는 남는다. |
| 1-B | 2-B와 독립 실행 가능 | stream/v2 primary path 보호 문제이며 legacy route 제거와 별개다. |

---

## Phase 1 — Critical 결함 수정

### Task 1-A: 로컬 개발 폴백에서 202 Redirect 미처리 (🔴)

**파일**: `src/hooks/ai/core/useQueryExecution.ts:456~520`

**문제**
레거시 `/api/ai/supervisor`가 복잡한 쿼리에 `202 + { redirect: 'job-queue', ... }` JSON을 반환하지만,
클라이언트 폴백 코드는 `response.ok === true`(202도 ok)인 채로 `data.response`를 파싱하려 해
"로컬 AI 응답이 비어 있습니다." 오류를 발생시킨다.

**수정 방향**
근본 해결은 Task 2-B다. `supervisor/route.ts`의 job-queue 202 redirect가 제거되면 이 오류의 정상 재현 경로는 사라진다.
따라서 구현 순서는 **Task 2-B 선행 또는 Task 2-B + 1-A 같은 커밋 묶음**을 기본으로 한다.

단, 레거시 JSON fallback을 유지하는 동안 방어적으로 202 응답을 명시 처리한다.

```ts
// useQueryExecution.ts 폴백 fetch 후 처리
if (response.status === 202) {
  // job-queue redirect → local dev JSON fallback에서는 사용자 안내로 종료
  setMessages((prev) => [...prev, buildJobRedirectNoticeMessage()]);
  setState((prev) => ({ ...prev, isLoading: false }));
  return;
}
```

`/api/ai/supervisor/stream/v2`는 UIMessageStream protocol이므로 단순 `fetch().json()` 대체 대상이 아니다.
로컬 fallback을 stream/v2로 옮기려면 `useChat` transport 경로로 합류해야 하므로 본 계획에서는 202 제거/방어 처리까지만 포함한다.

**수용 기준**
- Task 2-B 적용 후 레거시 `/api/ai/supervisor`는 복잡 쿼리에 `202 + redirect: 'job-queue'`를 반환하지 않는다.
- 202가 테스트 double이나 잔여 경로에서 들어와도 local dev fallback은 빈 응답 오류를 만들지 않는다.
- 로컬 환경(`npm run dev:network`)에서 "보고서" 키워드 포함 쿼리 전송 시 정상 처리된다.

**구현 상태 (2026-05-20)**: 완료. Task 2-B와 같은 SDD 묶음으로 처리했다. local dev legacy JSON fallback은 202 response를 명시 안내 메시지로 종료하고, 빈 응답 오류로 변환하지 않는다.

---

### Task 1-B: Primary Streaming 경로 Circuit Breaker 누락 (🟠 — 2026-05-20 Critical→Major 재분류)

**파일**: `src/app/api/ai/supervisor/stream/v2/route.ts:262~393`

**재분류 근거 (2026-05-20)**
Cloud Run AI Engine은 multi-provider key rotation으로 provider 장애를 직접 흡수한다. Groq → Z.AI → Mistral → Cerebras 순으로 자동 전환하므로, 개별 provider 실패는 Vercel BFF까지 전파되지 않는다. Vercel BFF Circuit Breaker가 실제로 필요한 시나리오는 Cloud Run **서비스 전체 다운** (HTTP 5xx 연속)이며, 이 경우 사용자는 스트리밍 타임아웃을 경험하지만 기존 retry 로직(`attemptTimeouts` 배열)이 일정 수준 방어한다. 따라서 즉각적인 Critical fix보다는 Major 개선으로 재분류한다.

**문제**
트래픽 대부분이 거치는 `/api/ai/supervisor/stream/v2`에는 Circuit Breaker가 없다.
레거시 `supervisor/route.ts → cloud-run-handler.ts`에만 `executeWithCircuitBreakerAndFallback()`이 적용되어 있다.
Cloud Run 서비스 전체가 다운되었을 때 스트리밍 경로는 차단 없이 계속 요청을 보낸다.

**수정 방향 (권장)**
기존 `executeWithCircuitBreakerAndFallback()`을 `stream/v2/route.ts`의 Cloud Run fetch 루프에 적용한다.
상태 저장은 현재처럼 in-memory로 제한하고 Redis/Upstash 분산 CB 연결은 도입하지 않는다.
예상 규모는 **M**이다. 단순 로그 추가가 아니라 streaming fallback response, OPEN 상태 fetch 생략, UIMessageStream header 유지, failure metadata test가 함께 필요하기 때문이다.

```ts
// stream/v2/route.ts 내 fetch 루프 전
const cbResult = await executeWithCircuitBreakerAndFallback(
  'cloud-run-supervisor-stream',
  async () => { /* 기존 fetch 루프 코드 */ },
  async () => createStreamFallbackResponse({ ... })
);
```

로그만 추가하는 방식은 Critical 결함의 완료 기준으로 보지 않는다.
다만 CB fallback 응답에는 `reason: 'circuit_breaker_open' | 'cloud_run_*'`처럼 원인 구분 가능한 metadata/header를 남긴다.

**제약**: Vercel 서버리스 환경에서는 인스턴스 간 상태 공유 불가. in-memory CB는 단일 인스턴스 보호만 가능하다.
`IDistributedStateStore` 인터페이스는 이미 정의되어 있으나 현재 request path와 연결이 없다.

---

### Task 1-C: 서버-클라이언트 Resume Stream 불일치 해소 (🔴)

**파일**: `src/hooks/ai/useHybridAIQuery.ts:204`, `src/app/api/ai/supervisor/stream/v2/route.ts:444~474`

**문제**
서버는 `AI_RESUMABLE_STREAMS_ENABLED=true`이면 Upstash Redis에 스트림을 저장하고
resumable stream을 만들지만, 클라이언트는 항상 `resume: false`로 고정되어 있다.
서버의 Upstash 저장 로직과 `saveActiveStreamId()` 호출이 완전히 사문화된다.

**결정**: 옵션 B를 기본안으로 채택한다.

| 옵션 | 내용 | 비용 |
|------|------|------|
| A. Client resume 활성화 | `resumeEnabled`를 환경변수 또는 서버 응답 헤더로 동적 결정 | Upstash Redis 사용료 |
| B. Server resumable 제거 | `AI_RESUMABLE_STREAMS_ENABLED` 환경변수, `upstash-resumable.ts`, `stream-state.ts`의 resumable 관련 코드 제거 | 코드 감소, Upstash 비용 0 |

AI SDK 공식 문서상 resume은 Redis/persistence/GET resume endpoint가 모두 필요하고 abort 기능과도 충돌한다.
Free Tier 원칙과 현재 `stopChat` 경로를 고려하면 **옵션 B (Server resumable 코드 제거)** 가 프로젝트에 맞다.
제거 대상 파일/심볼:
- `src/app/api/ai/supervisor/stream/v2/upstash-resumable.ts` (전체)
- `src/app/api/ai/supervisor/stream/v2/stream-state.ts` (`saveActiveStreamId`, `clearActiveStreamId`)
- `stream/v2/route.ts` 내 `resumableStreamsEnabled` 분기 및 `resumeStreamHandler` (GET handler)
- `useHybridAIQuery.ts:204` `const resumeEnabled = false;` 및 `resume` prop 제거

**검증**: 스트리밍 정상 동작, GET `/api/ai/supervisor/stream/v2`가 더 이상 Redis resume을 수행하지 않음.
route 파일은 POST를 계속 제공하므로 framework 동작에 따라 404가 아니라 405가 될 수 있다. 테스트는 "resumable GET handler 미노출/미동작"을 기준으로 작성한다.

**구현 상태 (2026-05-20)**: 완료. SDD 순서로 failing test 커밋 후 구현했으며, `stream-state.ts`/`upstash-resumable.ts`와 관련 tests를 삭제했다. `stream/v2` POST는 항상 pass-through `X-Resumable: false`를 반환하고, GET은 Redis 조회 없이 405를 반환한다. `useHybridAIQuery`는 `useChat`에 `resume` prop을 전달하지 않는다.

---

## Phase 2 — 아키텍처 불일치 정비

### Task 2-A: Off-Domain Guard 순서 오류 수정 (🟠)

**파일**: `src/lib/ai/off-domain-guard.ts:101~110`

**문제**
`EXTERNAL_ACTION_PATTERN`이 `hasOperationalContext()` 검사보다 먼저 실행된다.
`"서버 장애 알림 Slack으로 공유해줘"` 같은 운영 컨텍스트 쿼리가 외부 액션으로 오차단된다.

**수정**
```ts
export function getOffDomainGuardrail(query: string): OffDomainGuardrailResult | null {
  const trimmedQuery = query.trim();
  if (!trimmedQuery) return null;

  // ✅ 운영 컨텍스트 먼저 확인 → 통과시키면 더 이상 검사 불필요
  if (hasOperationalContext(trimmedQuery)) return null;

  if (EXTERNAL_ACTION_PATTERN.test(trimmedQuery)) { ... }
  // 나머지 패턴들...
}
```

**예외 고려**: 순수 외부 액션(캘린더 잡아줘, 이메일 보내줘)은 서버 컨텍스트가 없으므로 여전히 차단된다.

---

### Task 2-B: 라우팅 결정 로직 단순화 (🟠)

**관련 파일**:
- Frontend: `src/hooks/ai/core/query-routing.ts` (score ≥ threshold)
- BFF legacy: `src/app/api/ai/supervisor/route.ts:198-201` (레벨 문자열 + 정규식)

**문제**
같은 쿼리에 대해 frontend와 BFF가 다른 routing 결정을 내릴 수 있다.
Primary 경로(`stream/v2`)는 frontend 결정만 따르기 때문에 legacy `route.ts`의 독립 job-queue 판단은 실질적으로 dead path다.

**수정 방향**
레거시 `supervisor/route.ts`의 job-queue redirect 로직(lines 196-224)을 제거하고,
라우팅은 **frontend 단일 결정 → stream/v2로 요청** 으로 일원화한다.

```ts
// supervisor/route.ts 에서 제거 대상
const complexity = analyzeQueryComplexity(userQuery);
const shouldUseJobQueue = complexity.level === 'very_complex' || ...;
if (shouldUseJobQueue) { return NextResponse.json({ redirect: 'job-queue' }, { status: 202 }); }
```

이 제거로 **Task 1-A**의 202 미처리 문제도 동시에 해소된다.

**전제**: 레거시 `supervisor/route.ts` 경로를 계속 유지할 이유가 없다면 경로 자체 제거를 검토한다.

**구현 상태 (2026-05-20)**: 완료. legacy `supervisor/route.ts`의 독립 job-queue redirect 분기를 제거해 복잡 쿼리도 202 redirect 없이 Cloud Run JSON/stream 또는 fallback 계약으로 처리한다. Job Queue 선택은 frontend `useQueryExecution` 경계의 단일 routing decision에 둔다.

---

### Task 2-C: 구식 아키텍처 주석 업데이트 (🟠)

**파일**: `src/app/api/ai/supervisor/route.ts:407-413`

**문제**
Architecture Note가 현재 AI Engine 구조와 다르다:
```
// 현재 주석 (구식)
// - Supervisor (Groq Llama-8b): Intent classification & routing   ← LLM routing 제거됨
// - Metrics Query Agent (Groq Llama-70b): Server metrics queries  ← NLQ Agent로 교체
// - Analyst Agent (Mistral): Pattern analysis                    ← provider mesh로 변경
// - Reporter Agent (Cerebras): Incident reports                  ← Z.AI/Mistral primary로 변경
```

**메모리 기록**(2026-05-16): Orchestrator LLM routing 제거 → deterministic direct routing,
provider mesh 재조정(NLQ=Groq, Analyst=Mistral, Reporter=Z.AI/Mistral, Advisor=Mistral, Vision=Gemini).

**수정**: 현재 실제 라우팅 구조를 반영하도록 주석 업데이트.
또는 외부 문서를 참조하는 한 줄 링크로 대체한다.

---

## Phase 3 — 사문화 코드 정리

### Task 3-A: `_filterMaliciousOutput` 함수 제거 또는 연결 (🟡)

**파일**: `src/app/api/ai/supervisor/security.ts:238`

```ts
// 이름에 언더스코어 prefix — "내부 전용"이나 실제 호출 없음
function _filterMaliciousOutput(text: string): MaliciousOutputResult { ... }
```

`grep -rn "_filterMaliciousOutput"` 결과 호출 코드 없음.

**결정**: 출력 필터링이 실제로 필요하다면 연결하고, 아니면 제거한다.
`stream-output-filter.ts`에서 AI 내부 도구 결과만 필터링하므로 이 함수의 역할이 중복일 수 있다.

---

### Task 3-B: `QueryClassifier` 싱글톤 → 순수 함수 전환 (🟡)

**파일**: `src/lib/ai/query-classifier.ts:46~192`

**문제**
- `classify()` 메서드가 `async`이지만 내부는 동기 `fallbackClassify()` 호출만 수행
- Singleton 패턴(`getInstance()`)을 쓰지만 상태가 없어 불필요
- `source?: 'llm'` 타입 필드가 있으나 실제로 LLM 호출이 없어 misleading

**수정**
```ts
// 싱글톤 클래스 제거, 순수 함수로 교체
export function classifyQuery(query: string): QueryClassification {
  const offDomainGuardrail = getOffDomainGuardrail(query);
  // ... 동기 키워드 분류 로직
}
```

`useQueryExecution.ts`의 `await classifyQuery(query)` → `classifyQuery(query)` (동기 호출)

---

### Task 3-C: `IDistributedStateStore` 연결점 정리 (🟡)

**파일**: `src/lib/ai/circuit-breaker/state-store.ts`, `src/lib/ai/circuit-breaker.ts`

**상황**
`IDistributedStateStore` 인터페이스와 `setDistributedStateStore()` 함수가 정의되어 있으나,
실제 request path에서 호출하는 코드가 없다(테스트 mock만 존재).
Circuit Breaker는 항상 `InMemoryStateStore`만 사용한다.

**옵션 A — 코드 보존**: 주석에 "연결점 미완성" 명시 유지 (현재 상태와 동일)
**옵션 B — 인터페이스 제거**: `IDistributedStateStore`, `ensureRedisStateStore`, `setDistributedStateStore`를 제거하고 `InMemoryStateStore`만 유지
**옵션 C — 연결 완성**: Redis Upstash를 CB 상태 저장소로 실제 연결 (비용 발생 가능)

Free Tier 원칙상 **옵션 B** 권장 (Upstash 비용 없음, 코드 명확화).

---

### Task 3-D: `warmingUpRef` stale closure → `useLayoutEffect` 전환 (🟡)

**파일**: `src/hooks/ai/useHybridAIQuery.ts:188~222`

```ts
// 현재: useEffect → 다음 렌더 틱에 반영 (async stream callback에서 stale 위험)
useEffect(() => {
  warmingUpRef.current = state.warmingUp;
}, [state.warmingUp]);

// 수정: useLayoutEffect → DOM paint 전 동기 반영
useLayoutEffect(() => {
  warmingUpRef.current = state.warmingUp;
}, [state.warmingUp]);
```

또는 `setState` 내에서 ref를 직접 동기 업데이트한다.

---

## 계약 (Contract) — Approved 전 완료 대상

### 변경 대상 파일

| 영역 | 파일 |
|------|------|
| Vercel stream proxy | `src/app/api/ai/supervisor/stream/v2/route.ts` |
| Vercel stream helpers | `src/app/api/ai/supervisor/stream/v2/stream-response-builder.ts`, `route-utils.ts` |
| Resumable stream 제거 | `src/app/api/ai/supervisor/stream/v2/upstash-resumable.ts`, `stream-state.ts`, 관련 tests |
| Local dev fallback | `src/hooks/ai/core/useQueryExecution.ts`, `src/app/api/ai/supervisor/route.ts` |
| Request guard | `src/lib/ai/off-domain-guard.ts`, `src/lib/ai/off-domain-guard.test.ts` |
| Classifier cleanup | `src/lib/ai/query-classifier.ts`, `src/lib/ai/query-classifier.test.ts`, useQueryExecution mocks |
| Circuit breaker cleanup | `src/lib/ai/circuit-breaker.ts`, `src/lib/ai/circuit-breaker/state-store.ts`, related tests |

### 런타임 계약

| 표면 | 계약 |
|------|------|
| `POST /api/ai/supervisor/stream/v2` | UIMessageStream protocol 유지. `x-vercel-ai-ui-message-stream: v1`, `X-Session-Id`, `X-Stream-Id`, timing headers 유지 |
| Cloud Run fetch failure | retry budget 이후 fallback stream 반환. CB open 시 Cloud Run fetch를 생략하고 fallback stream 반환 |
| Resume stream | client `useChat`는 `resume`을 활성화하지 않는다. server는 Redis-backed resumable stream 생성/GET resume을 수행하지 않는다 |
| Legacy `/api/ai/supervisor` | local dev JSON fallback에서 202 job-queue redirect를 발생시키지 않는다. 202가 남아도 빈 응답 오류로 변환하지 않는다 |
| Off-domain local guard | 운영 컨텍스트가 있는 query는 external action/live fact/coding pattern보다 먼저 통과한다 |
| AI SDK telemetry | 신규 `experimental_telemetry` 활성화는 범위 밖. 도입 시 input/output recording 비활성 기본 |
| AI SDK tests | unit/contract는 `ai/test` mock 또는 local fetch mock만 사용. 실 provider 호출 금지 |

### 테스트 시나리오

- [ ] `stream/v2` route test: Cloud Run 5xx/timeout 반복 후 CB fallback stream 반환, 이후 OPEN 상태에서 upstream `fetch` 미호출
- [x] `stream/v2` route test: UIMessageStream headers 유지 (`x-vercel-ai-ui-message-stream: v1`)
- [x] `stream/v2` route test: `AI_RESUMABLE_STREAMS_ENABLED=true`가 있어도 Redis stream 생성/active stream 저장을 수행하지 않음
- [x] `useHybridAIQuery` test: `useChat` 호출에서 `resume` 활성화 계약 제거 또는 false 유지 확인
- [x] `supervisor/route.ts` test: 복잡한 "보고서/근본 원인" query가 202 redirect를 반환하지 않음
- [x] `useQueryExecution` test: local dev JSON fallback에서 202 response가 빈 응답 오류로 변환되지 않음
- [ ] `off-domain-guard` test: `"서버 장애 알림 Slack으로 공유해줘"`는 `null`, `"팀 회의 일정 잡아줘"`는 `external_action`
- [ ] `query-classifier` test: `classifyQuery()`가 동기 순수 함수로 동일 classification을 반환하고 `source: 'llm'`을 노출하지 않음
- [ ] circuit breaker tests: distributed state store 제거 후 status summary가 `in-memory` 기준으로 안정 동작

### Resolved Decisions

- [x] `stream/v2` GET은 explicit 405 handler로 고정한다. Redis resume은 제거하지만 클라이언트/테스트가 status를 예측할 수 있게 한다.
- [x] `IDistributedStateStore` public re-export는 제거한다. 구현 시 `rg`와 type-check로 외부 import 파손 여부를 확인하고, 테스트는 in-memory status 계약으로 갱신한다.
- [x] `QueryClassifier` class export 제거는 Task 3-E에서 별도 `rg` 확인 후 진행한다. `classifyQuery()` 함수 export는 유지한다.

---

## 작업 우선순위 및 일정 제안

| 우선순위 | Task | 예상 규모 | 비고 |
|:-------:|------|:--------:|------|
| P0 | 1-C (Resume 불일치 — server resumable 제거) | M | Redis/Upstash 운영 의존 제거, client resume 비활성 계약 정리 |
| P1 | 2-B (라우팅 일원화) + 1-A 방어 처리 | M | 2-B가 root cause, 1-A는 잔여 202 안전망. 같은 커밋 묶음 권장 |
| P1 | 2-A (Off-domain guard 순서) | S | 운영 컨텍스트 우선 + 테스트 |
| P2 | 1-B (stream/v2 CB 적용) | M | ~~P1~~ → P2 재분류 (2026-05-20): Cloud Run multi-provider rotation이 provider 실패를 흡수하므로 Vercel CB는 Cloud Run 전체 다운 시나리오만 커버. stream fallback/header/OPEN-state test 포함 필요, 로그만으로 완료 처리 금지 |
| P2 | 2-C (아키텍처 주석 업데이트) | XS | 주석 수정 |
| P3 | 3-A (_filterMaliciousOutput 제거) | S | |
| P3 | 3-B (QueryClassifier → 순수 함수) | S | |
| P3 | 3-C (IDistributedStateStore 제거) | S | |
| P3 | 3-D (warmingUpRef useLayoutEffect) | XS | |

**규모**: XS=1시간, S=2-4시간, M=반나절

---

## SDD 게이트

- [x] **P0 Task 1-C**: `test(spec):` commit — server resumable 비활성/제거, 클라이언트 resume 없이 정상 스트리밍 확인
- [x] **P1 Task 2-B + 1-A**: `test(spec):` commit — 202 redirect 미발생, local dev fallback 202 방어 처리, 동일 쿼리 routing 결과 일관성 확인
- [ ] **P2 Task 1-B**: `test(spec):` commit — stream/v2 Cloud Run failure가 CB fallback으로 전환되고 OPEN 상태에서 upstream fetch를 생략
- [ ] **P1 Task 2-A**: `test(spec):` commit — 서버 컨텍스트 + 외부액션 쿼리 통과 확인

---

## 완료 기준

- [ ] 로컬 개발 환경에서 "보고서" 쿼리 오류 없음
- [ ] `stream/v2` 경로 Circuit Breaker fallback 확인
- [ ] `resumeEnabled = false` + 서버 resumable 코드 일치 (또는 양쪽 제거)
- [ ] `getOffDomainGuardrail` 테스트: "서버 장애 슬랙 공유" → `null` (통과)
- [ ] 아키텍처 주석이 현재 agent/provider 구성과 일치
- [ ] TypeScript 오류 없음 (`npm run type-check`)
- [ ] 테스트 통과 (`npm run test:quick`)
