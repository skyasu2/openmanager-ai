# AI 어시스턴트 채팅 기능 개선 계획서

> Owner: project
> Status: Approved — Sprint 1~3 완료(2026-04-09). Sprint 4는 2026-04-17 현재 코드 기준으로 범위를 재정렬했고, 다음 구현 단계는 `test(spec):` failing test 선행 커밋부터 시작.
> Doc type: Plan
> Last reviewed: 2026-04-16
> Tags: ai-chat, improvement, planning, v8.12

---

## 1. 현황 분석 요약

### 1.1 아키텍처 전체 흐름

```
[Frontend]                  [Vercel API]              [Cloud Run AI Engine]
AISidebarV4
├─ useAIChatCore             /api/ai/supervisor        POST /api/ai/supervisor
│  ├─ useHybridAIQuery  →   /stream/v2/route.ts   →   Multi-Agent Orchestrator
│  ├─ useEnhancedChatMessages                          ├─ Text Agents (Groq→Cerebras→Mistral fallback)
│  ├─ useDeferredMessageMetadata                       │  NLQ / Analyst / Reporter / Advisor
│  ├─ useChatQueue                                     └─ Vision Agent (Gemini→OpenRouter fallback)
│  └─ useQueryExecution
│  (SSOT: agent-model-selectors.ts)
└─ useAISidebarStore (Zustand)
```

### 1.2 잘 구현된 부분 (변경 불필요)

| 항목 | 평가 |
|------|------|
| Hybrid Query Routing (스트리밍 ↔ Job Queue) | ✅ 복잡도 기반 자동 분기 |
| SSE + Resumable Stream (Redis 청크 저장) | ✅ 네트워크 단절 복구 |
| Circuit Breaker + Quota Tracker | ✅ Provider 장애 격리 |
| Prompt Injection Guard (보안) | ✅ 다중 레이어 방어 |
| Deferred Metadata Flush 패턴 | ✅ 스트리밍 중 블로킹 없음 |
| Cold Start 자동 재시도 + 웜업 | ✅ 사용자 경험 보호 |
| TypeScript Strict + Zod 검증 | ✅ 타입 안전성 |

### 1.3 발견된 문제점

| # | 위치 | 문제 | 심각도 |
|---|------|------|--------|
| P1 | `useDeferredMessageMetadata` | stream done 이벤트와 flush 타이밍 불일치 → 빠른 연속 요청 시 메타데이터 누락 | High |
| P2 | `useEnhancedChatMessages` | messages 변경 시마다 전체 배열 순회 → 100+ 메시지 시 지연 | High |
| P3 | `useAIChatCore` + `streamRagSources` | 새 쿼리 시작 시 이전 RAG sources 미초기화 → 혼합 표시 버그 | High |
| P4 | `useChatQueue.popAndSendQueue()` | 한 번에 1개만 전송 → 빠른 입력 여러 개 시 긴 대기 | Medium |
| P5 | `supervisor/stream/v2` | `experimental_throttle` 미사용 → chunk 단위 즉시 리렌더 → 불필요한 렌더링 | Medium |
| P6 | `ClarificationDialog` | Skip 옵션 없음 → 명확화 강제, 사용자 이탈 유발 | Medium |
| P7 | `SidebarMessage` | 에러 메시지가 너무 모호 ("보안 정책에 의해 차단") → 사용자 혼란 | Low |
| P8 | `useChatFeedback` | Langfuse에 trace ID만 저장, UI 피드백 버튼 없음 → 품질 개선 데이터 미수집 | Low |

### 1.4 Best Practices 대비 Gap 분석

| 베스트 프랙티스 | 현재 상태 | Gap |
|----------------|----------|-----|
| AI SDK 4단계 상태 머신 (`submitted/streaming/ready/error`) | `isLoading` boolean 사용 | streaming 세분화 상태 없음 |
| `experimental_throttle` (50ms 배치) | 미적용 | chunk 과잉 렌더 |
| Tool 상태 4단계 시각화 (agent 레벨은 있음) | tool 레벨 미지원 | tool call 진행 상태 없음 |
| Provider-level 캐시 (`cacheControl: 'ephemeral'`) | 미적용 | system prompt 반복 토큰 낭비 |
| `generateObject` + Zod 구조화 출력 | 자유 텍스트 생성 후 파싱 | 일부 에이전트에서 불안정 |
| Few-shot 메시지 배열 방식 | system prompt 텍스트 내 예시 | 토큰 효율 낮음 |
| SDK `abortSignal.timeout()` per-step | 고정 전체 타임아웃 | step별 세밀한 timeout 없음 |

---

## 2. 개선 계획

### Phase 1 — 버그 수정 및 Quick Win (1~2일, 무료 티어 영향 없음)

#### 1-A. RAG Sources 초기화 버그 수정 (`P3`)

**파일**: `src/hooks/ai/useAIChatCore.ts` (또는 `useHybridAIQuery.ts`)

```typescript
// 새 쿼리 시작 시 이전 RAG sources 초기화
const handleSendInput = useCallback((text: string, attachments?: FileAttachment[]) => {
  // 기존 코드에 추가
  clearStreamRagSources();  // ← 추가
  // ... 나머지 로직
}, [...]);
```

**검증**: NLQ 쿼리 → "서버 목록 알려줘" → 두 번째 쿼리 시 첫 번째 RAG sources 노출 여부 확인

---

#### 1-B. Deferred Metadata Flush 타이밍 강화 (`P1`)

**파일**: `src/hooks/ai/useDeferredMessageMetadata.ts`

현재 문제: `messages` 변경 감지 의존 → stream done event 직후 flush가 보장되지 않음

```typescript
// stream done callback에서 명시적 flush 호출 추가
// createHybridStreamCallbacks.ts
onFinish: ({ message }) => {
  flushDeferredMetadata(message.id);  // ← 명시적 호출 추가
  onStreamFinish?.(message);
}
```

---

#### 1-C. Clarification Dialog Skip 버튼 추가 (`P6`)

**파일**: `src/components/ai-sidebar/ClarificationDialog.tsx`

```typescript
// 취소 → 건너뛰기(원본 쿼리 그대로 실행)로 변경
<Button variant="ghost" onClick={() => onSkip(originalQuery)}>
  건너뛰고 바로 실행
</Button>
```

**파일**: `src/hooks/ai/core/useClarificationHandlers.ts`
- `handleSkip(originalQuery)` 추가 → 명확화 없이 원본 쿼리로 `sendQuery()` 직접 호출

---

#### 1-D. 에러 메시지 UX 개선 (`P7`)

**파일**: `src/app/api/ai/supervisor/error-handler.ts`

```typescript
// 기존
'보안 정책에 의해 차단된 요청입니다'

// 개선
'입력 내용이 서버 모니터링 AI가 처리할 수 없는 형식입니다. 다른 표현으로 다시 시도해주세요.'
```

**파일**: `src/hooks/ai/core/createHybridStreamCallbacks.ts`
- BLOCKED_INPUT_ERROR 분류 시 위 메시지 표시

---

### Phase 2 — 성능 개선 (2~3일, 무료 티어 영향 없음)

#### 2-A. `experimental_throttle` 적용 (`P5`)

**파일**: `src/hooks/ai/core/useQueryExecution.ts` 또는 `useHybridAIQuery.ts`

현재: AI SDK `useChat` 훅 초기화 시 throttle 미적용
개선: 50ms 배치 처리로 렌더링 30~50% 감소 예상

```typescript
const { messages, append, stop, status } = useChat({
  // 기존 옵션들...
  experimental_throttle: 50,  // ← 추가
});
```

**주의**: 스트리밍 UX 테스트 필요 (너무 느리게 보이면 30ms로 조정)

---

#### 2-B. Incremental Message Transformation (`P2`)

**파일**: `src/hooks/ai/useEnhancedChatMessages.ts`

현재: `useMemo([messages])` → messages 변경 시마다 전체 배열 순회

```typescript
// 개선: 마지막 메시지 + 변경된 메시지만 재처리
const enhancedMessages = useMemo(() => {
  // 이전 변환 결과 캐싱
  const prevCount = prevMessagesRef.current.length;
  const prevEnhanced = prevEnhancedRef.current;

  // 새 메시지만 변환
  if (messages.length > prevCount) {
    const newMessages = messages.slice(prevCount).map(transformMessage);
    return [...prevEnhanced, ...newMessages];
  }

  // 마지막 메시지 변경(스트리밍 업데이트)만 재처리
  if (messages.length === prevCount && messages.length > 0) {
    const lastChanged = transformMessage(messages[messages.length - 1]);
    return [...prevEnhanced.slice(0, -1), lastChanged];
  }

  return prevEnhanced;
}, [messages]);
```

---

#### 2-C. AI SDK 상태 머신 활용 (`UX 개선`)

**파일**: `src/hooks/ai/useHybridAIQuery.ts`

현재: `isLoading: boolean` → streaming 중과 submitted 상태 구분 불가

```typescript
// 기존 isLoading → status 상태 머신으로 확장
const { status } = useChat({...});
// status: 'submitted' | 'streaming' | 'ready' | 'error'

// UI에서 상태별 분기
{status === 'submitted' && <SubmittedIndicator />}      // 전송됨, 응답 대기 중
{status === 'streaming' && <StreamingIndicator />}      // 스트리밍 중 (기존 ThinkingSpinner)
{status === 'ready' && messages.length > 0 && <SuccessState />}
{status === 'error' && <ErrorWithRetryButton />}
```

**파일**: `src/components/ai-sidebar/EnhancedAIChat.tsx`
- 현재 `isLoading && <ThinkingSpinner>` → status별 분기로 더 정확한 UX

---

### Phase 3 — 품질 및 관측성 개선 (3~5일)

#### 3-A. Langfuse 피드백 UI 버튼 추가 (`P8`)

**파일**: `src/components/ai/MessageActions.tsx`

```typescript
// 기존 복사/재생성 버튼에 👍/👎 추가
<button onClick={() => submitFeedback(messageId, 'positive')}>👍</button>
<button onClick={() => submitFeedback(messageId, 'negative')}>👎</button>
```

**파일**: `src/hooks/ai/core/useChatFeedback.ts`
- `submitFeedback(messageId, type: 'positive' | 'negative')` 함수 추가
- 기존 `POST /api/ai/feedback` 엔드포인트 활용 (추가 비용 없음)

**효과**: 사용자 피드백 데이터로 prompt 품질 개선 루프 확보

---

#### 3-B. Anthropic Provider 캐시 적용 (`토큰 비용 절감`)

> **참고**: 현재 Vision Agent에만 Gemini 사용 (Anthropic API 별도 비용 발생 시 스킵)
> Cerebras/Groq/Mistral은 캐시 제어 미지원 → 적용 범위 제한적

해당 에이전트가 Anthropic API를 사용하는 경우에만:
```typescript
{ role: 'system',
  content: LONG_SYSTEM_PROMPT,
  providerOptions: { anthropic: { cacheControl: { type: 'ephemeral' } } }
}
```

---

#### 3-C. Thinking Steps UI 개선

**파일**: `src/components/ai/ThinkingProcessVisualizer.tsx`

현재: 모든 thinking step 기본 전체 표시
개선: 기본 축소, "분석 과정 보기" 토글

```typescript
const [expanded, setExpanded] = useState(false);

{thinkingSteps.length > 0 && (
  <button onClick={() => setExpanded(!expanded)}>
    {expanded ? '분석 과정 숨기기 ▲' : `분석 과정 보기 (${thinkingSteps.length}단계) ▼`}
  </button>
)}
{expanded && <ThinkingStepsList steps={thinkingSteps} />}
```

---

### Phase 4 — 아키텍처 개선 (장기, 5+ 일)

2026-04-17 기준으로 Phase 4 범위를 재점검했다.

- `useHybridAIQuery.ts`는 이미 `experimental_throttle: 50`과 `submitted/streaming/ready/error` 상태 정규화를 사용한다.
- `BaseAgent`/`supervisor-*` 경로는 이미 `timeout.totalMs`와 `stepMs`를 전달하고, 스트리밍 경로는 `chunkMs`도 사용한다.
- `generateObjectWithFallback`는 이미 오케스트레이터 라우팅과 task decomposition에 적용돼 있다.

따라서 Sprint 4의 실제 잔여 작업은 "신규 도입"이 아니라, 오케스트레이터 경로의 structured output/timeout 동작을 계약 수준으로 고정하고 회귀 테스트를 보강하는 일이다.

#### 4-A. Orchestrator structured-output hardening

**현재 상태**
- `generateObjectWithFallback`는 이미 오케스트레이터 라우팅과 task decomposition에 적용되어 있다.
- Provider access error 시 다음 provider로 fallback 하고, schema/JSON format error 시 text + JSON parse fallback 한다.
- 하지만 이 경로가 routing timeout, provider fallback, schema fallback과 결합될 때의 상위 계약은 계획서 수준으로 고정되지 않았다.

**변경 대상 후보**
- `cloud-run/ai-engine/src/services/ai-sdk/agents/orchestrator-object-fallback.ts`
- `cloud-run/ai-engine/src/services/ai-sdk/agents/orchestrator-execution.ts`
- `cloud-run/ai-engine/src/services/ai-sdk/agents/orchestrator-decomposition.ts`
- 관련 테스트: `orchestrator-object-fallback.test.ts`, `orchestrator.test.ts`, `orchestrator-decomposition.test.ts`

**구현 목표**
- structured output 실패가 발생해도 현재 fallback order를 깨지 않는다.
- routing/decomposition이 schema fallback 이후에도 동일한 최소 필드를 보장한다.
- fallback이 일어나도 trace, handoff, 최종 응답 contract는 유지한다.

---

#### 4-B. Orchestrator timeout contract 정리

**현재 상태**
- `BaseAgent`, `supervisor-single-agent`, `supervisor-stream`은 이미 `timeout.totalMs`, `stepMs`, `chunkMs`를 사용한다.
- 남은 공백은 오케스트레이터의 라우팅/서브태스크 경로에서 `Promise.race + setTimeout`이 분산 구현되어 있고, fallback 의미가 테스트로 충분히 고정되지 않았다는 점이다.

**변경 대상 후보**
- `cloud-run/ai-engine/src/config/timeout-config.ts`
- `cloud-run/ai-engine/src/services/ai-sdk/agents/orchestrator-execution.ts`
- `cloud-run/ai-engine/src/services/ai-sdk/agents/orchestrator-decomposition.ts`
- 관련 테스트: `orchestrator.test.ts`, `orchestrator-decomposition.test.ts`

**구현 목표**
- routing decision timeout 시 stream path는 기존 `suggestedAgent` fallback contract를 유지한다.
- subtask timeout 시 전체 multi-agent 응답을 불필요하게 실패시키지 않고, 성공한 subtask만으로 응답을 구성한다.
- timeout 상수는 `TIMEOUT_CONFIG` 기준으로만 조정한다.

---

## 3. 우선순위 요약

| Phase | 작업 | 우선순위 | 예상 소요 | 효과 |
|-------|------|----------|----------|------|
| 1-A | RAG Sources 초기화 버그 | P0 | 0.5h | 버그 수정 |
| 1-B | Deferred Metadata Flush 강화 | P0 | 1h | 메타데이터 누락 방지 |
| 1-C | Clarification Skip 버튼 | P1 | 1h | UX 개선 |
| 1-D | 에러 메시지 UX | P2 | 0.5h | 사용자 혼란 감소 |
| 2-A | experimental_throttle 적용 | P1 | 0.5h | 렌더링 성능 개선 |
| 2-B | Incremental Message Transform | P1 | 2h | 대화 길어질수록 체감 |
| 2-C | AI SDK Status Machine | P2 | 2h | 정확한 UX 상태 표시 |
| 3-A | Langfuse 피드백 UI | P2 | 2h | 품질 개선 데이터 |
| 3-C | Thinking Steps 토글 | P3 | 1h | 화면 복잡도 감소 |
| 4-A | Structured-output hardening | P3 | 4h+ | 라우팅/분해 안정성 |
| 4-B | Orchestrator timeout contract | P3 | 2h | fallback 신뢰성 개선 |

---

## 4. 실행 로드맵

### Sprint 1 (즉시 실행 가능, ~4h)

```
[x] 1-A: RAG sources 초기화 버그 수정 (쿼리 시작 시 일괄 초기화 가드 적용)
[x] 1-B: Deferred metadata flush 강화 (onFinish message.id 기준 강제 flush 경로 추가)
[x] 1-D: 에러 메시지 개선 (blocked input 사용자 안내 문구 개선)
[x] 2-A: experimental_throttle 50ms 적용
```

### Sprint 2 (~1일)

```
[x] 1-C: Clarification Skip 버튼 (UI 버튼 + skip/dismiss 동작 테스트 추가)
[x] 2-B: Incremental message transformation (message 단위 캐시로 변경분만 재변환)
[x] 2-C: AI SDK status machine 활용 (streamStatus 노출 + submitted/streaming UX 분리)
```

### Sprint 3 (~2일)

```
[x] 3-A: Langfuse 피드백 👍/👎 버튼 — useChatFeedback 단위 테스트 7개 추가 (traceId없음·silent-fallback·sessionRef 최신값 포함)
[x] 3-C: Thinking steps 기본 축소 토글 — ThinkingProcessVisualizer isExpanded 추가, isActive 중 자동 펼침·완료 시 자동 접힘
[x] QA-0265 + v8.11.8 태그 배포 — 6/6 pass, 2026-04-09
```

### Sprint 4 (승인 완료, 구현 대기)

```
[ ] 4-A: Orchestrator structured-output hardening (`generateObjectWithFallback` 경로 + 회귀 테스트)
[ ] 4-B: Orchestrator timeout contract 정리 (routing/subtask fallback + 회귀 테스트)
```

---

## 5. 제약 사항

- **무료 티어**: Cloud Run 변경은 배포 비용 0 (코드 변경만)
- **Provider 비용**: Anthropic 캐시 (3-B)는 Vision Agent 외 적용 범위 확인 후 진행
- **AI SDK 버전**: `experimental_throttle`, `status` 상태 머신은 Vercel AI SDK v6에서 지원 확인 필요
- **하위 호환**: `isLoading` → `status` 전환 시 기존 컴포넌트 전수 확인 필요

---

## 6. 참조

- Vercel AI SDK 공식 문서: https://sdk.vercel.ai/docs
- 현재 구현 진입점: `src/hooks/ai/useAIChatCore.ts`
- 에이전트 구성: `cloud-run/ai-engine/src/services/ai-sdk/agents/`
- 라우팅 신호: `cloud-run/ai-engine/src/services/ai-sdk/query-routing-signals.ts`
- 응답 품질 정책: `cloud-run/ai-engine/src/services/ai-sdk/agents/response-quality.ts`

## 7. 실행 로그

- 2026-04-09 16:47 KST: Sprint 1의 1-A / 1-B / 1-D / 2-A 구현 완료
- 검증:
  - `npm run type-check` ✅
  - `npx vitest run --config config/testing/vitest.config.main.ts src/hooks/ai/core/createHybridStreamCallbacks.test.ts src/hooks/ai/useDeferredMessageMetadata.test.ts src/lib/ai/constants/stream-errors.test.ts` ✅
- 2026-04-09 18:12 KST: Sprint 2의 1-C / 2-B / 2-C 구현 완료
- 검증:
  - `npm run type-check` ✅
  - `npm run lint` ✅
  - `npx vitest run --config config/testing/vitest.config.main.ts src/hooks/ai/useEnhancedChatMessages.test.ts src/hooks/ai/core/useClarificationHandlers.test.ts src/components/ai-sidebar/ClarificationDialog.test.tsx src/hooks/ai/useAIChatCore.test.ts` ✅
- 2026-04-16: Sprint 3 (3-A toolsCalled deferred metadata, 3-B Anthropic 캐시 정책 문서화) 완료. P1 버그 수정 및 v8.11.13 릴리즈. Production QA-20260416-0294 7/7 통과.

---

## 착수 조건 (SDD Gate)

> `Approved` 근거. 다음 구현 단계는 failing test 선행 커밋부터 시작한다.

- [x] **변경 대상 파일 목록** 확정
  - `cloud-run/ai-engine/src/services/ai-sdk/agents/orchestrator-object-fallback.ts`
  - `cloud-run/ai-engine/src/services/ai-sdk/agents/orchestrator-execution.ts`
  - `cloud-run/ai-engine/src/services/ai-sdk/agents/orchestrator-decomposition.ts`
  - `cloud-run/ai-engine/src/config/timeout-config.ts` (상수/헬퍼 변경이 필요한 경우에만)
  - 테스트: `orchestrator-object-fallback.test.ts`, `orchestrator.test.ts`, `orchestrator-decomposition.test.ts`
- [x] **입출력 계약** 확정
  - structured output provider fallback은 기존 provider order를 유지하고, schema/JSON fallback 이후에도 최소 필드(`selectedAgent`, `confidence`, `reasoning` 또는 decomposition schema)를 보장한다.
  - routing timeout 시 stream path는 `suggestedAgent` fallback이 가능하면 계속 진행하고, 불가능하면 기존 error contract를 유지한다.
  - subtask timeout 시 timed-out subtask는 `null` 처리하되, 성공한 subtask가 하나라도 있으면 unified response를 반환한다.
- [x] **테스트 시나리오** 확정
  - 시나리오 1: structured output provider fallback 후에도 routing schema가 유지된다.
  - 시나리오 2: stream routing decision timeout 발생 시 `suggestedAgent` fallback으로 진행된다.
  - 시나리오 3: parallel subtask 일부 timeout 시 성공한 subtask만으로 unified response가 생성된다.
  - 시나리오 4: structured output + text fallback 모두 실패하면 기존 에러 surface를 유지한다.
- [ ] `test(spec): ai chat sprint 4 add failing tests before implementation`
- [ ] `feat: ai chat sprint 4 implement to pass specs`

_Last Updated: 2026-04-17_
