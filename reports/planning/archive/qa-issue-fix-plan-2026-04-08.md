# QA 이슈 분석 및 개선 작업 계획서

> 상태: 완료 후 아카이브
> 작성일: 2026-04-08
> 기준 QA 런: QA-20260407-0249 (broad, failed 2), QA-20260408-0251 (targeted, pass 6), QA-20260408-0252 (targeted, pass 7)
> 대상 버전: v8.11.0
> 아카이브 사유: 이 문서는 active 계획이 아니라 원인 분석 + 수정 방향 + 실행 결과를 함께 담은 완료 기록이므로 `reports/planning/archive/`로 이동함

---

## 최종 상태

- 이슈 1 `Cloud Run AI 첫 번째 요청 Rate Limit 초과`
  - 본 계획서의 제안과 달리 rate-limit 상향이 아니라 alert prefill 라우팅 수정과 스트리밍 계약 정합성 수정으로 해소됨
  - 관련 QA: `QA-20260408-0250`, `QA-20260408-0252`
- 이슈 2 `랜딩 첫 진입 bootstrap 인증 카피 재노출`
  - `AuthLoadingUI` 비가시 처리 수정 후 targeted production QA에서 비재현 확인
  - 관련 QA: `QA-20260408-0250`
- 이슈 3 `랜딩 비로그인 /api/system 401 콘솔 에러`
  - 본 문서 작성 시점의 검토 항목으로 남았고, 현재 tracker 기준 `wont-fix` 유지
- 이슈 4 `AI 응답 본문에 내부 분석 과정(도구명) 노출`
  - `orchestrator-agent-stream.ts`의 `tool_result` bubble-up 복구와 `analyst.ts`/`AnalysisBasisBadge.tsx` 개선으로 해소
  - 관련 QA: `QA-20260408-0252`

## 보관 메모

- 이 문서는 실행 전 계획서라기보다 incident/post-fix 메모에 가깝다.
- 이후 유사 문서는 active `reports/planning/*.md`에 장기간 두지 말고, 작업 종료 후 `archive/` 또는 `reports/qa/repro/` 성격에 맞게 이동한다.

---

## 요약

| # | 이슈 | 우선순위 | 현재 상태 | 영향 범위 |
|---|------|---------|----------|----------|
| 1 | Cloud Run AI 첫 번째 요청 Rate Limit 초과 | P1 | 간헐적 발생 | AI 응답 첫 시도 실패 |
| 2 | 랜딩 첫 진입 bootstrap 인증 카피 재노출 | P2 | 재발 가능 | 랜딩 첫 paint UX |
| 3 | 랜딩 비로그인 /api/system 401 콘솔 에러 | P1 | wont-fix 유지 중 | 콘솔 노이즈 |
| 4 | AI 응답 본문에 내부 분석 과정(도구명) 노출 | P1 | 구조적 미흡 | AI UX 핵심 품질 |

---

## 이슈 1: Cloud Run AI 첫 번째 요청 Rate Limit 초과 (P1)

### 현상
- QA-20260407-0249 broad QA에서 **첫 번째** AI 사이드바 프롬프트 전송 시 `Rate limit exceeded` 발생
- 재시도(즉시 1회)는 성공
- 직접 `/api/ai/supervisor/stream/v2` SSE 프로브는 `X-AI-Latency-Ms=292`로 정상
- `lb-haproxy` 서버 context에서 발생 → 로드밸런서 경유 요청

### 근본 원인

```
[Vercel Serverless] → X-API-Key: CLOUD_RUN_API_SECRET → [Cloud Run rate-limiter]
```

`cloud-run/ai-engine/src/middleware/rate-limiter.ts:176-182`:
```typescript
function extractClientKey(c: Context): string {
  const apiKey = c.req.header('X-API-Key');
  if (apiKey) {
    // 단일 secret → 모든 Vercel 요청이 동일한 key hash 사용
    const hash = createHash('sha256').update(apiKey).digest('hex').slice(0, 16);
    return `key:${hash}`;
  }
  ...
}
```

**문제**: 모든 Vercel 서버리스 인스턴스가 단일 `CLOUD_RUN_API_SECRET`을 공유  
→ rate limit 버킷이 `key:{hash(secret)}:/supervisor` 하나로 집중  
→ supervisor 한도: **1분에 10회** (`rate-limiter.ts:145`)  
→ 여러 사용자 동시 사용 시 또는 QA 반복 요청 시 한도 초과 가능

### 영향
- 첫 번째 AI 요청이 `429 Too Many Requests` 반환
- `stream/v2/route.ts`에서 fallback 처리 있으나 UX 지연 발생
- 재시도는 성공하지만 "Rate limit exceeded" 메시지가 사용자에게 노출 가능

### 개선 방안

#### 방안 A: Rate Limit 한도 상향 (즉시, 저위험) ✅ 권장
**파일**: `cloud-run/ai-engine/src/middleware/rate-limiter.ts:140-148`
```typescript
// Before
supervisor: {
  maxRequests: 10,
  windowMs: 60 * 1000,
  keyPrefix: 'rl:supervisor',
},

// After
supervisor: {
  maxRequests: 30,   // 10 → 30 (Free Tier 내 충분히 여유)
  windowMs: 60 * 1000,
  keyPrefix: 'rl:supervisor',
},
```

**근거**: 단일 키 공유 구조에서 실제 사용자 동시 접속 패턴 기준 30회/분이 적절

#### 방안 B: 세션 ID 기반 rate limit 분리 (중기, 보통 위험)
**파일**: `cloud-run/ai-engine/src/middleware/rate-limiter.ts` + `src/lib/ai-proxy/proxy.ts`

```typescript
// proxy.ts에서 세션 ID 헤더 추가
headers: {
  'X-API-Key': config.apiSecret,
  'X-Session-ID': sessionId, // 클라이언트 세션 기반
}

// rate-limiter.ts extractClientKey 수정
const sessionId = c.req.header('X-Session-ID');
if (sessionId && apiKey) {
  // 세션별 rate limit: 각 사용자가 독립적 버킷
  return `key:${hash}:session:${sessionId.slice(0, 8)}`;
}
```

**근거**: 사용자별 독립 rate limit → 특정 사용자 과다 요청이 다른 사용자 영향 없음

#### 방안 C: 클라이언트 측 자동 재시도 강화 (즉시, 저위험)
**파일**: `src/app/api/ai/supervisor/stream/v2/route.ts`

현재 429 응답 처리 확인 후, Retry-After 헤더 기반 대기 후 자동 재시도 추가

### 권장 실행 순서
1. **즉시**: 방안 A (rate limit 10→30) — 코드 1줄, Cloud Run 재배포 필요
2. **다음 스프린트**: 방안 B (세션 ID 분리) — 근본 해결
3. **필요 시**: 방안 C (클라이언트 재시도) — 방어 계층 추가

---

## 이슈 2: 랜딩 첫 진입 bootstrap 인증 카피 재노출 (P2)

### 현상
- QA-20260407-0249에서 "Production first paint twice showed visible '인증 확인 중... (Vercel 환경)' copy"
- `showCopy={false}` 설정 후 tracker `completed` 처리했으나 재발
- QA-20260408-0251(오늘)에서는 미재현 → 간헐적 발생

### 근본 원인 분석

**파일**: `src/app/page.tsx:73-85`, `src/app/main/hooks/useLandingPageState.ts:21`

```
AuthLoadingUI (showCopy=false) ← shouldShowLoading=true ← authLoading=true
                                                      ↑
                                          useInitialAuth.state.currentStep
                                          = 'auth-check' | 'user-fetch'
```

`AuthLoadingUI`에서 `showCopy=false`이면 텍스트는 렌더링 안 함 (`aria-label`만)  
→ **시각적 노출 불가** — 그런데 왜 QA에서 보였나?

**실제 원인 추정**:
1. Hydration mismatch: SSR에서 `shouldShowLoading`이 true로 렌더링 → 클라이언트 hydration 전에 잠깐 전체 화면 로딩 UI 노출
2. `showCopy=false`가 적용되기 전 이전 렌더링 캐시가 남아있는 경우
3. 다른 코드 경로에서 `AuthLoadingUI`가 `showCopy=true`로 호출되는 케이스

**검증이 필요한 지점**: `src/app/main/hooks/useLandingPageState.ts`의 `shouldShowLoading` 초기값

### 개선 방안

#### 방안 A: shouldShowLoading 초기값 false (즉시)
**파일**: `src/app/main/hooks/useLandingPageState.ts`

```typescript
// Before: authLoading이 true인 초기 상태를 그대로 반영
const { isLoading: authLoading, ... } = useInitialAuth();

// After: mount 후에만 loading 활성화
const [mounted, setMounted] = useState(false);
useEffect(() => { setMounted(true); }, []);

const shouldShowLoading = mounted && authLoading && !isSystemStarted;
```

**근거**: SSR/hydration 동안 로딩 UI 비노출로 첫 paint FOUC 제거

#### 방안 B: useInitialAuth 초기 step을 'complete'로 설정 (중기)
**파일**: `src/hooks/useInitialAuth.ts`

```typescript
// 초기 state에서 auth-check을 즉시 시작하지 않고
// componentDidMount 이후에만 인증 프로세스 시작
const initialState = {
  currentStep: 'complete' as const, // SSR에서는 완료 상태로 시작
  isLoading: false,
  ...
};
```

**근거**: Next.js App Router에서 Server Component가 auth를 사전 처리하므로 클라이언트 auth-check 단계 불필요

### 권장 실행 순서
1. **즉시**: 방안 A — `mounted` 가드 추가 (5분 작업)
2. **검토**: `useInitialAuth` 초기 step이 왜 'auth-check'부터 시작하는지 flow 재확인

---

## 이슈 3: 랜딩 비로그인 /api/system 401 콘솔 에러 (P1 wont-fix)

### 현상
- 비로그인 상태에서 랜딩 페이지 진입 시 `/api/system`으로 인증 없이 요청 → `401 Unauthorized` 콘솔 에러
- 현재 `wont-fix` 처리 중 (포트폴리오 운영성 규칙)

### 근본 원인

**파일 추정**: `src/components/system/SystemBootstrap.tsx` 또는 인증 확인 관련 훅

비로그인 상태에서도 `/api/system`을 호출하는 코드 경로 존재 → 서버에서 401 반환

### 개선 방안

#### 방안 A: 호출 전 인증 상태 체크 (권장)
```typescript
// Before: 무조건 호출
const res = await fetch('/api/system');

// After: 인증된 상태일 때만 호출
if (isAuthenticated) {
  const res = await fetch('/api/system');
}
```

#### 방안 B: /api/system에서 401 대신 빈 응답 반환 (비인증 허용)
게스트 접근을 명시적으로 허용하는 경우 사용

### 권장 실행 순서
- **wont-fix 재검토**: 콘솔 노이즈가 개발자 도구에서 지속 노출되므로 방안 A(호출 전 가드) 검토

---

---

## 이슈 4: AI 응답 본문에 내부 분석 과정(도구명) 노출 (P1)

### 현상

**응답 본문** (QA-20260408-0251에서 실제 캡처):
```
## 분석 결과
1. 현황 요약: CPU 82%, 경고 임계값 초과
2. 분석 과정:
   - detectAnomalies 도구로 api-was-dc1-01 서버의 CPU 메트릭 이상 여부를 확인했습니다.
   - correlateMetrics 도구로 CPU와 다른 메트릭 간의 상관관계를 분석했습니다.
3. 추정 원인: ...
4. 권장 조치: ...
```

**"분석 근거" 버튼 펼쳤을 때** (실제):
```
[응답 과정]
Trace ID: d6dd755a3442240fc18649af8b586ef1
데이터: 일반 대화 응답
엔진: Streaming AI
```
→ **도구 결과 요약, 분석 단계, 에이전트 경로 없음** — trace ID 텍스트만 노출

**사용자가 원하는 구조**:
- **응답 본문**: 현황 요약 → 추정 원인 → 권장 조치 (실질적 답변만)
- **"분석 근거" 하단 영역**: 어떤 분석 단계를 거쳤는지 사용자 친화적으로 표시

### 근본 원인 — 3개 레이어 복합 문제

#### 레이어 0 (핵심 근본): LLM이 도구를 실제로 호출하지 않음

`message-helpers.ts:557`에서 `dataSource` 결정 로직:
```typescript
const hasServerAnalysisEvidence = completedToolNames.some((toolName) =>
  SERVER_ANALYSIS_TOOL_NAMES.has(toolName)   // detectAnomalies, correlateMetrics 포함
);
// ...
dataSource = hasServerAnalysisEvidence ? '서버 실시간 데이터 분석' : '일반 대화 응답';
```

실제 응답의 `dataSource = "일반 대화 응답"` → `completedToolNames = []` → **도구 실제 호출 없음**

즉 LLM이 `detectAnomalies`, `correlateMetrics`를 실제로 실행하지 않고 텍스트로 허구 "분석 과정"을 작성한 것 **(Hallucination)**.

**왜 도구를 호출하지 않았나? — 3단계 추적**

**Step 1. 라우팅 모드 결정** (`supervisor-routing.ts:selectExecutionMode`)

```typescript
// 멀티 에이전트 트리거 패턴 중:
/분석.*원인|원인.*분석|근본.*원인|rca|root.*cause/i
```

질문 "…현재 **원인**과…방법을 **분석해줘**" → `/원인.*분석/i` 패턴 **매칭** → `'multi'` 모드 진입

**Step 2. 멀티 에이전트 경로에서 tool results yield 코드 자체가 없음** ← 버그

`orchestrator-agent-stream.ts:280-294`:
```typescript
// tool_call은 yield — 프론트엔드에 "도구 호출 중" 알림 전달 ✅
yield { type: 'tool_call', data: { name: toolCall.toolName } };

// tool_result는 yield 없음 — 내부 배열에만 수집하고 상위 stream으로 전파 ❌
collectedToolResults.push({
  toolName: toolResult.toolName,
  result: toolResultOutput,
});
// yield { type: 'tool_result', ... }  ← 이 코드가 없음!
```

단일 에이전트 경로(`supervisor-stream.ts:498-502`)에는 동일 yield가 있음:
```typescript
// 단일 에이전트에서는 정상 전송
yield { type: 'tool_result', data: { toolName: tr.toolName, result: trOutput } };
```

→ **단일 에이전트 ↔ 멀티 에이전트 구현 불일치** (단순 코드 누락 버그)

**Step 3. 결과: toolParts = [] → dataSource = "일반 대화 응답"**

`message-helpers.ts:537-557`:
```typescript
const completedToolNames = getCompletedToolNames(toolParts);   // [] (비어있음)
const hasServerAnalysisEvidence = completedToolNames.some(     // false
  toolName => SERVER_ANALYSIS_TOOL_NAMES.has(toolName)
);
dataSource = '일반 대화 응답';  // ← 최종 판정
```

LLM은 실제 실행 결과 없이 instruction 포맷("2. 분석 과정")에 따라 **허구 텍스트 생성**: "detectAnomalies 도구로 확인했습니다…"

```
실제 흐름:
query → selectExecutionMode → 'multi' → orchestrator
                                       → sub-agent (Analyst) 내부에서 detectAnomalies 실행
                                       → tool_result가 orchestrator 내부에서 소비됨
                                       → 상위 stream으로 전파(bubble up) 되지 않음
                                       → data-tool-result SSE 없음
                                       → 프론트엔드 toolParts = []

의도된 흐름:
query → selectExecutionMode → 'multi' → orchestrator
                                       → sub-agent tool_result → yield 'tool_result'
                                       → supervisor-stream-response data-tool-result 전송
                                       → 프론트엔드 toolParts = [{detectAnomalies}, {correlateMetrics}]
                                       → toolResultSummaries = ["이상 탐지: CPU 82% 이상 감지"]
                                       → "분석 근거" 영역에 표시
```

#### 레이어 1 - AI Instruction 문제** (`cloud-run/ai-engine/src/services/ai-sdk/agents/config/instructions/analyst.ts:79`)

```typescript
// 현재: 응답 포맷에 "2. 분석 과정" 섹션 명시적으로 지시
## 📋 응답 형식 (finalAnswer)
1. **현황 요약** — 이상 서버 수, 주요 메트릭 수치
2. **분석 과정** — 어떤 단서를 추적했는지 간략히 (1-2줄)  ← 문제
3. **근본 원인** — 추정 원인 + 인과 체인
4. **권장 조치** — 즉시 실행 가능한 명령어/조치
```

AI는 이 instruction을 따라 응답 본문에 `detectAnomalies 도구로...` 같은 내부 처리 과정을 그대로 텍스트로 작성함.

**레이어 2 - 프론트엔드 "분석 근거" 영역 미활용**

`src/components/ai/AnalysisBasisBadge.tsx:211-230`: 
- `toolResultSummaries`가 있으면 "도구 결과 요약" 섹션에 단계별 표시 기능 이미 구현됨
- `TOOL_LABELS`로 도구명 한글 변환도 준비됨: `detectAnomalies` → `이상 탐지`, `correlateMetrics` → `메트릭 상관 분석`
- **그런데 현재 응답에서 `toolResultSummaries` 데이터가 stream annotation으로 전달되지 않아 영역이 비어있음**

### 개선 방안

#### 방안 A: Instruction에서 "분석 과정" 섹션 제거 + 3섹션으로 단순화 (즉시, 저위험) ✅ 권장

**파일**: `cloud-run/ai-engine/src/services/ai-sdk/agents/config/instructions/analyst.ts:76-84`

```typescript
// Before (4섹션, 도구명 노출)
## 📋 응답 형식 (finalAnswer)
아래 4개 섹션 순서를 유지하세요 (8-14줄 권장):
1. **현황 요약** — 이상 서버 수, 주요 메트릭 수치 (1-2줄)
2. **분석 과정** — 어떤 단서를 추적했는지 간략히 (1-2줄)
3. **근본 원인** — "추정 원인: [가설] (신뢰도: N%)" + 인과 체인 (2-4줄)
4. **권장 조치** — 즉시 실행 가능한 명령어/조치 (2-4줄)

// After (3섹션, 결과 중심)
## 📋 응답 형식 (finalAnswer)
아래 3개 섹션 순서를 유지하세요 (6-10줄 권장):
1. **현황 요약** — 이상 서버 수, 주요 메트릭 수치 (1-2줄)
2. **근본 원인** — "추정 원인: [가설] (신뢰도: N%)" + 인과 체인 (2-3줄)
3. **권장 조치** — 즉시 실행 가능한 명령어/조치 (2-3줄)

❌ 금지: 응답 본문에 도구명(detectAnomalies, correlateMetrics 등) 직접 언급
✅ 허용: 분석 결과와 수치만 인용 ("CPU 이상 감지됨", "메모리-CPU 상관관계 r=0.92")
```

**동일 변경을 NLQ에도 적용**: `nlq.ts` 응답 지침에도 도구명 노출 금지 문구 추가

#### 방안 B: stream annotation으로 toolResultSummaries 전달 강화 (중기, 보통 위험)

**현재 흐름**:
```
AI Engine 도구 실행 → 결과를 텍스트로 응답에 포함 (문제)
```

**개선 흐름**:
```
AI Engine 도구 실행 → toolResultSummaries를 stream annotation으로 전달
                  → 프론트엔드 "분석 근거" 영역에서 렌더링
                  → 응답 본문에는 결과만 포함
```

**관련 파일**:
- `cloud-run/ai-engine/src/services/ai-sdk/supervisor-stream.ts` — annotation 전송부
- `src/hooks/ai/utils/stream-data-handler.ts` — annotation 파싱부
- `src/hooks/ai/utils/message-helpers.ts:531` — `analysisBasis` 생성부

`toolResultSummaries` 데이터 구조 (`src/stores/useAISidebarStore.ts`):
```typescript
interface ToolResultSummary {
  toolName: string;    // 예: "detectAnomalies"
  label: string;       // 예: "이상 탐지" (TOOL_LABELS로 변환)
  summary: string;     // 예: "api-was-dc1-01 CPU 82% 이상 감지됨"
  status: 'completed' | 'failed';
}
```

#### 방안 C: "분석 근거" 섹션 라벨 및 구조 개선 (즉시, 저위험)

현재 접이식 버튼이 닫혀 있을 때 표시되는 요약:
```
데이터: 일반 대화 응답 · 엔진: Streaming AI
```

개선 후:
```
분석 단계: 이상 탐지 · 메트릭 상관 분석 | 엔진: Streaming AI
```

**파일**: `src/components/ai/AnalysisBasisBadge.tsx:103-113` (`collapsedSummaryParts` 배열 재구성)

```typescript
// Before: 도구 정보가 "도구: 이상 탐지 외 1" 형태로 표시
const collapsedSummaryParts = [
  basis.dataSource ? `데이터: ${basis.dataSource}` : null,
  firstMeaningfulTool ? `도구: ${getToolLabel(firstMeaningfulTool)}...` : null,
  basis.engine ? `엔진: ${basis.engine}` : null,
];

// After: "분석 단계"로 레이블 변경, 도구명은 모두 나열
const collapsedSummaryParts = [
  meaningfulTools?.length
    ? `분석 단계: ${meaningfulTools.slice(0, 2).map(getToolLabel).join(' · ')}${meaningfulTools.length > 2 ? ` 외 ${meaningfulTools.length - 2}` : ''}`
    : (basis.dataSource ? `데이터: ${basis.dataSource}` : null),
  basis.engine ? `엔진: ${basis.engine}` : null,
];
```

### 권장 실행 순서

1. **즉시**: 방안 A — `analyst.ts` instruction 수정 (분석 과정 섹션 제거, 도구명 언급 금지)
2. **즉시**: 방안 C — `AnalysisBasisBadge.tsx` collapsedSummaryParts 레이블 개선
3. **다음 스프린트**: 방안 B — `toolResultSummaries` stream annotation 전달 강화

### 예상 결과 (방안 A+C 적용 후)

**응답 본문** (사용자가 실제로 원하는 답변만):
```
## 분석 결과

1. 현황 요약: CPU 82%로 경고 임계값(80%) 초과, 메모리 상관관계(r=0.92) 관찰

2. 추정 원인: 메모리 부족으로 인한 페이지 캐싱 증가 (신뢰도: 80%)
   - 인과 체인: 메모리 사용 증가 → CPU 사용 증가

3. 권장 조치:
   - 즉시: top 또는 htop으로 메모리 사용 상위 프로세스 확인
   - 장기: 메모리 업그레이드 또는 불필요 프로세스 최적화
```

**"분석 근거" 버튼 (닫힌 상태)**:
```
분석 단계: 이상 탐지 · 메트릭 상관 분석 | 엔진: Streaming AI
```

**"분석 근거" 영역 (펼친 상태)**:
- 이상 탐지: api-was-dc1-01 CPU 82% 이상 감지됨
- 메트릭 상관 분석: CPU-Memory 상관관계 r=0.92 확인됨
- Trace ID: d6dd755a...

---

## 전체 실행 계획

### Phase 1: 즉시 수정 (2-3시간)

| 순서 | 파일 | 작업 | 예상 시간 |
|------|------|------|----------|
| 1 | `cloud-run/ai-engine/src/middleware/rate-limiter.ts` | supervisor maxRequests: 10 → 30 | 5분 |
| 2 | `src/app/main/hooks/useLandingPageState.ts` | shouldShowLoading에 mounted 가드 추가 | 15분 |
| 3 | `cloud-run/ai-engine/src/.../instructions/analyst.ts` | "분석 과정" 섹션 제거, 도구명 언급 금지 추가 | 20분 |
| 4 | `src/components/ai/AnalysisBasisBadge.tsx` | collapsedSummaryParts "분석 단계" 레이블로 개선 | 15분 |
| 5 | Cloud Run 재배포 | `cloud-run/ai-engine/deploy.sh` | 10분 |
| 6 | Vercel 재배포 | `git push gitlab main` (CI 경유) | 7분 |

### Phase 2: 검증 (30분)
- QA-targeted: rate limit 재현 시도 (빠른 연속 요청 3회)
- QA-targeted: 랜딩 첫 paint 5회 새로고침으로 bootstrap copy 재현 시도
- `npm run qa:record` 결과 기록

### Phase 3: 근본 해결 검토 (다음 스프린트)
- Rate limit: 세션 ID 기반 분리 (방안 B)
- Bootstrap: `useInitialAuth` SSR/클라이언트 분리 설계

---

## 참조

| 항목 | 위치 |
|------|------|
| rate-limiter | `cloud-run/ai-engine/src/middleware/rate-limiter.ts:140-148` |
| supervisor config | `cloud-run/ai-engine/src/middleware/rate-limiter.ts:145` |
| AuthLoadingUI | `src/components/shared/AuthLoadingUI.tsx:44-100` |
| useLandingPageState | `src/app/main/hooks/useLandingPageState.ts:21,64` |
| useInitialAuth | `src/hooks/useInitialAuth.ts:195-205` |
| page.tsx (landing) | `src/app/page.tsx:73-85` |
| analyst instruction | `cloud-run/ai-engine/src/services/ai-sdk/agents/config/instructions/analyst.ts:76-84` |
| NLQ instruction | `cloud-run/ai-engine/src/services/ai-sdk/agents/config/instructions/nlq.ts` |
| AnalysisBasisBadge | `src/components/ai/AnalysisBasisBadge.tsx:103-113` (collapsedSummaryParts) |
| TOOL_LABELS | `src/components/ai/AnalysisBasisBadge.tsx:28-46` |
| toolResultSummaries | `src/stores/useAISidebarStore.ts` (ToolResultSummary 타입) |
| stream annotation | `cloud-run/ai-engine/src/services/ai-sdk/supervisor-stream.ts` |
| 실패 QA 증거 | `reports/qa/runs/2026/qa-run-QA-20260407-0249.json` |
