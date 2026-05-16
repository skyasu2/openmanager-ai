# AI 어시스턴트 구조 개선 계획서

> Owner: project
> Status: Approved
> Doc type: Plan
> Last reviewed: 2026-05-16
> Tags: refactor,ai-assistant,circuit-breaker,routing,hooks

---

## 배경 및 분석 범위

2026-05-15 AI 어시스턴트 아키텍처 전체를 전문가 관점에서 평가한 결과, **실현 가능한 개선 3건**과 **오해였던 문제 2건**을 확인했다. 2026-05-16 계획서 재검토에서 T2는 NLQ Pre-processing Redesign N1-5로 이관하고, 이 계획서는 T1/T3 두 건만 구현 대상으로 축소했다.

---

## 사전 검증 결과 요약

### ✅ 실제 문제로 확인된 항목

| # | 항목 | 근거 | 우선순위 |
|---|------|------|---------|
| T1 | Circuit Breaker Redis 미연결 | Redis 초기화 코드 존재하나 `AIServiceCircuitBreaker.execute()`가 인스턴스 변수만 사용, 분산 상태 읽기 미구현 | High |
| T2 | ~~`routing-policy.ts` 인라인 regex 배열~~ | `nlq-preprocessing-redesign-plan.md` N1-5에서 배열 자체를 제거하는 방식으로 흡수 | 이관 |
| T3 | `useAIChatCore` artifact 상태 혼재 | 601줄, artifact ref 5개 + artifact 상태 2개가 세션/스트림 상태와 혼재 | Medium |

### ❌ 재검토 후 문제 아님으로 판정된 항목

| 항목 | 판정 근거 |
|------|----------|
| "3-레이어 라우팅 결정 분산" | 각 레이어가 **다른 결정**을 함: Frontend = stream vs job(비동기 실행 방식), Cloud Run = single vs multi(에이전트 오케스트레이션). 직교(orthogonal) 결정이므로 통합 불필요. `SemanticIntentFrame`으로 cross-layer 힌트 전달도 이미 구현 완료. |
| "Artifact intent 클라이언트/서버 중복" | `tryHandleChatArtifactRequest()`가 내부에서 `/api/ai/artifact-intent` 서버 API를 호출. 중복이 아니라 클라이언트가 서버 API를 사용하는 정상 패턴. |

---

## 무료 티어 영향 분석

모든 작업은 **코드 구조 변경만**이며 외부 인프라 변경 없음.

| 플랫폼 | 현재 한도 | 이번 작업 영향 | 판정 |
|--------|----------|--------------|------|
| Vercel Pro | $20/mo, Standard build | 변경 없음 | ✅ 영향 없음 |
| Cloud Run | 1 vCPU, 512Mi, e2-medium | 변경 없음 | ✅ 영향 없음 |
| Upstash Redis | 500K cmd/월 | T1은 Redis-backed CB 연결을 추가하지 않고 현재 미사용 초기화 호출을 제거한다. 요청당 Redis ops 증가 없음 | ✅ 영향 없음 |
| Supabase | Free tier | 변경 없음 | ✅ 영향 없음 |

---

## 계약 (Contract)

### 변경 대상 파일

| Task | 파일 | 계약 |
|------|------|------|
| T1 | `src/lib/ai/circuit-breaker.ts` | 현재 circuit breaker가 in-memory 상태만 사용함을 코드 경로에서 명확화하고, Redis 초기화 호출로 분산 CB처럼 보이는 오해를 제거 |
| T1 | `src/lib/ai/circuit-breaker/state-store.ts` | Redis-backed store 연결점은 보존하되 현재 request path 미사용임을 주석/JSDoc으로 명시 |
| T3 | `src/hooks/ai/useAIChatCore.ts` | artifact loading/ref/reset 상태를 새 hook으로 이동하되 public hook 반환값과 chat send/session reset 동작은 유지 |
| T3 | `src/hooks/ai/core/useArtifactManager.ts` | artifact 관련 ref/state/reset API를 단일 객체로 제공 |

### 테스트 시나리오

- [ ] T1: circuit breaker fallback 동작과 기존 `circuit-breaker.test.ts`가 Redis 미설정/설정 상태 모두에서 기존 결과를 유지한다.
- [ ] T3: 새 세션 시작 시 artifact in-flight/ref/loading 상태가 한 번에 초기화된다.
- [ ] T3: artifact guidance/direct request 흐름의 로딩 상태와 abort controller 동작이 기존 UI 테스트에서 회귀하지 않는다.

---

## T1: Circuit Breaker Redis 미연결 수정

### 현상 및 근거

```typescript
// src/lib/ai/circuit-breaker.ts:282
export async function executeWithCircuitBreakerAndFallback<T>(...) {
  await ensureRedisStateStore(); // Redis 초기화 호출
  const breaker = aiCircuitBreaker.getBreaker(serviceName);
  const result = await breaker.execute(primaryFn); // ← 인스턴스 변수만 사용
}

// AIServiceCircuitBreaker.execute()는 아래 변수만 사용
private failures = 0;           // 인스턴스 로컬
private currentState = 'CLOSED'; // 인스턴스 로컬
// _defaultStateStore (Redis)는 never read
```

`state-store.ts` 주석에도 명시되어 있음:
> "Retained for Redis-backed store injection even though the current breaker implementation only tracks whether distributed state was initialized."

즉 Redis 초기화는 일어나지만 회로 차단기 상태 전이(`onSuccess`, `onFailure`)는 여전히 in-memory다.

### 선택지 분석

| 선택지 | 장점 | 단점 | 비용 |
|--------|------|------|------|
| **(A) In-memory 전용으로 명확화** | 코드 솔직, 라이선스 제거 단순 | 인스턴스 간 상태 공유 없음 유지 | 없음 |
| **(B) Redis 상태 저장소 실제 연결** | 진짜 분산 CB | 요청마다 Redis GET 추가 (~5ms), HALF_OPEN 경쟁 조건 처리 복잡 | Upstash ops 증가 (한도 내) |

**결정: (A) 채택**

Vercel 서버리스 환경에서 CB가 실제로 OPEN 전환되는 경우는 Cloud Run 전체 다운 시나리오다. 이 경우 fallback handler가 이미 작동하므로 인스턴스 간 상태 공유의 실익이 낮다. 매 요청마다 Redis GET을 추가하는 대신, 코드를 솔직하게 만드는 것이 유지보수 가치가 높다.

### 작업 범위

- [ ] **T1-1**: `executeWithCircuitBreakerAndFallback`에서 `ensureRedisStateStore()` 호출 제거
- [ ] **T1-2**: `circuit-breaker.ts` 및 `state-store.ts` 주석을 "in-memory only, 인스턴스 간 공유 없음" 으로 명확화
- [ ] **T1-3**: `RedisCircuitBreakerStore`와 `initializeRedisCircuitBreaker`는 **삭제하지 않음** — 향후 연결 시점의 연결점으로 보존하되, 현재 미사용임을 `@internal` JSDoc으로 표기
- [ ] **T1-4**: 기존 CB 테스트 (`circuit-breaker.test.ts`) 검증 통과 확인

**예상 영향 파일:**
- `src/lib/ai/circuit-breaker.ts`
- `src/lib/ai/circuit-breaker/state-store.ts`

---

## T2: ~~`routing-policy.ts` 인라인 regex 배열 상수화~~ → NLQ Redesign N1-5로 흡수

> **상태**: 이 태스크는 `nlq-preprocessing-redesign-plan.md` N1-5로 흡수됨.
> `multiAgentPatterns[]` / `contextGatedPatterns[]` 배열 자체가 N1에서 제거되므로 상수화 불필요.
> T2 작업은 건너뛰고 T1 → T3 순서로 진행.

이관된 원래 작업은 이 계획서의 활성 체크박스에서 제거한다. 이후 `routing-policy.ts`의 regex 배열을 건드릴 필요가 생기면 `nlq-preprocessing-redesign-plan.md`의 N1 계약을 먼저 보강한 뒤 진행한다.

---

## T3: `useAIChatCore` artifact 상태 분리

### 현상 및 근거

현재 601줄. 세션 관리, 스트림 상태, artifact 상태가 한 훅에 혼재한다:

```typescript
// artifact 전용 상태 (분리 대상)
const [artifactIsLoading, setArtifactIsLoading] = useState(false);
const artifactIntentInFlightRef = useRef(false);
const artifactInFlightRef = useRef(false);
const artifactRequestIdRef = useRef<string | null>(null);
const artifactAbortControllerRef = useRef<AbortController | null>(null);

// handleArtifactGuidanceCta: 이미 chat-artifact-guidance.ts로 분리됨
// tryHandleChatArtifactRequest: 이미 chat-artifact-guidance.ts에 있음
```

artifact 관련 ref 5개 + state 1개가 훅 내에 산재하며, `handleNewSession`에서 이들을 모두 수동으로 리셋해야 하는 패턴이 취약하다.

### 작업 범위

- [ ] **T3-1**: `useArtifactManager` 훅 생성 (`src/hooks/ai/core/useArtifactManager.ts`)
  - 관리 대상: `artifactIsLoading`, `artifactIntentInFlightRef`, `artifactInFlightRef`, `artifactRequestIdRef`, `artifactAbortControllerRef`
  - 반환: `{ isLoading, reset, refs }` 형태
- [ ] **T3-2**: `useAIChatCore`에서 artifact 상태 제거, `useArtifactManager` 사용으로 교체
- [ ] **T3-3**: `handleNewSession`의 artifact 수동 리셋을 `artifactManager.reset()` 단일 호출로 교체
- [ ] **T3-4**: 기존 `useAIChatCore.test.ts` 검증 통과 확인

**범위 제한:**
- `handleSendInput` 내 artifact 분기 로직 이동 금지 (범위 과대, 별도 작업)
- `handleArtifactGuidanceCta` 추가 분리 금지 (이미 guidance.ts 경유)

**예상 영향 파일:**
- `src/hooks/ai/useAIChatCore.ts`
- `src/hooks/ai/core/useArtifactManager.ts` (신규)

---

## SDD 게이트

plan 파일의 Status가 `Approved`로 변경된 이후에 구현을 시작한다.

각 태스크 커밋 순서:
```
1. test(spec): [태스크명] add failing tests before implementation
2. feat/refactor: [태스크명] implement to pass specs
```

단, T1은 순수 구조 정리(동작 변경 없음)이므로 refactor + test 동시 커밋 허용. T3는 hook state boundary 변경이므로 기존 DOM/unit 회귀 테스트를 먼저 보강한다.

---

## 검증 게이트 (전체 공통)

```bash
npm run type-check
npm run lint
npm run test:quick          # 최소 게이트
npm run test:contract       # AI 계약 테스트
npm run line-guard          # 800줄 초과 파일 확인
```

현재 활성 범위(T1/T3)는 Root App 변경이다. 이 계획서에서 이관된 T2/NLQ 작업으로 Cloud Run routing policy를 다시 건드리는 경우에만 추가로 실행한다:
```bash
cd cloud-run/ai-engine && npm run type-check && npm run test
```

---

## 작업 순서 및 의존성

```
T1 (CB 명확화) → 독립 작업, 먼저 처리
T3 (artifact 분리) → T1과 독립이나 리스크가 높으므로 별도 커밋으로 처리
```

T1 → T3 순서로 진행 권장. T2는 NLQ plan N1-5로 이관되었으므로 이 계획서에서 구현하지 않는다.

---

## 이번 작업에서 의도적으로 제외한 항목

| 항목 | 제외 이유 |
|------|----------|
| ML 기반 쿼리 분류기 | ONNX 런타임 추가 or LLM 분류 API = 비용 + 지연 발생. 현재 규모에서 ROI 없음 |
| Redis CB 실제 연결 | 매 요청 Redis GET 추가 (~5ms). 서버리스 환경에서 CB의 실제 이점 < 지연 비용 |
| 3-레이어 라우팅 통합 | 각 레이어가 직교 결정을 수행. `SemanticIntentFrame`으로 cross-layer 힌트 이미 구현 |
| Artifact intent 서버 통합 | 이미 단일 서버 API 호출 구조. 중복 없음으로 판정 |
| useAIChatCore 전체 재작성 | 601줄 → 목표 도달. 추가 분리는 T3 범위만 허용 |
