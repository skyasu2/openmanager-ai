> Owner: project
> Status: Approved
> Doc type: Plan
> Last reviewed: 2026-05-16
> Tags: ai,nlq,routing,security,query-guard,intent-frame,log-input,architecture

# NLQ Pre-processing Redesign Plan

---

## 아키텍처 위치 결정 (핵심 선행 판단)

### LLM Gateway 권고 패턴 vs 이 프로젝트 제약

일반적인 LLM Gateway 패턴은 `intent classification` / `entity extraction`을 AI 서버 쪽에 모으는 방향이지만, 이 프로젝트는 Cloud Run `min-instances=0`을 Free Tier 하드가드로 유지한다. 따라서 warm instance 전제를 필요로 하는 배치는 단순 적용이 불가하다.

| 판단 기준 | 업계 권고 전제 | 이 프로젝트 실제 |
|----------|--------------|----------------|
| Cloud Run min-instances | 최소 1개 warm | **0 (FREE_TIER_MIN_INSTANCES=0 하드가드)** |
| Cold start 시간 | warm 상태 가정 | 5~20초 (cold 시) |
| Clarification 다이얼로그 | Cloud Run 응답 후 가능 | **Cloud Run 호출 전에 표시해야 UX 성립** |
| Cloud Run vCPU-seconds | 여유 있음 | 180,000/월 한도, entity extraction도 소비 |
| Groq entity extraction 레이턴시 | — | ~200ms (Vercel 측에서 독립 호출) |

**결론**: entity extraction LLM 호출(Groq)은 **Vercel BFF에 유지**한다. Cloud Run으로 옮기면:
- Cold start 중 clarification dialog가 5~20초 지연 → UX 붕괴
- Cloud Run vCPU-seconds를 entity extraction에 소비 → 주 응답 예산 감소
- 구조 개선 효과(routing trust)는 Cloud Run이전 없이도 달성 가능

### 확정 레이어 배치

```
Browser (Client)
  ├─ off-domain guard     [로컬 regex, ~0ms] ← 기존 유지
  ├─ [N0] 입력 길이 UX guard (10,000자 hard cap, 8,000자 warning)
  └─ extractEntitiesCached 호출 결정         ← 기존 유지

Vercel BFF (Node.js runtime — Edge 금지)
  ├─ [신규] QueryGuard    [기계적 필터: 길이·XSS·공격패턴·입력유형 분류]
  ├─ Groq entity extraction LLM              ← 기존 위치 유지
  ├─ Clarification 판단                     ← 기존 위치 유지 (Cloud Run 호출 전)
  └─ intentFrame → Cloud Run 요청 body 포함

Cloud Run AI Engine
  ├─ [핵심 수정] selectExecutionMode() → intentFrame.executionMode primary 신뢰
  ├─ [추가] Prompt injection 탐지 (defense-in-depth, 두 번째 레이어)
  └─ [추가] log_paste inputType → multi 강제 + Analyst 컨텍스트 주입
```

> **Edge Runtime 금지**: NLQ 목적에 Edge runtime은 사용 불가.
> Node.js 서브셋이라 AI SDK 내부 의존성·네이티브 모듈 동작 안 함.
> NLQ route와 supervisor stream v2 모두 Node.js runtime(기본값) 유지.

---

## 현재 파이프라인 문제 진단

### 코드 기준 실제 흐름

```
Browser
  ├─ classifyQuery()           [로컬 regex]
  ├─ extractEntitiesCached()   [fetch → /api/ai/nlq/extract-entities → Groq LLM]
  │    └─ intentFrame → refs.semanticIntentFrame.current 저장
  └─ append(msg, { body: { frame, originalQuery } })
        ↓
Vercel BFF (/api/ai/supervisor/stream/v2)
  ├─ withAuth + withRateLimit
  ├─ sanitizeInput()            [security.ts — 여기서만 공격 탐지]
  ├─ intentFrame: z.unknown().optional()  ← pass-through, 검증 없음
  └─ Cloud Run 프록시
        ↓
Cloud Run AI Engine
  ├─ selectExecutionMode()      [regex 15개+, intentFrame 거의 무시]  ← 핵심 버그
  ├─ supervisorDomainEvidence → readIntentFrame()  [여기서야 frame 사용]
  └─ single/multi agent 실행
```

### 확인된 문제 4가지

| # | 문제 | 현상 |
|---|------|------|
| P1 | **LLM 결과를 Cloud Run regex가 재심사** | intentFrame이 전달되나 `selectExecutionMode()`가 자체 regex 15개+로 덮어씀. LLM 분석 낭비 |
| P2 | **regex 오타 예외 처리 수동 누적** | `서벼`, `썹`, `servr`, `sever`, `trubleshoot` 등 수동 관리. 새 오타마다 패턴 추가 |
| P3 | **공격 패턴 탐지가 NLQ 레이어 부재** | `security.ts` injection 탐지가 supervisor에만 적용. `/api/ai/nlq/extract-entities`는 무방비로 Groq 도달 |
| P4 | **장문·로그 입력 처리 미정의** | NLQ route 길이 제한 없음. 에러 로그 붙여넣기 시 160-token 한도 내 추출 → 실패 |

---

## 개선 파이프라인

```
Browser
  ├─ [N0] ChatInputArea maxLength=10,000 + warning=8,000
  └─ 기존 동일 (off-domain guard → extractEntitiesCached 호출 결정)
        ↓
/api/ai/nlq/extract-entities (Vercel BFF)
  ├─ [N2] QueryGuard.runQueryGuard()
  │    ├─ 공격 패턴 → block, Groq 호출 없음
  │    ├─ log_paste → 로그 추출 + 요약 prompt
  │    └─ oversized → 500자 truncate
  └─ [N1] Groq LLM (항상, local regex fast-path 제거)
       → SemanticIntentFrame + executionMode 슬롯
        ↓
Vercel BFF → Cloud Run (intentFrame + inputType 전달)
        ↓
Cloud Run AI Engine
  ├─ [N1] selectExecutionMode() → DomainIntentFrame.confidence >= 0.8이면 executionMode 우선
  ├─ [N3] inputType === 'log_paste' → multi 강제 + logExtract 컨텍스트 주입
  └─ [보안 강화] prompt injection defense-in-depth (두 번째 레이어 추가)
```

---

## 승인 계약 (2026-05-16)

이 계획은 Root BFF schema, Cloud Run supervisor metadata, NLQ 보안 guard를 함께 바꾸는 **계약 변경**이다. 아래 계약을 기준으로 `Status: Approved`로 전환하며, 구현은 SDD 순서로 failing test 커밋을 먼저 만든다.

### 선행 failing test assertion

| Task | 테스트 파일 | 기대 assertion |
|------|-------------|----------------|
| N0 | `src/components/ai-sidebar/ChatInputArea.test.tsx` | textarea에 `maxLength=10000`이 전달되고 8,000자 이상에서 경고 상태가 표시된다 |
| N1 | `src/lib/ai/entity-extractor.test.ts` | `SemanticIntentFrame.executionMode`가 `single`/`multi`/`unknown`만 허용되고 normalize 과정에서 보존된다 |
| N1 | `src/lib/ai/semantic-intent-frame.test.ts` | Root `confidence: 90`이 Cloud Run `confidence: 0.9`로 정규화되고 `executionMode`가 metadata에 포함된다 |
| N1 | `cloud-run/ai-engine/src/domains/monitoring/routing-policy.test.ts` | `intentFrame.executionMode='single', confidence=0.9`이면 regex상 multi 문구가 있어도 single을 반환한다 |
| N1 | `cloud-run/ai-engine/src/domains/monitoring/routing-policy.test.ts` | `confidence < 0.8`, `executionMode='unknown'`, frame 없음은 기존 regex fallback을 사용한다 |
| N2 | `src/lib/ai/query-guard.test.ts` | high-risk injection은 `verdict='block'`, medium-risk는 `sanitize`, log/mixed/oversized는 정해진 길이로 분류된다 |
| N2 | `src/app/api/ai/nlq/extract-entities/route.test.ts` | blocked query는 `generateText`를 호출하지 않고 `{ blocked: true, confidence: 0 }`을 반환한다 |
| N3 | `src/app/api/ai/supervisor/schemas.test.ts` | `metadata.inputType`/`metadata.logExtract`가 허용되고 길이 초과 값은 거부 또는 truncate 계약을 따른다 |
| N3 | `cloud-run/ai-engine/src/services/ai-sdk/supervisor-semantic-metadata.test.ts` | Cloud Run이 `inputType`, `logExtract`, `intentFrame.executionMode`를 normalize한다 |
| N3 | `cloud-run/ai-engine/src/domains/monitoring/routing-policy.test.ts` | `inputType='log_paste'`는 `executionMode`/regex보다 우선해 multi를 반환한다 |

### Legacy compatibility

| 입력 상태 | 동작 |
|-----------|------|
| `intentFrame` 없음 | 현재 `selectExecutionMode(query, analysisMode)` regex fallback 유지 |
| `intentFrame.executionMode` 없음 | 기존 클라이언트/세션으로 보고 regex fallback 유지 |
| `intentFrame.confidence < 0.8` | frame은 evidence hint로만 보존하고 실행 모드는 regex fallback |
| `intentFrame.executionMode === 'unknown'` | 실행 모드는 regex fallback |
| invalid frame shape | `semantic_frame_invalid` reason code만 남기고 request는 기존 방식으로 진행 |
| formatting-only report request | frame이 multi여도 기존 예외처럼 single 유지 |

### 길이와 민감정보 제한

| 필드 | 제한 | 처리 |
|------|------|------|
| UI input | 10,000자 hard cap, 8,000자 warning | `ChatInputArea`에서 `maxLength`와 카운터/경고 표시 |
| `QueryGuard.sanitizedQuery` | 500자 | NLQ LLM prompt 전용. oversized/log 입력은 요약 prompt로 변환 |
| `QueryGuard.fullQuery` | 10,000자 | supervisor 본문으로 전달. 기존 `sanitizeInput()`과 같은 상한 |
| `logExtract` | 8,000자 또는 80줄 중 먼저 도달하는 값 | ERROR/WARN/stack 중심으로 추출, 민감정보 마스킹 후 metadata 전달 |
| `metadata.inputType` | enum only | `natural_query`, `log_paste`, `mixed`, `oversized` 외 값은 drop |
| 민감정보 | API key/token/password/secret 패턴 | QueryGuard와 supervisor 보안 레이어 양쪽에서 `[REDACTED]` |

### QueryGuard blocked response 계약

`/api/ai/nlq/extract-entities`는 high-risk injection에서 HTTP 200으로 아래 형태를 반환한다. 이는 clarification 실패가 아니라 **사용자 입력 차단**이다.

```json
{
  "confidence": 0,
  "blocked": true,
  "blockReason": "prompt_injection_high",
  "message": "입력 내용이 서버 모니터링 AI가 처리할 수 없는 형식입니다. 다른 표현으로 다시 시도해주세요."
}
```

Client는 `blocked: true`를 받으면 clarification을 열지 않고 전송을 중단하며 동일 메시지를 표시한다. Supervisor route에도 기존 `securityCheck()`를 유지해 defense-in-depth를 보장한다.

---

## 무료 티어 영향 분석

| 플랫폼 | 영향 | 판정 |
|--------|------|------|
| Groq | metric_peak fast-path 제거 → 소수 케이스가 LLM 경유 전환. 500K TPD 대비 무시 | ✅ |
| Vercel | NLQ route에 로컬 QueryGuard 추가, LLM 호출 수 변경 없음 | ✅ |
| Cloud Run | selectExecutionMode() 단순화. LLM 추가 호출 없음 | ✅ |
| Upstash Redis | 변경 없음 | ✅ |

---

## N0: 채팅 입력 길이 UX guard

**변경 범위**
- `src/components/ai-sidebar/ChatInputArea.tsx`
- `src/components/ai-sidebar/ChatInputArea.test.tsx`

**태스크**
- [ ] **N0-1**: `AutoResizeTextarea` 호출에 `maxLength={10000}` 전달
- [ ] **N0-2**: 8,000자 이상 warning, 10,000자 도달 시 hard cap 안내
- [ ] **N0-3**: 기존 session counter와 충돌하지 않도록 하단 힌트 우선순위 정리

**판단**: 서버 `MAX_INPUT_LENGTH=10000`과 같은 hard cap을 UI에도 노출해 대형 로그 붙여넣기 실패를 조기에 설명한다. N2/N3의 log handling은 10,000자 이내 입력을 대상으로 한다.

---

## N1: LLM-first 라우팅 (regex routing 교체)

### 변경 범위

**[Root] SemanticIntentFrame에 executionMode 슬롯 추가**

```typescript
// src/lib/ai/entity-extractor.ts
export const SEMANTIC_EXECUTION_MODES = ['single', 'multi', 'unknown'] as const;
export type SemanticExecutionMode = (typeof SEMANTIC_EXECUTION_MODES)[number];

export interface SemanticIntentFrame {
  // 기존 필드 유지
  domain: SemanticDomain;
  intent: SemanticIntent;
  scope: SemanticScope;
  targets: string[];
  metric: SemanticMetric;
  timeWindow: SemanticTimeWindow;
  aggregation: SemanticAggregation;
  topN?: number;
  ambiguity: SemanticAmbiguity;
  confidence: number;
  // 신규
  executionMode: SemanticExecutionMode;
}
```

**[Root] SYSTEM_PROMPT — executionMode 판단 기준 추가**

LLM이 판단하는 기준:
- `single`: 특정 서버/메트릭 조회, 현재 상태 확인, 단순 순위 질의, 간단한 수치 확인
- `multi`: 장애 원인 분석(RCA), 보고서 생성, 스크립트·runbook 작성, 상관관계 분석, 전체 플릿 종합, 예측·트렌드

**[Root] extractLocalSemanticEntities() 제거**

metric_peak 단일 케이스 regex fast-path 5개 패턴 삭제. 항상 Groq LLM 경유.
오타 처리 효과: regex 제거로 `서벼`, `servr` 등 변형 패턴도 자동 소멸. LLM이 문맥으로 처리.

**[AI Engine] selectExecutionMode() — intentFrame primary, regex 4개로 축소**

```typescript
// cloud-run/ai-engine/src/domains/monitoring/routing-policy.ts
export function selectExecutionMode(
  query: string,
  analysisMode?: AnalysisMode,
  intentFrame?: DomainIntentFrame,
  inputType?: InputType
): SupervisorMode {
  // 0. 로그 붙여넣기는 기존 regex/LLM frame보다 우선
  if (inputType === 'log_paste') return 'multi';

  // 1. 포맷 재요청 예외 (항상 single)
  if (isFormattingOnlyReportRequest(query)) return 'single';

  // 2. LLM intentFrame primary (Cloud Run frame confidence는 0~1 스케일)
  if (intentFrame?.executionMode && intentFrame.confidence >= 0.8) {
    return intentFrame.executionMode === 'multi' ? 'multi' : 'single';
  }

  // 3. Regex fallback — 명시적 명령어 4가지만
  if (REPORTER_QUERY_PATTERN.test(query)) return 'multi';
  if (FORCE_KB_QUERY_PATTERN.test(query)) return 'multi';
  if (ADVISOR_QUERY_PATTERN.test(query)) return 'multi';
  if (analysisMode === 'thinking' && INFRA_CONTEXT_PATTERN.test(query)) return 'multi';

  return 'single';
}
```

**T2 흡수**: `multiAgentPatterns[]` / `contextGatedPatterns[]` 배열이 제거되므로
`ai-assistant-structure-improvement-plan.md` T2(상수화)는 이 태스크로 대체.

**영향 파일**:
- `src/lib/ai/entity-extractor.ts`
- `src/lib/ai/semantic-intent-frame.ts`
- `src/app/api/ai/nlq/extract-entities/route.ts`
- `cloud-run/ai-engine/src/domains/monitoring/routing-policy.ts`
- `cloud-run/ai-engine/src/services/ai-sdk/supervisor-domain-wiring.ts`

**태스크**:
- [ ] **N1-1**: `SemanticIntentFrame`에 `executionMode` 슬롯 추가 + Zod schema 갱신
- [ ] **N1-2**: `DomainIntentFramePayload`/Cloud Run `DomainIntentFrame`에 `executionMode` optional 추가
- [ ] **N1-3**: SYSTEM_PROMPT에 `executionMode` 판단 지침 추가
- [ ] **N1-4**: `extractLocalSemanticEntities()` + LOCAL_* 상수 5개 제거
- [ ] **N1-5**: `selectExecutionMode()` — frame primary + regex 4개 fallback
- [ ] **N1-6**: `multiAgentPatterns[]` / `contextGatedPatterns[]` 배열 제거

---

## N2: QueryGuard 모듈 (공격·유형 탐지 전용)

### 설계 원칙

- **결정론적, LLM 미사용**: 공격 탐지에 LLM을 쓰면 LLM 자체가 우회 타겟이 됨. 빠른 로컬 판단이 정답
- **NLQ 레이어 최전선**: Groq LLM 호출 전에 차단 → 토큰 낭비 방지
- **기존 security.ts 재사용**: `detectPromptInjection()` import 재활용. 중복 구현 금지
- **Vercel Node.js runtime 전용**: Edge runtime 불가 (Node.js 패키지 의존)

### 신규 모듈: `src/lib/ai/query-guard.ts`

```typescript
export type QueryVerdict = 'allow' | 'block' | 'sanitize';
export type InputType = 'natural_query' | 'log_paste' | 'mixed' | 'oversized';

export interface QueryGuardResult {
  verdict: QueryVerdict;
  inputType: InputType;
  sanitizedQuery: string;   // NLQ LLM용 (500자 이하 정제본)
  fullQuery: string;        // supervisor용 정제 본문 (10,000자 한도)
  blockReason?: string;
  logExtract?: string;      // log_paste / mixed일 때 추출된 관련 줄 (8,000자/80줄)
  truncated: boolean;
}

export function runQueryGuard(rawInput: string): QueryGuardResult
```

### 판단 로직 (순서 중요)

```
Step 1 — 공격 패턴 탐지 (기존 PROMPT_INJECTION_PATTERNS 재사용)
  riskLevel 'high'   → verdict: 'block', 즉시 반환 (Groq 호출 없음)
  riskLevel 'medium' → verdict: 'sanitize' (sanitizedQuery 전달)
  riskLevel 'low'    → verdict: 'allow' (로깅만)

Step 2 — 입력 유형 분류 (로컬 heuristic, LLM 미사용)
  log_paste  : 줄 수 >= 5 AND (타임스탬프 OR log level OR 스택 트레이스) 비율 > 60%
  mixed      : 자연어 앞부분 + 로그 뒷부분 (log 비율 20~60%)
  oversized  : 500자 초과 AND 로그 아님
  natural_query: 그 외

Step 3 — 유형별 처리
  log_paste  → 마지막 80줄 또는 ERROR/WARN 포함 줄 추출 → logExtract
               NLQ용 요약 prompt 생성 ("로그에서 문제 서버/메트릭 추출")
               fullQuery는 10,000자 이내 정제 본문 유지 (supervisor용)
  mixed      → 자연어 부분 분리 → sanitizedQuery
               로그 부분 → logExtract
  oversized  → 500자 truncate → sanitizedQuery
               fullQuery는 supervisor 한도(10,000자)까지 유지
  natural_query → 그대로 통과
```

### 로그 탐지 패턴 (결정론적, LLM 미사용)

```typescript
// 타임스탬프: ISO8601, 대괄호 시각, epoch
const LOG_TIMESTAMP = /\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}:\d{2}|\[\d{2}:\d{2}:\d{2}\]/;
// 로그 레벨 키워드
const LOG_LEVEL = /\b(ERROR|WARN|INFO|DEBUG|FATAL|TRACE|CRITICAL)\b/i;
// 스택 트레이스 (Java/Python/Go)
const STACK_TRACE = /^\s+at\s+\w+|Exception:|Traceback \(|goroutine\s+\d+\s+\[/m;
```

### NLQ route 적용 위치

```typescript
// src/app/api/ai/nlq/extract-entities/route.ts
async function postHandler(request: NextRequest) {
  const { query } = await request.json();

  // 기존: local regex → LLM
  // 변경: QueryGuard → block 시 즉시 반환 → LLM
  const guard = runQueryGuard(query);
  if (guard.verdict === 'block') {
    return NextResponse.json({
      confidence: 0,
      blocked: true,
      blockReason: guard.blockReason,
      message: BLOCKED_INPUT_MESSAGE,
    }, { status: 200 });
  }

  const queryForLLM =
    guard.inputType === 'log_paste' || guard.inputType === 'mixed'
      ? buildLogSummaryPrompt(guard.logExtract!, guard.sanitizedQuery)
      : guard.sanitizedQuery;

  const { output } = await generateText({ ..., prompt: queryForLLM });
  return NextResponse.json(normalizeExtractedEntities(output));
}
```

**영향 파일**:
- `src/lib/ai/query-guard.ts` (신규)
- `src/app/api/ai/nlq/extract-entities/route.ts`
- `src/app/api/ai/supervisor/security.ts` — import 재사용, 수정 없음

**태스크**:
- [ ] **N2-1**: `query-guard.ts` 신규 — `runQueryGuard()` + 입력 유형 분류
- [ ] **N2-2**: 로그 추출 헬퍼 `extractRelevantLogLines()`
- [ ] **N2-3**: 로그 요약 prompt 빌더 `buildLogSummaryPrompt()`
- [ ] **N2-4**: NLQ route에 guard 적용
- [ ] **N2-5**: `query-guard.test.ts` — 공격/로그/혼합/정상/장문 케이스

---

## N3: 장문·로그 입력 — supervisor 계약 확장

### 현재 문제

사용자가 에러 로그를 붙여넣으면:
- NLQ entity 추출 (Groq, 160-token): 로그 구조 파악 불가 → confidence 0 또는 잘못된 entity
- supervisor: 10,000자 truncate만 있음, 로그인지 알 수 없음
- AI Engine: 일반 쿼리로 처리 → 부적절한 응답

### 계약 변경

**[Vercel BFF → Cloud Run] 요청 metadata 확장**

```typescript
// src/lib/ai/semantic-intent-frame.ts
// buildSemanticIntentRequestMetadata 반환 타입 확장
{
  metadata: {
    intentFrame: ...,
    inputType: guard.inputType,          // 신규
    logExtract: guard.logExtract ?? null // 신규 (log_paste/mixed일 때, 8,000자 상한)
  }
}
```

**[Cloud Run] inputType별 처리**

```
inputType === 'log_paste':
  executionMode → 'multi' 강제
  logExtract → Analyst Agent 시스템 컨텍스트에 주입 (8,000자/80줄 상한)
  intent 분류: 로그 분석 특화 프롬프트 사용

inputType === 'mixed':
  자연어 부분으로 entity/intent 판단 (LLM frame 기준)
  logExtract → 보조 컨텍스트로 Analyst에 주입

inputType === 'oversized':
  앞 500자 기준 entity 추출 결과 신뢰, 나머지는 supervisor context로 전달
```

**[Cloud Run] Prompt Injection defense-in-depth**

업계 권고(2025): 주입은 외부 문서·도구 응답을 통해서도 들어오므로 AI 서버 내부에서도 런타임 감지 필수.

```typescript
// cloud-run/ai-engine/src/services/ai-sdk/supervisor-request-guard.ts (신규)
// Vercel BFF에서 탐지한 riskLevel을 metadata로 받아서
// high/medium이면 Cloud Run 측에서도 추가 차단 또는 경고 로깅
```

**영향 파일**:
- `src/lib/ai/semantic-intent-frame.ts`
- `src/app/api/ai/supervisor/schemas.ts` (inputType 필드 추가)
- `cloud-run/ai-engine/src/domains/monitoring/routing-policy.ts`
- `cloud-run/ai-engine/src/services/ai-sdk/supervisor-request-guard.ts` (신규)

**태스크**:
- [ ] **N3-1**: BFF → Cloud Run 요청 schema에 `inputType` / `logExtract` 추가
- [ ] **N3-2**: Cloud Run `selectExecutionMode()` — `inputType === 'log_paste'` 시 multi 강제
- [ ] **N3-3**: Cloud Run supervisor prompt에 `logExtract` 컨텍스트 주입 로직
- [ ] **N3-4**: Cloud Run `supervisor-request-guard.ts` — defense-in-depth injection 탐지

---

## 작업 순서 및 의존성

```
N0 (UI input cap) — 독립, 먼저 처리 가능
  └→ N2 (QueryGuard) — NLQ route 보안/길이 guard
       └→ N1 (LLM-first routing) — N2 완료 후 NLQ route 통합
            └→ N3 (장문/로그 계약) — N1의 intentFrame 계약 확정 후
```

**N1이 T2를 흡수**: `ai-assistant-structure-improvement-plan.md` T2는 이 plan N1-6 완료 시 자동 종료.

---

## SDD 게이트

현재 Status는 `Approved`다. 구현은 아래 커밋 순서를 지킨다.

커밋 순서:
```
test(spec): [태스크명] add failing tests before implementation
refactor/feat: [태스크명] implement to pass specs
```

N0은 UI guard 소규모 변경이지만 입력 계약을 사용자에게 노출하므로 테스트 선행을 권장한다.
N2-5(guard 테스트)는 N2-1~N2-4의 선행 failing test 커밋.
N1은 동작 변경이 있으므로 test(spec): 선행 필수.
N3은 계약 확장이므로 test(spec): 선행 후 구현.

---

## 검증 게이트 (전체 공통)

```bash
# Root
npm run type-check
npm run lint
npm run test:quick
npm run test:contract
npm run line-guard

# AI Engine (N1/N3 적용 후)
cd cloud-run/ai-engine && npm run type-check && npm run test
```

---

## 이번 범위에서 의도적으로 제외한 항목

| 항목 | 제외 이유 |
|------|----------|
| Groq entity extraction을 Cloud Run으로 이전 | min-instances=0 (free tier 하드가드) → cold start 5~20s로 clarification dialog UX 붕괴. warm pool 없이 불가 |
| LLM 기반 공격 탐지 | LLM 자체가 우회 대상. 결정론적 탐지가 정답 (업계 권고 일치) |
| Edge Runtime 전환 | Node.js 서브셋 — AI SDK 의존성, 네이티브 모듈 미지원. NLQ 목적 완전 부적합 |
| log analysis 전용 tool 신규 개발 | 기존 Analyst Agent + 컨텍스트 주입으로 충분. 별도 tool은 다음 단계 |
| Root NLQ → AI Engine provider mesh 편입 | 2026-05-16 `archive/ai-provider-fallback-mesh-plan.md`에서 검토 완료. Root 경량 classifier는 deterministic fallback이 있어 현 범위 밖으로 유지 |
| 실시간 위협 인텔리전스 연동 | 외부 API = 비용 + 레이턴시. Free tier 원칙 위반 |

---

## 미래 검토 항목 (제약 해소 시)

| 항목 | 조건 |
|------|------|
| Groq entity extraction → Cloud Run 이전 | Cloud Run min-instances=1 운영 가능해질 때 (월 ~$10 추가 예산 시) |
| Clarification을 Cloud Run streaming 응답으로 전환 | 위 조건과 동일. UX 변경 수반 |
| SLM front 패턴 완성 | Cloud Run 첫 번째 노드를 dedicated classifier agent로 분리 |

---

## 2026-05-16 Provider Quota 분석 연계

### Q2(intentFrame trust)와의 연결

`provider-quota-rebalance-plan.md` Q2 항목이 이 계획 N1과 같은 루트 원인임.

- **N1**: Cloud Run `selectExecutionMode()`가 intentFrame을 신뢰하도록 수정 → Groq NLQ 결과 활용
- **Q2(재배치 플랜)**: intentFrame 신뢰가 되면 Groq NLQ 비용이 유효 사용으로 전환

N1 구현 시 Q2 효과까지 자동으로 포함됨. 별도 작업 불필요.

### Draft 탈출 조건 closure

이 계획은 NLQ 보안 guard, Cloud Run 계약, log_paste 처리가 함께 변경되는 광범위 계약 변경이므로 Draft로 유지됐으나, 2026-05-16 아래 항목을 승인 계약으로 고정했다.

**보강 필요 항목 현황:**
- [x] N0/N1/N2/N3 failing test assertion 명시
- [x] `SemanticIntentFrame.executionMode` 없는 기존 클라이언트 호환 동작 표 고정
- [x] `inputType` / `logExtract` 길이·민감정보 제한 확정
- [x] QueryGuard `blocked: true` 응답 계약 확정 (UI clarification 오인 방지)

Status를 `Approved`로 전환했으며, 구현은 SDD 게이트에 따라 failing test 커밋부터 진행한다.
