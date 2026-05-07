# AI 시스템 개선 계획서

## 아키텍처 제약사항

### 인프라 구조
```
┌─────────────────┐     SSE/Stream      ┌──────────────────┐
│  Vercel (Free)  │ ◄─────────────────► │ Cloud Run (Free) │
│  - Frontend     │     HTTP/2          │  - AI Engine     │
│  - BFF API      │                     │  - Multi-Agent   │
└─────────────────┘                     └──────────────────┘
     │                                        │
     │ 10초 Timeout (Hobby)                   │ 300초 Default
     │ 60초 Timeout (Pro)                     │ 900초 Max
     │                                        │
     └────────── Resumable Stream ────────────┘
```

### 무료 티어 제한사항

| 플랫폼 | 제한 | 영향 | 대응 전략 |
|--------|------|------|----------|
| **Vercel Hobby** | API 10초 timeout | BFF에서 장시간 대기 불가 | Streaming 필수, 청크 응답 |
| **Vercel Hobby** | 100GB bandwidth/월 | 대용량 응답 제한 | 응답 압축, 요약 우선 |
| **Cloud Run Free** | 2M requests/월 | 트래픽 제한 | 캐싱 적극 활용 |
| **Cloud Run Free** | CPU 180,000초/월 | 연산 제한 | Cold start 최소화 |
| **Cloud Run Free** | Memory 360,000 GiB-초 | 메모리 제한 | 캐시 크기 제한 |

### 통신 특성
- Vercel → Cloud Run: HTTPS (외부 호출)
- 스트리밍: Server-Sent Events (SSE)
- 재연결: `resumable-stream` 패키지 사용 중
- 중간 프록시: Vercel Edge → Cloud Run (지연 발생 가능)

---

## Phase 1: Critical Issues (예상 소요: 2-3시간)

### 1.1 finalAnswer 결과 추출 로직 수정
**파일**: `cloud-run/ai-engine/src/services/ai-sdk/supervisor.ts`
**라인**: 345-350

**현재 문제**:
```typescript
// AI SDK v6 toolResult 구조와 불일치
if ('result' in tr) {
  if (tr.toolName === 'finalAnswer' && tr.result) {
    finalAnswerResult = tr.result as { answer: string };
  }
}
```

**수정 방안**:
```typescript
// AI SDK v6 호환 - 여러 구조 대응
for (const tr of step.toolResults) {
  if (tr.toolName === 'finalAnswer') {
    // Case 1: result 프로퍼티에 있는 경우
    if ('result' in tr && tr.result && typeof tr.result === 'object') {
      const result = tr.result as Record<string, unknown>;
      if ('answer' in result) {
        finalAnswerResult = { answer: String(result.answer) };
        break;
      }
    }
    // Case 2: toolResult 자체가 결과인 경우
    if ('answer' in tr) {
      finalAnswerResult = { answer: String((tr as { answer: unknown }).answer) };
      break;
    }
  }
}
```

**무료 티어 영향**: 없음 (로직 수정만)

---

### 1.2 Tool 라우팅 우선순위 수정
**파일**: `cloud-run/ai-engine/src/services/ai-sdk/supervisor.ts`
**라인**: 607-630 (createPrepareStep 함수)

**현재 문제**: "원인" 패턴이 RCA로 바로 라우팅 → 이상탐지 생략

**수정 방안**:
```typescript
// 우선순위 재정렬: Analyst → RCA → Reporter
function createPrepareStep(query: string, webSearchEnabled: boolean) {
  const q = query.toLowerCase();

  // 1. 명시적 이상탐지 요청 (최우선)
  if (/이상|급증|급감|스파이크|anomal|탐지|감지/.test(q)) {
    return {
      activeTools: ['detectAnomalies', 'predictTrends', 'analyzePattern', 'finalAnswer'],
      reason: 'Analyst: 이상탐지 패턴 감지',
    };
  }

  // 2. 예측/트렌드 요청
  if (/예측|트렌드|추이|전망|forecast/.test(q)) {
    return {
      activeTools: ['predictTrends', 'analyzePattern', 'detectAnomalies', 'finalAnswer'],
      reason: 'Analyst: 예측 패턴 감지',
    };
  }

  // 3. RCA/장애 분석 (원인 포함)
  if (/장애|rca|타임라인|상관관계|원인|왜|근본/.test(q)) {
    return {
      activeTools: ['findRootCause', 'buildIncidentTimeline', 'correlateMetrics', 'finalAnswer'],
      reason: 'RCA: 근본원인 분석 패턴 감지',
    };
  }

  // 4. 서버 메트릭 조회 (기본)
  // ... 기존 로직 유지
}
```

**무료 티어 영향**: 없음 (로직 수정만)

---

### 1.3 Web Search 캐시 LRU 패턴 적용
**파일**: `cloud-run/ai-engine/src/tools-ai-sdk/reporter-tools.ts`
**라인**: 201-231

**현재 문제**: 캐시 무한 성장 → Cloud Run 메모리 제한 초과 위험

**수정 방안**:
```typescript
// 무료 티어 메모리 제한 고려 - 보수적 캐시 크기
const SEARCH_CACHE_CONFIG = {
  maxSize: 30,        // Free tier: 256MB RAM 고려
  evictCount: 10,     // 한 번에 10개 삭제
  ttlMs: 10 * 60 * 1000,  // 10분 TTL
} as const;

interface CacheEntry {
  results: WebSearchResult[];
  answer: string | null;
  timestamp: number;
}

const searchCache = new Map<string, CacheEntry>();

function setCacheResult(query: string, results: WebSearchResult[], answer: string | null): void {
  const now = Date.now();

  // TTL 만료 항목 먼저 정리
  for (const [key, entry] of searchCache) {
    if (now - entry.timestamp > SEARCH_CACHE_CONFIG.ttlMs) {
      searchCache.delete(key);
    }
  }

  // 크기 제한 (LRU 방식)
  if (searchCache.size >= SEARCH_CACHE_CONFIG.maxSize) {
    const keysToDelete = [...searchCache.keys()].slice(0, SEARCH_CACHE_CONFIG.evictCount);
    keysToDelete.forEach(k => searchCache.delete(k));
    console.log(`[WebSearch] Cache evicted ${keysToDelete.length} entries`);
  }

  searchCache.set(query.toLowerCase().trim(), { results, answer, timestamp: now });
}

function getCacheResult(query: string): CacheEntry | null {
  const key = query.toLowerCase().trim();
  const entry = searchCache.get(key);

  if (!entry) return null;

  // TTL 체크
  if (Date.now() - entry.timestamp > SEARCH_CACHE_CONFIG.ttlMs) {
    searchCache.delete(key);
    return null;
  }

  return entry;
}
```

**무료 티어 영향**:
- 메모리 사용량 감소 (256MB 제한 내 유지)
- 캐시 히트율 약간 감소 (30개 제한)

---

## Phase 2: High Severity (예상 소요: 3-4시간)

### 2.1 AbortController 패턴 도입 (Vercel Timeout 대응)
**파일**: `src/hooks/ai/useHybridAIQuery.ts`

**현재 문제**: setTimeout 기반 타이밍 의존 → Vercel 10초 timeout 시 race condition

**수정 방안**:
```typescript
// AbortController를 사용한 요청 취소 패턴
const abortControllerRef = useRef<AbortController | null>(null);

const executeQuery = useCallback(async (query: string) => {
  // 이전 요청 취소
  if (abortControllerRef.current) {
    abortControllerRef.current.abort();
  }

  // 새 AbortController 생성
  abortControllerRef.current = new AbortController();
  const { signal } = abortControllerRef.current;

  try {
    // Vercel timeout 대비: 8초 내부 timeout (Hobby 10초 - 2초 버퍼)
    const timeoutId = setTimeout(() => {
      if (!signal.aborted) {
        console.warn('[HybridAI] Approaching Vercel timeout, preparing graceful degradation');
      }
    }, 8000);

    const response = await fetch(apiEndpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ messages, sessionId }),
      signal,  // AbortController signal 전달
    });

    clearTimeout(timeoutId);

    // 스트림 처리...
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      console.log('[HybridAI] Request aborted by user or new request');
      return;
    }
    throw error;
  }
}, [apiEndpoint, sessionId]);

// Cleanup on unmount
useEffect(() => {
  return () => {
    abortControllerRef.current?.abort();
  };
}, []);
```

**무료 티어 영향**:
- Vercel 10초 timeout 내 graceful 처리
- 불필요한 Cloud Run 요청 감소 → CPU 시간 절약

---

### 2.2 EventSource 정리 로직 강화
**파일**: `src/hooks/ai/useAsyncAIQuery.ts`

**현재 문제**: 재연결 시 이전 EventSource 명시적 close 없음 → 연결 누수

**수정 방안**:
```typescript
const eventSourceRef = useRef<EventSource | null>(null);
const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);

const cleanup = useCallback(() => {
  // Timeout 정리
  if (reconnectTimeoutRef.current) {
    clearTimeout(reconnectTimeoutRef.current);
    reconnectTimeoutRef.current = null;
  }

  // EventSource 명시적 close
  if (eventSourceRef.current) {
    eventSourceRef.current.close();
    eventSourceRef.current = null;
    console.log('[AsyncAI] EventSource closed');
  }
}, []);

const connectSSE = useCallback((jobId: string, reconnectAttempt = 0) => {
  // 기존 연결 정리 (중요!)
  cleanup();

  const eventSource = new EventSource(`/api/ai/async-query/status?jobId=${jobId}`);
  eventSourceRef.current = eventSource;

  eventSource.addEventListener('error', () => {
    if (reconnectAttempt < 3) {
      const delay = Math.min(1000 * Math.pow(2, reconnectAttempt), 5000);

      reconnectTimeoutRef.current = setTimeout(() => {
        connectSSE(jobId, reconnectAttempt + 1);
      }, delay);
    } else {
      cleanup();
      handleError('Connection failed after 3 attempts');
    }
  });

  // ... 나머지 이벤트 핸들러
}, [cleanup]);

// Component unmount 시 정리
useEffect(() => {
  return cleanup;
}, [cleanup]);
```

**무료 티어 영향**:
- Cloud Run 연결 수 감소
- 브라우저 메모리 누수 방지

---

### 2.3 Message ID 시퀀싱 개선 (Multi-Agent 스트리밍)
**파일**: `cloud-run/ai-engine/src/services/ai-sdk/supervisor.ts`

**현재 문제**: handoff에서만 messageSeq 증가 → 빠른 연속 응답 시 ID 충돌

**수정 방안**:
```typescript
// createSupervisorStreamResponse 함수 내
let messageSeq = 0;
let lastAgentId: string | null = null;
let currentMessageId = generateMessageId(request.sessionId, startTime, messageSeq);

function generateMessageId(sessionId: string, startTime: number, seq: number): string {
  return `assistant-${sessionId}-${startTime}-${seq}`;
}

// 스트림 이벤트 처리
for await (const event of supervisorStream) {
  switch (event.type) {
    case 'agent_start':
      // Agent 변경 시 새 메시지 ID
      if (lastAgentId !== event.agentId) {
        messageSeq += 1;
        currentMessageId = generateMessageId(request.sessionId, startTime, messageSeq);
        lastAgentId = event.agentId;

        // 새 메시지 시작 알림
        yield {
          type: 'message_start',
          data: { messageId: currentMessageId, agentId: event.agentId }
        };
      }
      break;

    case 'text_delta':
      yield {
        type: 'text_delta',
        data: {
          textDelta: event.textDelta,
          messageId: currentMessageId  // 현재 메시지에 연결
        }
      };
      break;

    case 'handoff':
      // handoff도 새 메시지로 처리
      messageSeq += 1;
      currentMessageId = generateMessageId(request.sessionId, startTime, messageSeq);
      lastAgentId = event.toAgent;
      break;
  }
}
```

**무료 티어 영향**: 없음 (로직 수정만)

---

## Phase 3: Medium Severity (예상 소요: 2-3시간)

### 3.1 Dead Code 정리

| 파일 | 삭제 대상 | 예상 라인 |
|------|----------|----------|
| `src/lib/ai/circuit-breaker.ts` | `setDistributedStateStore()` 함수 | ~15줄 |
| `src/hooks/ai/useHybridAIQuery.ts` | 불필요한 re-export alias | ~15줄 |
| `cloud-run/.../agent-configs.ts` | `getAgentNames()`, `isAgentAvailable()` 등 | ~30줄 |

### 3.2 onError 콜백 추가 (AI SDK v6 권장)
**파일**: `cloud-run/ai-engine/src/services/ai-sdk/supervisor.ts`

```typescript
const result = streamText({
  model: getSupervisorModel(),
  messages,
  tools: activeTools,
  stopWhen: stepCountIs(maxSteps),

  // AI SDK v6 권장: onError 콜백
  onError: (error) => {
    console.error('[Supervisor] Stream error:', error);
    // 구조화 로깅 서비스에 전송
  },

  // 기존 onStepFinish 유지
  onStepFinish: async ({ toolResults }) => {
    if (toolResults.length) {
      console.log('[Supervisor] Step finished with', toolResults.length, 'tool results');
    }
  },
});
```

### 3.3 Task Decomposition 검증 로직 추가
**파일**: `cloud-run/ai-engine/src/services/ai-sdk/agents/orchestrator.ts`

```typescript
async function validateDecomposition(decomposition: TaskDecomposition): Promise<TaskDecomposition> {
  const validatedSubtasks = decomposition.subtasks.filter(subtask => {
    const agentConfig = getAgentConfig(subtask.agent);

    if (!agentConfig) {
      console.warn(`[Orchestrator] Agent "${subtask.agent}" not found, removing subtask`);
      return false;
    }

    if (!isAgentAvailable(subtask.agent)) {
      console.warn(`[Orchestrator] Agent "${subtask.agent}" unavailable, removing subtask`);
      return false;
    }

    return true;
  });

  return {
    ...decomposition,
    subtasks: validatedSubtasks,
  };
}
```

---

## 테스트 계획

### 무료 티어 환경 테스트

| 테스트 | 검증 항목 | 통과 기준 |
|--------|----------|----------|
| Vercel Timeout | 10초 내 응답 시작 | 첫 청크 < 8초 |
| Cloud Run Cold Start | 초기 응답 시간 | < 5초 (cold), < 1초 (warm) |
| Memory Limit | 캐시 사용량 | < 200MB |
| Stream Recovery | 연결 끊김 후 재연결 | 3회 재시도 성공 |
| Message ID | 연속 Agent 응답 | 각각 고유 ID |

### 테스트 명령어
```bash
# TypeScript 컴파일 검사
npm run type-check

# 단위 테스트
npm run test:quick

# E2E 테스트 (Critical path)
npm run test:e2e:critical
```

---

## 롤백 계획

각 Phase 완료 후 개별 커밋하여 롤백 지점 확보:

```bash
# Phase 1 커밋
git commit -m "fix(critical): finalAnswer extraction, tool routing, cache LRU"

# Phase 2 커밋
git commit -m "fix(high): AbortController, EventSource cleanup, message ID"

# Phase 3 커밋
git commit -m "refactor(medium): dead code cleanup, onError callback"
```

문제 발생 시:
```bash
git revert <commit-hash>
```

---

## 일정 요약

| Phase | 작업 내용 | 예상 시간 | 우선순위 |
|:-----:|----------|:---------:|:--------:|
| 1 | Critical Issues 3건 | 2-3시간 | P0 |
| 2 | High Severity 3건 | 3-4시간 | P1 |
| 3 | Medium Severity 3건 | 2-3시간 | P2 |
| - | 테스트 및 검증 | 1-2시간 | - |
| **Total** | | **8-12시간** | |

---

## 승인 요청

위 계획에 대해 검토 후 진행 여부를 결정해 주세요.

- [ ] Phase 1만 진행
- [ ] Phase 1 + 2 진행
- [ ] 전체 (Phase 1 + 2 + 3) 진행
- [ ] 수정 요청

_작성일: 2026-01-24_
_작성자: Claude Opus 4.5_
