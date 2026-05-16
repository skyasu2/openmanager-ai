> Owner: project
> Status: In Progress
> Doc type: Plan
> Last reviewed: 2026-05-16 (provider 판단 게이트 + artifact front LLM inventory 반영)
> Tags: ai,nlq,routing,security,query-guard,intent-frame,log-input,architecture,stream-filter,best-practice-gap

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
  ├─ [N2] QueryGuard      [얕은 기계적 필터: 길이·공격패턴·로그 형태 감지]
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

### Deterministic/LLM 균형 원칙

이 계획의 목적은 앞단에 ML 수준의 분류기를 직접 구현하는 것이 아니다. 한국어/영어 운영 표현, 오타, 문맥 생략, 복합 질문의 경우의 수를 Vercel 또는 Cloud Run 앞단 heuristic으로 커버하려 하면 규칙 폭증과 사용량 증가가 동시에 발생한다.

따라서 아래 경계를 유지한다.

| 레이어 | 허용 역할 | 금지 역할 |
|--------|-----------|-----------|
| Client / Vercel deterministic | 길이 제한, 명백한 prompt injection 차단, 민감정보 마스킹, 로그 형태 감지, cache/in-flight 제어 | intent/agent 선택을 정교한 regex/ML-like 규칙으로 대체 |
| Vercel Groq NLQ LLM | 한국어/영어 자연어 intent/entity 추출, 오타·표현 변형 흡수, `executionMode` 초안 생성 | 보안 차단의 단일 근거 |
| Cloud Run AI Engine | intentFrame 신뢰도 검증, agent 실행, tool/data grounding, defense-in-depth | Groq intentFrame을 15개+ regex로 다시 덮어쓰기 |

**불변조건**:
- QueryGuard는 semantic routing을 판단하지 않는다. `log_paste`/`mixed`/`oversized`처럼 입력 형태만 얕게 분류한다.
- 오타·동의어·한국어/영어 표현 확장은 regex 추가가 아니라 N1의 LLM intentFrame 신뢰로 해결한다.
- 보안은 deterministic guard와 supervisor/Cloud Run defense-in-depth로 분리하되, 일반 질의 대응력은 LLM에 맡긴다.
- 무료 티어 제약상 Vercel/Cloud Run 앞단에 CPU-heavy preprocessing, 자체 ML 모델, 대형 룰 엔진을 추가하지 않는다.

### Front LLM provider 판단 게이트

`/api/ai/nlq/extract-entities`의 현재 baseline은 Groq `meta-llama/llama-4-scout-17b-16e-instruct`다. 다만 N1은 "Groq 고정" 작업이 아니라 "front intent/entity LLM 결과를 Cloud Run이 신뢰하도록 만드는 계약 변경" 작업이다. provider 선택은 N1 구현 직전 N1-0에서 별도로 검증한다.

| 후보 | 현재 근거 | 리스크 | N1 판단 |
|------|-----------|--------|---------|
| Groq `llama-4-scout` | 기존 route/test가 이미 이 모델 기준. 공개 free limit도 30 RPM / 1K RPD / 30K TPM으로 명시되어 있고, 짧은 structured NLQ에 적합 | 1K RPD가 Metrics Query Agent와 공유되므로 낭비에 취약 | **현재 default 유지**. 단, N1에서 intentFrame을 실제 사용해야 비용이 정당화됨 |
| Mistral `ministral-3b` / `mistral-small` | artifact intent classifier가 이미 Mistral 소형 모델을 사용. Mistral free tier는 workspace별 exact limit 확인 필요 | NLQ 한국어/영어 schema accuracy와 latency가 아직 이 route에서 검증되지 않음. production artifact classifier는 scale plan confirmation gate가 있음 | **평가 후보**. 품질이 동등하면 Groq RPD 보존용 대체 가능 |
| Cerebras `gpt-oss-120b` | 2026-05-16 live smoke로 사용 가능 확인. repo 기준 보수 quota는 5 RPM / 2,400 RPD / 30K TPM | reasoning 모델 특성상 max token guard 필요. burst front classifier primary로는 5 RPM 병목 가능. public limit은 high-demand 상황에서 조정될 수 있음 | **front primary 보류**. Orchestrator/structured fallback 쪽이 우선 |
| Z.AI / GLM 계열 | 짧은 응답 latency 장점 후보 | 계정 quota, structured output, 한국어/영어 NLQ fixture 검증 부족 | **기본값 아님**. live smoke 후 보조 후보 |

**N1 provider decision rule**:
- CI/로컬 deterministic test에서는 live LLM 호출을 금지하고 fixture 기반 schema/normalizer 계약만 검증한다.
- 수동 live smoke에서 한국어/영어 metric, server, RCA, report-shaped, artifact-shaped negative corpus를 각 provider에 동일 입력으로 평가한다.
- 측정값은 `schema_valid`, `intent_accuracy`, `executionMode_accuracy`, `p95 latency`, `rate-limit headroom`, `production env gate`로 제한한다.
- N1-0에서 Groq 외 provider가 선택되더라도 Cloud Run 계약명은 `intentFrame`으로 유지한다. downstream은 provider 이름이 아니라 frame confidence와 schema만 신뢰한다.

### Artifact front LLM inventory

artifact 생성을 위한 전단 LLM 의도 분석은 이미 NLQ와 별도 경로로 존재한다.

```
useAIChatCore submit
  └─ tryHandleChatArtifactRequest()
       ├─ classifyChatArtifactIntent()             [local regex]
       └─ /api/ai/artifact-intent                  [Mistral ministral-3b-latest]
            └─ incident-report / monitoring-analysis / none
```

이 경로는 일반 Supervisor `sendQuery()`보다 먼저 실행되며, artifact/guidance로 판별되면 Cloud Run Supervisor를 호출하지 않는다. 현재 LLM 보강 범위는 `incident-report`와 `monitoring-analysis`뿐이고, production에서는 `MISTRAL_SCALE_PLAN_CONFIRMED=true` 없이는 `none`으로 fallback한다.

따라서 N1은 artifact classifier를 새로 만들거나 Groq NLQ 경로와 합치지 않는다. N1의 범위는 metric/server/RCA 계열 NLQ `intentFrame.executionMode` 신뢰 연결이며, artifact intent provider 변경은 별도 artifact 계획에서 다룬다.

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

### 확인된 문제 8가지

| # | 문제 | 현상 | 대응 |
|---|------|------|------|
| P1 | **LLM 결과를 Cloud Run regex가 재심사** | intentFrame이 전달되나 `selectExecutionMode()`가 자체 regex 15개+로 덮어씀. LLM 분석 낭비 | N1 |
| P2 | **regex 오타 예외 처리 수동 누적** | `서벼`, `썹`, `servr`, `sever`, `trubleshoot` 등 수동 관리. 새 오타마다 패턴 추가 | N1 |
| P3 | **공격 패턴 탐지가 NLQ 레이어 부재** | `security.ts` injection 탐지가 supervisor에만 적용. `/api/ai/nlq/extract-entities`는 무방비로 Groq 도달 | N2 |
| P4 | **장문·로그 입력 처리 미정의** | NLQ route 길이 제한 없음. 에러 로그 붙여넣기 시 160-token 한도 내 추출 → 실패 | N3 |
| P5 | **스트리밍 출력 필터 미적용** | `filterResponse()` + `DANGEROUS_OUTPUT_PATTERNS`(XSS 제거)가 레거시 JSON 경로에만 있음. `stream/v2/route.ts:443`에서 `cloudRunResponse.body`를 그대로 클라이언트에 pass-through. 실제 운영 경로인 streaming이 더 취약한 역전 상태 | N4 |
| P6 | **`z.unknown().optional()` pass-through 필드** | `schemas.ts`의 `intentFrame`, `semanticQueryTrace`, `localRouteDecision`이 형식 검증 없이 Cloud Run에 전달됨. 악의적 사용자가 `metadata.intentFrame.confidence=100`을 조작해 라우팅에 영향 가능 | N1/N3 완료 시 schema에 타입 확정 |
| P7 | **`requestSchema`와 `requestSchemaLoose` 동일 내용 중복** | `schemas.ts:156` vs `schemas.ts:173` — 주석은 "최소 검증"이나 실제 내용 동일. 유지보수 부담 | 이번 범위 제외 — TODO 1줄 |
| P8 | **stream/v2 서버 컨텍스트 주입 누락 (조사 필요)** | 레거시 `route.ts:307`에서 `buildServerContextMessage()`로 alert 서버 메트릭 주입. `stream/v2/route.ts`에는 없음. Cloud Run이 자체 데이터 접근 가능하다면 무해하나, BFF 단 컨텍스트 주입이 의도였다면 누락 | 조사 후 판단 — 이번 범위 제외 |

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

Vercel BFF stream/v2 응답 처리
  └─ [N4] cloudRunResponse.body → StreamOutputFilter → 클라이언트
       ├─ XSS 패턴 스캔 (DANGEROUS_OUTPUT_PATTERNS)
       └─ 악성 출력 탐지 (MALICIOUS_OUTPUT_PATTERNS)
```

> **P5(스트리밍 출력 필터) 우선순위**: N2 QueryGuard와 파일/계약이 독립적이며 보안상 즉시 해소가 권고되는 항목이다. N0 완료 뒤 N2와 병렬 착수 가능하며, streaming 필터는 chunk 단위 처리가 필요해 SDD test/spec을 먼저 고정한다.


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
| N4 | `src/app/api/ai/supervisor/stream/v2/stream-output-filter.test.ts` | `<script>` 포함 청크는 `[removed]`로 치환되고, 시스템 프롬프트 유출 패턴은 안전 응답으로 교체되고, 정상 청크는 그대로 통과한다 |
| N4 | `src/app/api/ai/supervisor/stream/v2/stream-output-filter.test.ts` | SSE `data: ` 프리픽스는 스캔 대상에서 제외되어 변형 없이 유지된다 |

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
| Vercel (N4) | stream/v2 응답에 chunk 스캔 추가. 단순 regex 적용이므로 레이턴시 영향 미미 | ✅ |

---

## N0: 채팅 입력 길이 UX guard

**변경 범위**
- `src/components/ai-sidebar/ChatInputArea.tsx`
- `src/components/ai-sidebar/ChatInputArea.test.tsx`

**태스크**
- [x] **N0-1**: `AutoResizeTextarea` 호출에 `maxLength={10000}` 전달
- [x] **N0-2**: 8,000자 이상 warning, 10,000자 도달 시 hard cap 안내
- [x] **N0-3**: 기존 session counter와 충돌하지 않도록 하단 힌트 우선순위 정리

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
- [ ] **N1-0**: NLQ provider fit check — Groq/Mistral/Cerebras/Z.AI 후보를 동일 fixture로 비교하고 N1 baseline provider 확정
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
- **semantic 판단 금지**: QueryGuard는 intent/entity/agent routing을 판단하지 않는다. 언어·오타·표현 변형은 Groq NLQ LLM과 N1 `executionMode` 계약이 처리한다.
- **룰 폭증 금지**: 한국어/영어 표현을 맞추기 위한 대규모 regex 확장은 금지한다. 규칙은 보안 패턴, 길이, 로그 형태처럼 안정적인 표면에만 둔다.

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
- [x] **N2-1**: `query-guard.ts` 신규 — `runQueryGuard()` + 입력 유형 분류
- [x] **N2-2**: 로그 추출 헬퍼 `extractRelevantLogLines()`
- [x] **N2-3**: 로그 요약 prompt 빌더 `buildLogSummaryPrompt()`
- [x] **N2-4**: NLQ route에 guard 적용
- [x] **N2-5**: `query-guard.test.ts` — 공격/로그/혼합/정상/장문 케이스

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

## N4: 스트리밍 출력 필터 (P5 대응)

### 현재 문제

`stream/v2/route.ts:443`에서 `cloudRunResponse.body`를 아무 필터 없이 그대로 클라이언트에 전달한다.

```typescript
// 현재 — 필터 없음
return new Response(streamBody, { headers: createSupervisorStreamHeaders(...) });
```

레거시 `route.ts`는 JSON 응답에 `filterResponse()` + `escapeHtml()`을 적용하는데, 실제 운영에서 더 많이 쓰이는 streaming 경로는 적용 대상이 아니다. XSS 패턴(`<script>`, `onclick=`, `javascript:` 등)이나 악성 출력(시스템 프롬프트 유출, 역할 변경 확인)이 스트리밍으로 클라이언트에 도달할 수 있다.

### 설계 원칙

- **청크 단위 스캔**: 스트리밍은 단일 문자열이 아니라 SSE 청크 스트림이므로 `TransformStream`으로 청크를 버퍼링하여 패턴 스캔 후 릴리즈한다.
- **버퍼 크기 상한**: 무제한 버퍼는 메모리 위험. 청크당 최대 8KB, 누적 버퍼는 32KB로 제한한다.
- **기존 패턴 재사용**: `DANGEROUS_OUTPUT_PATTERNS` / `MALICIOUS_OUTPUT_PATTERNS` import 재사용. 중복 구현 금지.
- **패스스루 우선**: 패턴 미탐지 시 지연 없이 즉시 릴리즈. 탐지 시만 치환.
- **SSE 프레임 보존**: `data: `, `event: `, `id: ` 프리픽스를 치환하지 않도록 content 부분만 스캔.

### 신규 모듈: `src/app/api/ai/supervisor/stream/v2/stream-output-filter.ts`

```typescript
export function createOutputFilterStream(): TransformStream<Uint8Array, Uint8Array>

// 청크 처리 흐름:
// 1. Uint8Array → UTF-8 decode
// 2. SSE 프리픽스 유지, content 부분만 추출
// 3. DANGEROUS_OUTPUT_PATTERNS 스캔 → 탐지 시 '[removed]'로 치환
// 4. MALICIOUS_OUTPUT_PATTERNS 스캔 → 탐지 시 안전 응답으로 교체
// 5. UTF-8 encode → 다운스트림 릴리즈
```

### stream/v2/route.ts 적용

```typescript
// 변경 전
return new Response(streamBody, { headers: ... });

// 변경 후
import { createOutputFilterStream } from './stream-output-filter';
const filteredStream = streamBody.pipeThrough(createOutputFilterStream());
return new Response(filteredStream, { headers: ... });
```

> **Resumable stream 호환**: `createUpstashResumableContext().createNewResumableStream()`의 `streamBody` 인자 전달 전에 filter를 적용한다. Resumable path와 pass-through path 양쪽에 모두 적용.

### 승인 계약 — N4 failing test assertion

| 테스트 파일 | 기대 assertion |
|-------------|----------------|
| `src/app/api/ai/supervisor/stream/v2/stream-output-filter.test.ts` | `<script>alert(1)</script>` 포함 청크는 `[removed]`로 치환되어 출력된다 |
| `src/app/api/ai/supervisor/stream/v2/stream-output-filter.test.ts` | `당신은 서버 모니터링 AI 어시스턴트` 포함 청크는 안전 응답으로 교체된다 |
| `src/app/api/ai/supervisor/stream/v2/stream-output-filter.test.ts` | 패턴 없는 정상 청크는 변형 없이 그대로 출력된다 (pass-through) |
| `src/app/api/ai/supervisor/stream/v2/stream-output-filter.test.ts` | SSE `data: ` 프리픽스는 치환 대상에서 제외된다 |

**영향 파일**:
- `src/app/api/ai/supervisor/stream/v2/stream-output-filter.ts` (신규)
- `src/app/api/ai/supervisor/stream/v2/route.ts` (filter 적용)

**태스크**:
- [ ] **N4-1**: `stream-output-filter.ts` 신규 — `createOutputFilterStream()` TransformStream
- [ ] **N4-2**: SSE 청크 파싱 — content 부분 추출 + 프리픽스 보존 로직
- [ ] **N4-3**: `stream/v2/route.ts` — pass-through path와 resumable path 양쪽에 filter 적용
- [ ] **N4-4**: `stream-output-filter.test.ts` — XSS/악성/정상/SSE 프리픽스 케이스

---

## 작업 순서 및 의존성

```
N0 (UI input cap) — 독립, 먼저 처리 가능
  ├→ N2 (QueryGuard) — NLQ route 보안/길이 guard
  │    └→ N1 (LLM-first routing) — N2 완료 후 NLQ route 통합
  │         └→ N3 (장문/로그 계약) — N1의 intentFrame 계약 확정 후
  │              └→ [N1/N3 완료 시] schemas.ts z.unknown() → 타입 확정 (P6 해소)
  └→ N4 (스트리밍 출력 필터) — N2와 파일/계약 독립, 병렬 착수 가능
```

**N1이 T2를 흡수**: `ai-assistant-structure-improvement-plan.md` T2는 이 plan N1-6 완료 시 자동 종료.

**P6 해소 시점**: N1에서 `SemanticIntentFrame`에 `executionMode` 타입을 확정하고, N3에서 `metadata.inputType` / `metadata.logExtract`를 schema에 추가하면 `z.unknown()` pass-through 필드가 자연스럽게 제거된다. 별도 태스크 불필요.

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
N4는 N2와 파일/계약이 독립이므로 N0 완료 후 병렬 착수 가능. test(spec): 선행 필수 (streaming TransformStream 계약 변경).

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
| **P7: `requestSchema`/`requestSchemaLoose` 중복 제거** | 기능 변경 없음. TODO.md 소규모 리팩터링 1줄로 충분. N1/N3 계약 확정 후 두 스키마를 하나로 병합하는 것이 자연스러운 시점 |
| **P8: stream/v2 서버 컨텍스트 주입 누락** | `buildServerContextMessage()`가 레거시 route에만 있음. Cloud Run은 `precomputed-state.ts`로 자체 데이터 접근 가능하므로 BFF 주입이 필수인지 불명확. 관찰 후 별도 판단 |
| **P5의 base64 오탐 가능성 (경고)** | `security-patterns.ts`의 `encoding_bypass` 패턴이 data URL base64와 충돌 가능성 있음. 현재 `extractLastUserQuery()`가 텍스트만 추출해 실제 오탐 없음. 멀티파트 확장 시 재검토 필요 |

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
- [x] N0/N1/N2/N3/N4 failing test assertion 명시
- [x] `SemanticIntentFrame.executionMode` 없는 기존 클라이언트 호환 동작 표 고정
- [x] `inputType` / `logExtract` 길이·민감정보 제한 확정
- [x] QueryGuard `blocked: true` 응답 계약 확정 (UI clarification 오인 방지)

Status를 `Approved`로 전환했으며, 구현은 SDD 게이트에 따라 failing test 커밋부터 진행한다.
