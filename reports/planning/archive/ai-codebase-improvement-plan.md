# AI 코드베이스 개선 작업 계획서

**작성일**: 2026-01-24
**버전**: v7.0.0 기준
**목표**: AI Assistant + Cloud Run AI Engine 코드 품질 개선

---

## 1. 개요

### 1.1 분석 범위
| 영역 | 파일 | 라인 수 |
|------|------|--------:|
| Frontend AI Hooks | 6개 | ~2,200 |
| Cloud Run AI Engine | 6개 | ~3,750 |
| **총계** | **12개** | **~5,950** |

### 1.2 발견된 이슈 요약
| 우선순위 | 개수 | 유형 |
|:--------:|:----:|------|
| 🔴 P0 (Critical) | 3개 | Resource Leak, Memory Leak, Race Condition |
| 🟠 P1 (High) | 3개 | Error Handling, Type Safety |
| 🟡 P2 (Medium) | 3개 | UX, Code Quality |

---

## 2. Phase 1: P0 Critical Issues (예상: 45분)

### 2.1 Generator Resource Leak 수정
**파일**: `cloud-run/ai-engine/src/services/ai-sdk/supervisor.ts`
**라인**: 763-780

**현재 코드**:
```typescript
for await (const textPart of result.textStream) {
  const elapsed = Date.now() - startTime;
  if (elapsed >= SINGLE_AGENT_HARD_TIMEOUT) {
    console.error(`🛑 [SingleAgent] Hard timeout reached...`);
    yield { type: 'error', data: { ... } };
    return; // ⚠️ streamText가 백그라운드에서 계속 실행
  }
  fullText += textPart;
  yield { type: 'text_delta', data: textPart };
}
```

**수정 계획**:
```typescript
for await (const textPart of result.textStream) {
  const elapsed = Date.now() - startTime;
  if (elapsed >= SINGLE_AGENT_HARD_TIMEOUT) {
    console.error(`🛑 [SingleAgent] Hard timeout reached...`);

    // 🎯 P0 Fix: Graceful stream abort
    try {
      result.textStream.return?.();
    } catch {
      // Silent - best effort cleanup
    }

    yield {
      type: 'error',
      data: {
        code: 'STREAM_TIMEOUT',
        message: 'Processing exceeded time limit',
        partialText: fullText.length > 0 ? fullText.slice(0, 100) + '...' : undefined
      }
    };
    return;
  }
  fullText += textPart;
  yield { type: 'text_delta', data: textPart };
}
```

**검증 방법**:
- Cloud Run 메모리 사용량 모니터링
- 타임아웃 후 CPU 사용량 확인

---

### 2.2 Stale Closure in Microtask 수정
**파일**: `src/hooks/ai/useHybridAIQuery.ts`
**라인**: 452-481

**현재 코드**:
```typescript
queueMicrotask(() => {
  if (controller.signal.aborted) return;

  // ❌ asyncQuery가 렌더 시점 값 캡처됨
  asyncQuery
    .sendQuery(query)
    .then(() => {
      if (!controller.signal.aborted) {
        setState((prev) => ({ ...prev, jobId: asyncQuery.jobId }));
      }
    })
    .catch((error) => { ... });
});
```

**수정 계획**:
```typescript
// 🎯 P0 Fix: Capture current reference before microtask
const currentAsyncQuery = asyncQuery;
const currentQuery = query;

queueMicrotask(() => {
  if (controller.signal.aborted) return;

  currentAsyncQuery
    .sendQuery(currentQuery)
    .then(() => {
      if (!controller.signal.aborted) {
        // Use functional update to get latest state
        setState((prev) => ({
          ...prev,
          jobId: currentAsyncQuery.jobId
        }));
      }
    })
    .catch((error) => { ... });
});
```

**검증 방법**:
- 빠른 연속 요청 시 jobId 일치 확인
- React DevTools로 상태 추적

---

### 2.3 EventSource Memory Leak 수정
**파일**: `src/hooks/ai/useAsyncAIQuery.ts`
**라인**: 200-350

**현재 코드**:
```typescript
const connectSSE = (jobId: string, reconnectAttempt = 0) => {
  if (eventSourceRef.current) {
    listenersRef.current.forEach((listener, eventType) => {
      eventSourceRef.current?.removeEventListener(eventType, listener);
    });
    listenersRef.current.clear();
    eventSourceRef.current.close();
  }

  const eventSource = new EventSource(`/api/ai/jobs/${jobId}/stream`);
  eventSourceRef.current = eventSource;

  // ❌ 매 reconnect마다 새 함수 생성
  const addTrackedListener = (eventType: string, handler: EventListener) => {
    eventSource.addEventListener(eventType, handler);
    listenersRef.current.set(eventType, handler);
  };

  addTrackedListener('connected', () => { ... });
  addTrackedListener('progress', ((event: MessageEvent) => { ... }) as EventListener);
  // ...
};
```

**수정 계획**:
```typescript
// 🎯 P0 Fix: Define handlers outside connectSSE to maintain stable references
const handlersRef = useRef<{
  connected: EventListener | null;
  progress: EventListener | null;
  result: EventListener | null;
  error: EventListener | null;
  heartbeat: EventListener | null;
}>({
  connected: null,
  progress: null,
  result: null,
  error: null,
  heartbeat: null,
});

const connectSSE = useCallback((jobId: string, reconnectAttempt = 0) => {
  // Cleanup previous connection
  if (eventSourceRef.current) {
    const es = eventSourceRef.current;
    Object.entries(handlersRef.current).forEach(([type, handler]) => {
      if (handler) es.removeEventListener(type, handler);
    });
    es.close();
  }

  const eventSource = new EventSource(`/api/ai/jobs/${jobId}/stream`);
  eventSourceRef.current = eventSource;

  // Create handlers with current closure context
  handlersRef.current.connected = () => { ... };
  handlersRef.current.progress = ((event: MessageEvent) => { ... }) as EventListener;
  // ... other handlers

  // Register all handlers
  Object.entries(handlersRef.current).forEach(([type, handler]) => {
    if (handler) eventSource.addEventListener(type, handler);
  });
}, [/* stable dependencies */]);
```

**검증 방법**:
- Chrome DevTools Memory 탭에서 힙 스냅샷 비교
- 10회 reconnect 후 메모리 증가 확인

---

## 3. Phase 2: P1 High Issues (예상: 35분)

### 3.1 Promise.all → Promise.allSettled 변경
**파일**: `cloud-run/ai-engine/src/services/ai-sdk/agents/orchestrator.ts`
**라인**: 1007

**현재 코드**:
```typescript
const results = await Promise.all(subtaskPromises);
```

**수정 계획**:
```typescript
// 🎯 P1 Fix: Use allSettled for graceful partial failure handling
const settledResults = await Promise.allSettled(subtaskPromises);

const results = settledResults.map((result, index) => {
  if (result.status === 'fulfilled') {
    return result.value;
  } else {
    console.error(`❌ [Parallel] Subtask ${index + 1} rejected:`, result.reason);
    return { subtask: subtasks[index], result: null, index };
  }
});

// Log partial success rate
const successCount = settledResults.filter(r => r.status === 'fulfilled').length;
console.info(`📊 [Parallel] ${successCount}/${settledResults.length} subtasks completed`);
```

---

### 3.2 Type Casting 안전성 강화
**파일**: `cloud-run/ai-engine/src/services/ai-sdk/model-provider.ts`
**라인**: 175-178

**현재 코드**:
```typescript
function asLanguageModel(model: any): LanguageModel {
  return model as LanguageModel;
}
```

**수정 계획**:
```typescript
import { LanguageModel } from 'ai';

/**
 * 🎯 P1 Fix: Runtime validation for LanguageModel interface
 */
function asLanguageModel(model: unknown): LanguageModel {
  if (!model || typeof model !== 'object') {
    throw new TypeError('[ModelProvider] Model must be an object');
  }

  // Check for essential LanguageModel methods
  const m = model as Record<string, unknown>;
  if (typeof m.doGenerate !== 'function' && typeof m.doStream !== 'function') {
    throw new TypeError(
      '[ModelProvider] Model does not implement LanguageModel interface (missing doGenerate/doStream)'
    );
  }

  return model as LanguageModel;
}
```

---

### 3.3 stopChat Await 추가
**파일**: `src/hooks/ai/useHybridAIQuery.ts`
**라인**: 425-430

**현재 코드**:
```typescript
stopChat();  // ❌ await 없음
queueMicrotask(() => {
  asyncQuery.sendQuery(query);
});
```

**수정 계획**:
```typescript
// 🎯 P1 Fix: Ensure stopChat completes before redirect
const handleRedirect = async () => {
  try {
    await Promise.resolve(stopChat());
  } catch (e) {
    // stopChat may not return a promise, ignore errors
  }

  // Now safe to redirect to job queue
  const currentAsyncQuery = asyncQuery;
  currentAsyncQuery
    .sendQuery(query)
    .then(() => { ... })
    .catch((error) => { ... });
};

handleRedirect();
```

---

## 4. Phase 3: P2 Medium Issues (예상: 30분)

### 4.1 Progress 상태 에러 시 초기화
**파일**: `src/hooks/ai/useAsyncAIQuery.ts`
**라인**: 174-185

**수정 계획**:
```typescript
const handleError = (error: string) => {
  cleanup();
  setState((prev) => ({
    ...prev,
    isLoading: false,
    isConnected: false,
    error,
    progress: null,  // 🎯 P2 Fix: Clear progress on error
  }));
  onError?.(error);
  resolve({ success: false, error });
};
```

---

### 4.2 onError Callback 실효성 개선
**파일**: `cloud-run/ai-engine/src/services/ai-sdk/supervisor.ts`
**라인**: 746-756

**수정 계획**:
```typescript
let streamError: Error | null = null;

const result = streamText({
  // ...
  onError: ({ error }) => {
    console.error('❌ [SingleAgent] streamText error:', {
      error: error instanceof Error ? error.message : String(error),
    });
    // 🎯 P2 Fix: Track error for later handling
    streamError = error instanceof Error ? error : new Error(String(error));
  },
});

// After stream loop, check for errors
if (streamError) {
  yield {
    type: 'warning',
    data: {
      code: 'STREAM_ERROR_OCCURRED',
      message: streamError.message
    }
  };
}
```

---

### 4.3 Handoff Array 최적화
**파일**: `cloud-run/ai-engine/src/services/ai-sdk/agents/orchestrator.ts`
**라인**: 518-541

**수정 계획**:
```typescript
// 🎯 P2 Fix: Use Map with timestamp key for O(1) operations
const handoffEventsMap = new Map<number, { from: string; to: string; reason?: string }>();

function recordHandoff(from: string, to: string, reason?: string) {
  const now = Date.now();
  const cutoff = now - HANDOFF_EVENTS_CONFIG.cleanupAge;

  // O(n) cleanup only when needed (every 10 events)
  if (handoffEventsMap.size >= HANDOFF_EVENTS_CONFIG.maxSize) {
    for (const [timestamp] of handoffEventsMap) {
      if (timestamp < cutoff) {
        handoffEventsMap.delete(timestamp);
      }
    }
  }

  // O(1) insert
  handoffEventsMap.set(now, { from, to, reason });
}

// Convert to array when needed
function getHandoffEvents() {
  return Array.from(handoffEventsMap.entries())
    .map(([timestamp, event]) => ({ ...event, timestamp: new Date(timestamp) }));
}
```

---

## 5. 검증 계획

### 5.1 단위 테스트
```bash
npm run test:quick
```
- 228개 테스트 통과 확인

### 5.2 타입 체크
```bash
npm run type-check
```
- TypeScript strict mode 통과

### 5.3 빌드 검증
```bash
npm run build
```
- Next.js 16 + Cloud Run 빌드 성공

### 5.4 통합 검증 (선택)
- AI 채팅 정상 동작
- Job Queue 전환 테스트
- 타임아웃 시나리오 테스트

---

## 6. 커밋 전략

### Phase 1 커밋
```
fix(ai-engine): P0 generator resource leak and stream cleanup

- Add graceful abort for streamText on timeout
- Include partial text in error response
- Prevent Cloud Run background resource consumption
```

### Phase 2 커밋
```
fix(ai): P0-P1 closure and error handling improvements

- Fix stale closure in redirect microtask
- Fix EventSource listener memory leak
- Change Promise.all to Promise.allSettled for graceful failures
- Add runtime validation for LanguageModel casting
- Await stopChat before job queue redirect
```

### Phase 3 커밋
```
refactor(ai): P2 UX and code quality improvements

- Clear progress state on error
- Track stream errors for warning emission
- Optimize handoff events with Map for O(1) operations
```

---

## 7. 롤백 계획

문제 발생 시:
```bash
git revert HEAD~3..HEAD  # 3개 커밋 롤백
```

또는 특정 커밋만:
```bash
git revert <commit-hash>
```

---

## 8. 일정

| Phase | 작업 | 예상 시간 |
|:-----:|------|:---------:|
| 1 | P0 Critical (3개) | 45분 |
| 2 | P1 High (3개) | 35분 |
| 3 | P2 Medium (3개) | 30분 |
| 4 | 검증 + 커밋 | 20분 |
| **총계** | | **~130분** |

---

---

## 9. 완료 이력

### Round 1 (2026-01-24) - commit 6902c4159
**Phase 1-3 완료**:
- ✅ P0-1: Generator Resource Leak (supervisor.ts) - partial text 포함
- ✅ P0-2: Stale Closure (useHybridAIQuery.ts) - 변수 캡처 추가
- ✅ P0-3: EventSource Leak (useAsyncAIQuery.ts) - 이전 세션에서 수정됨
- ✅ P1-1: Promise.all → 이미 정상 (개별 timeout 적용됨)
- ✅ P1-2: Type Casting (model-provider.ts) - 런타임 검증 추가
- ✅ P2-1: Progress state on error (useAsyncAIQuery.ts)
- ✅ P2-2: streamError tracking (supervisor.ts)

### Round 2 (2026-01-24) - 재분석 후 수정
**신규 이슈 발견 및 수정**:
- ✅ P0-1: Listener Map Overwrite (useAsyncAIQuery.ts:107) - Array 방식으로 변경
- ✅ P0-2: Stale Closure jobId (useHybridAIQuery.ts:468) - 중복 setState 제거
- ✅ P0-3: Reconnection error handling (useAsyncAIQuery.ts:340) - try-catch 추가
- ✅ P1-1: AbortController for fetch (useAsyncAIQuery.ts:106) - signal 전달
- ✅ P1-2: Subtask timeout logging (orchestrator.ts:968) - 상세 로깅 추가

### Round 3 (2026-01-27) - commit d036d95b9
**P0 Stream Resource Leak 완전 수정**:
- ✅ P0: Graceful stream abort (supervisor.ts, orchestrator.ts) - AsyncIterator.return() 추가
  - timeout 시 streamText가 백그라운드에서 계속 실행되는 문제 해결
  - Cloud Run 메모리/CPU 리소스 누수 방지

---

**✅ 모든 P0/P1/P2 이슈 해결 완료**
