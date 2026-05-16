# Provider Quota Rebalance & NLQ Pipeline Improvement Plan

> Owner: project
> Status: Approved
> Doc type: Plan
> Last reviewed: 2026-05-16 (Q2 Orchestrator LLM removal approved)
> Tags: ai,provider,quota,nlq,free-tier,groq,cerebras,architecture

---

## 배경 및 분석 (2026-05-16 기준)

### 실측 Provider Quota (Live 헤더 기반)

| Provider | 모델 | RPM | RPH | RPD | TPM | Context | 상태 |
|----------|------|:---:|:---:|:---:|:---:|:-------:|------|
| Groq | llama-4-scout-17b (`meta-llama/llama-4-scout-17b-16e-instruct`) | ~30 | - | **1,000** | 30K | 131K | ✅ 운영 중 |
| Groq | llama-3.3-70b-versatile | ~30 | - | 1,000 | 12K | - | ✅ 신규 확인 (TPM 타이트) |
| Mistral | mistral-small-latest | **50** | - | 미확인 | **50K** | 32K | ✅ 운영 중 |
| Z.AI | zai-glm-4.7 (on Cerebras) | 미확인 | - | 미확인 | - | - | ✅ 48ms |
| Cerebras | llama3.1-8b | **5** | 150 | 2,400 | 30K | 8K | ⚠️ 2026-05-27 종료 예정 |
| Cerebras | **gpt-oss-120b** | **5** | 150 | 2,400 | 30K | 미확인(reasoning) | ✅ **2026-05-16 live smoke 통과 — 코드 정책과 불일치** |

> **Groq 추가 모델 (비용 고려 보류)**: `qwen/qwen3-32b` (6K TPM, reasoning), `openai/gpt-oss-120b` on Groq (8K TPM). TPM이 너무 타이트해 현재 운영에 적합하지 않음.

---

## 발견된 문제

### 🔴 P0-A: Cerebras gpt-oss-120b 정책 오류

**현상**
- `provider-model-policy.ts` 기준: `role: 'excluded'`, `enabled: false`, `smokeStatus: 'red'`
- `smokeEvidence`: "2026-05-13 current account chat completions smoke returned 404"
- 2026-05-16 live smoke: **HTTP 200, 23ms, 5 RPM / 150 RPH / 2400 RPD / 30K TPM**

**영향**
- 2026-05-27 이후 `DEFAULT_CEREBRAS_MODEL`이 여전히 `llama3.1-8b`를 가리키면 **Cerebras fallback chain 전체 차단**
- `gpt-oss-120b`가 실제로 동작하지만 코드에서 `excluded`로 완전히 제외됨

**수정 범위** (`provider-model-policy.ts`)
1. `gpt-oss-120b` 정책: `role: 'fallback'` → `enabled: true` → `smokeStatus: 'green'`
2. quota 업데이트: `5 RPM / 150 RPH / 2400 RPD / 30K TPM`
3. `smokeEvidence` 갱신: "2026-05-16 live smoke HTTP 200, 23ms, gpt-oss-120b reasoning model confirmed"
4. `DEFAULT_CEREBRAS_MODEL` → `CEREBRAS_GPT_OSS_MODEL_ID` (2026-05-26 D-1에 교체)
5. **주의**: `gpt-oss-120b`는 reasoning 모델 — `max_tokens` 최소 100 이상 필요. tool-calling 호출 시 충분한 토큰 보장 필요

---

### 🔴 P0-B: Groq RPD 일일 예산 낭비 구조

**현상**: Groq RPD = **1,000/일** (가장 타이트한 병목)

현재 complex multi-agent 요청 1회당 Groq 소모:

| 단계 | Groq 호출 수 | 비고 |
|------|:-----------:|------|
| NLQ entity extraction (Vercel BFF) | 1 | Cloud Run이 결과 무시 → **순수 낭비** |
| Orchestrator decomposition | 0~1 | `decomposeTask()`가 forced routing보다 먼저 실행됨. complex 판정 시 Groq-first |
| Orchestrator routing | 0~1 | decomposition 무효/실패 + forced routing 미충족 시 추가 Groq-first |
| Metrics Query Agent (max 4 steps) | 0~4 | Groq-first, 실제 필요 |
| **합계** | **2~7** | Metrics Query complex 최악 경로. 일반 forced/decomposition 성공 경로는 2~6 |

**1000 RPD / 7 = 약 142 complex 요청/일** → 실사용에서 쉽게 소진

**근본 원인**: 세 가지 낭비가 겹침
1. **NLQ entity extraction 낭비**: `/api/ai/nlq/extract-entities`에서 Groq 1 RPD 소비 → Cloud Run `selectExecutionMode()`가 regex로 재분류해 intentFrame 무시
2. **Decomposition 선행 낭비**: high-confidence `preFilterQuery()`가 있어도 `decomposeTask()`가 먼저 실행되어 Orchestrator LLM 1회를 소모할 수 있음
3. **Orchestrator Groq-first 낭비**: Orchestrator는 짧은 routing/decomposition JSON 생성인데 Groq-first → Cerebras/Mistral/Z.AI로 충분

**개선 목표**: complex 요청당 Groq 소모 2~7 → **0~4**로 절감. Groq는 Metrics Query Agent의 실제 tool loop에 집중시킨다.

---

### 🟡 P1: NLQ intentFrame trust gap (기존 Draft 계획과 연계)

**현상** (`routing-policy.ts` → `selectExecutionMode()`)
- 패턴 15개 이상의 regex로 실행 모드 결정
- `intentFrame`(Groq가 분류한 결과)을 수신하지만 **신뢰하지 않음**
- 결과: Groq NLQ 호출 비용은 지불하고, 결과는 사용하지 않음

**연계**: NLQ Pre-processing Redesign Plan N1 항목과 동일 루트 원인

---

### 🟢 P2: Artifact 품질 enrichment — multi-agent path 미적용

**현상**: `supervisor-response-enrichment.ts`는 single-agent path(`supervisor-single-agent.ts`)에만 연결됨. multi-agent artifact(incident report, monitoring analysis) 경로에 미적용.

**평가**: Reporter pipeline에 Evaluator/Optimizer(deterministic)가 있으므로 multi-agent artifact 품질은 이미 별도로 관리됨. 영향 낮음. P2로 분류.

---

## 개선 계획

### Q0. gpt-oss-120b 정책 수정 (단순 데이터 수정, SDD 게이트 불필요)

**Status**: 완료 (2026-05-16)

**수정 파일**: `cloud-run/ai-engine/src/services/ai-sdk/provider-model-policy.ts`

```typescript
[CEREBRAS_GPT_OSS_MODEL_ID]: {
  provider: 'cerebras',
  modelId: CEREBRAS_GPT_OSS_MODEL_ID,
  role: 'fallback',          // excluded → fallback
  lifecycle: 'production',
  enabled: true,             // false → true
  toolCallingEnabled: true,
  structuredOutputEnabled: true,
  quota: {
    requestsPerMinute: 5,
    tokensPerMinute: 30_000,
    requestsPerDay: 2_400,
    tokensPerDay: 1_000_000,
  },
  blockAfterDeprecation: false,
  smokeStatus: 'green',      // red → green
  smokeEvidence: [
    '2026-05-16 live smoke HTTP 200 OK, 23ms',
    '2026-05-16 rate limit: 5 RPM / 150 RPH / 2400 RPD / 30K TPM',
    '2026-05-16 reasoning model: content field requires max_tokens >= 100',
    'tool calling smoke: to be confirmed',
  ],
  ...
}
```

**주의 사항**: `gpt-oss-120b`는 reasoning 모델 → max_tokens 100 미만 시 `content=null` 발생. Cerebras 모델 선택기에서 reasoning 모델에 대한 min_tokens 가드 필요 여부 검토.

**완료 기록**:
- `DEFAULT_CEREBRAS_MODEL`은 즉시 전환하지 않고 `llama3.1-8b`로 유지했다. 운영 기본값 교체는 별도 스위치오버로 남긴다.
- `gpt-oss-120b` 정책은 `fallback/enabled/green`으로 보정하고 모델별 quota를 등록했다.
- `CEREBRAS_FALLBACK_MODEL_IDS` 미설정 시 built-in Cerebras fallback으로 `gpt-oss-120b`를 제공한다.
- retry/fallback은 Cerebras provider 전체가 아니라 deprecated model만 건너뛰도록 보정했다.

**검증 게이트**:
```bash
cd cloud-run/ai-engine && npx vitest run src/services/ai-sdk/provider-model-policy.test.ts
cd cloud-run/ai-engine && npm run type-check
```

---

### Q1. Orchestrator Groq-last + decomposition budget (Groq RPD 절감)

**Status**: 완료 (2026-05-16)

**수정 파일**
- `cloud-run/ai-engine/src/services/ai-sdk/agents/config/agent-runtime-policy.ts`
- `cloud-run/ai-engine/src/services/ai-sdk/agents/orchestrator-execution.ts`
- `cloud-run/ai-engine/src/services/ai-sdk/agents/orchestrator-execution-stream.ts`
- `cloud-run/ai-engine/src/services/ai-sdk/agents/orchestrator-decomposition.ts`

```typescript
// 변경 전
ORCHESTRATOR_RUNTIME_POLICY.providerOrder = ['groq', 'zai', 'mistral', 'cerebras'];

// 변경 후
ORCHESTRATOR_RUNTIME_POLICY.providerOrder = [
  'cerebras', // gpt-oss-120b structured JSON smoke 통과 후 primary
  'mistral',
  'zai',
  'groq',    // Metrics Query 예산 보존을 위해 last fallback
];
```

**근거**:
- Orchestrator는 짧은 routing JSON 1개를 생성하는 단순 분류 작업
- Cerebras `gpt-oss-120b`: 2026-05-16 live smoke 기준 사용 가능. 5 RPM이므로 burst primary 병목은 circuit breaker/fallback으로 흡수
- Mistral: 50 RPM / 50K TPM → Cerebras burst fallback으로 적합
- Z.AI: Reporter primary 예산을 보존하기 위해 Mistral 뒤에 둔다
- Groq는 Metrics Query Agent의 precision math/tool-calling에만 집중
- 절감 효과: complex 요청당 Groq 1~2 RPD 절감. decomposition + routing 이중 소모 경로를 제거하면 1000 RPD / 4 = 최대 250 Metrics-heavy 요청/일 수준까지 회복 가능

**호출 순서 보정**:
1. `preFilterResult.confidence >= forcedRoutingConfidence`이고 단일 specialist가 명확하면 `decomposeTask()`보다 forced routing을 먼저 실행한다. **완료**
2. `decomposeTask()`는 high-confidence 단일 agent 경로를 제외하고, 실제 multi-agent composite intent에서만 실행한다. **완료**
3. decomposition 결과가 2개 미만이면 LLM routing으로 바로 재시도하지 않고 `preFilterResult.confidence >= fallbackRoutingConfidence` fallback을 먼저 사용한다. **완료**
4. 기본 orchestration LLM call budget은 요청당 1회로 제한하고, decomposition+routing 2회는 명시 multi-intent에서만 허용한다. **완료**

**완료 기록**:
- `ORCHESTRATOR_RUNTIME_POLICY.providerOrder`를 `cerebras → mistral → zai → groq`로 전환했다. Groq는 Metrics Query Agent tool loop 예산 보존을 위해 last fallback이다.
- non-stream/stream multi-agent 경로 모두 high-confidence forced routing을 `decomposeTask()`보다 먼저 실행한다.
- `decomposeTask()`가 단일 subtask만 반환하면 LLM routing으로 재시도하지 않고 `fallbackRoutingConfidence` 이상인 suggested agent를 먼저 실행한다.
- Orchestrator LLM 완전 제거는 하지 않았다. ADR-005의 Direct routing 전환은 별도 Proposed 작업으로 유지한다.

**검증 게이트**:
```bash
cd cloud-run/ai-engine && npx vitest run \
  src/services/ai-sdk/agents/config/agent-runtime-policy.test.ts \
  src/services/ai-sdk/agents/orchestrator-execution.timeout.test.ts \
  src/services/ai-sdk/agents/orchestrator-decomposition.test.ts \
  src/services/ai-sdk/agents/orchestrator-routing.test.ts
cd cloud-run/ai-engine && npm run test
```

---

### Q2. Orchestrator LLM 제거 / Direct specialist routing

**Status**: Approved

**목표**
- Cloud Run multi-agent request path에서 Orchestrator LLM routing 호출을 제거한다.
- `decomposeTask()` LLM 기반 decomposition도 기본 request path에서 제거한다.
- deterministic pre-filter / routing signal 기반으로 전문 agent를 직접 선택한다.
- Metrics Query / Analyst / Reporter / Advisor / Vision specialist agent tool-loop는 유지한다.

**수정 파일**
- `cloud-run/ai-engine/src/services/ai-sdk/agents/orchestrator-execution.ts`
- `cloud-run/ai-engine/src/services/ai-sdk/agents/orchestrator-execution-stream.ts`
- `cloud-run/ai-engine/src/services/ai-sdk/agents/orchestrator-execution-helpers.ts` 또는 신규 helper
- `cloud-run/ai-engine/src/services/ai-sdk/agents/orchestrator-execution.timeout.test.ts`

**계약**
| 입력 상태 | 기대 동작 |
|-----------|-----------|
| `preFilterResult.suggestedAgent` 존재 | 해당 specialist로 직접 실행한다. confidence가 낮아도 LLM routing으로 재심사하지 않는다 |
| suggested agent 없음 + infra query | `Metrics Query Agent`로 직접 fallback한다 |
| direct response 가능 | 기존 fast path 유지 |
| Vision Agent model unavailable | 기존처럼 Analyst Agent fallback 유지 |
| complex/composite query | Orchestrator decomposition LLM을 호출하지 않는다. pre-filter가 고른 대표 specialist가 실행하고, 후속 N1/N3에서 frame/log metadata로 보강한다 |
| 실행 실패 | LLM routing fallback 없이 기존 error path로 종료한다 |

**선행 failing test assertion**
| 테스트 파일 | 기대 assertion |
|-------------|----------------|
| `orchestrator-execution.timeout.test.ts` | non-stream low-confidence suggested agent도 `generateStructuredOutputWithFallback`/`decomposeTask` 없이 direct specialist 실행 |
| `orchestrator-execution.timeout.test.ts` | stream low-confidence suggested agent도 Orchestrator LLM/decomposition 없이 `executeAgentStream` 실행 |
| `orchestrator-execution.timeout.test.ts` | suggested agent 없음이면 `Metrics Query Agent` deterministic fallback으로 실행 |
| `orchestrator-execution.timeout.test.ts` | direct routing done metadata의 `routingDecisionTrace.agentDecision.source`는 `deterministic_fallback` 또는 `pre_filter`로 남고 `llm_routing`이 아님 |

**범위 제외**
- 파일명/모듈명에서 `orchestrator-*`를 전부 제거하는 대형 rename은 이번 범위에서 제외한다. request path에서 LLM Orchestrator를 제거한 뒤, 모듈명 정리는 별도 low-risk cleanup으로 분리한다.
- NLQ `intentFrame.executionMode` 신뢰 연결은 Q3/N1에서 처리한다.

**검증 게이트**
```bash
cd cloud-run/ai-engine && npx vitest run \
  src/services/ai-sdk/agents/orchestrator-execution.timeout.test.ts \
  src/services/ai-sdk/agents/orchestrator-routing.test.ts
cd cloud-run/ai-engine && npm run type-check
cd cloud-run/ai-engine && npm run test
npm run test:contract
git diff --check
```

---

### Q3. intentFrame trust (NLQ → Cloud Run 신뢰 연결)

**이 항목은 NLQ Pre-processing Redesign Plan의 N1과 동일 루트임. 해당 계획의 Draft→Approved 전환 조건 충족 시 함께 구현.**

**Provider 판단 보정**: Q2의 핵심은 "Groq를 계속 쓴다"가 아니라 "front NLQ LLM이 만든 `intentFrame`을 Cloud Run이 신뢰 가능한 계약으로 받는다"이다. 현재 baseline은 Groq `llama-4-scout`이지만, N1-0에서 Mistral/Cerebras/Z.AI 후보를 동일 fixture로 비교한 뒤 최종 provider를 확정한다.

**예상 효과**: NLQ Groq 호출 결과가 Cloud Run에서 신뢰되면:
- Groq NLQ 비용 = 유효 사용 (현재는 낭비)
- selectExecutionMode regex 15개+ 삭제 또는 Cloud Run `DomainIntentFrame.confidence < 0.8` fallback으로만 유지
- 전체 Groq 예산 효율 향상

N1-0 결과 Groq 외 provider가 NLQ baseline이 되면, 위 효과는 "Groq NLQ 비용 절감"에서 "front NLQ LLM 비용 유효화 + Groq Metrics Query RPD 보존"으로 해석한다.

---

## 작업 순서 및 SDD 적용 여부

| 작업 | SDD 필요 | 우선순위 | 예상 시간 |
|------|:--------:|:-------:|:--------:|
| Q0: gpt-oss-120b 정책 수정 | ❌ (데이터 수정) | 완료 | 30분 |
| Q1: Orchestrator provider order + decomposition budget | ✅ (계약 변경) | 완료 | 1.5시간 |
| Q2: Orchestrator LLM 제거 / Direct specialist routing | ✅ (계약 변경) | P1 | 1.5시간 |
| Q3: intentFrame trust | ✅ (NLQ Plan 연계) | P1 (NLQ Draft→Approved 후) | 별도 |
| P2: enrichment multi-path | ❌ (저영향) | P2 관찰 후 판단 | - |

---

## 전체 개선 vs 최소 개선 평가

### 결론: **타깃 개선 (최소한의 개선으로 충분)**

| 영역 | 현황 | 판단 |
|------|------|------|
| Agent 역할 분리 (Analyst/Reporter/Advisor) | 이미 최적 배치 | ✅ 변경 불필요 |
| Circuit Breaker / Retry | 잘 구성됨 | ✅ 변경 불필요 |
| Artifact pipeline (Evaluator/Optimizer) | deterministic, 안정적 | ✅ 변경 불필요 |
| Response enrichment (single-agent) | 2026-05-16 추가 완료 | ✅ 변경 불필요 |
| Provider fallback chain 순서 | Analyst/Reporter/Advisor 최적화 완료 | ✅ 변경 불필요 |
| **Cerebras gpt-oss-120b 정책** | 코드가 현실과 불일치 | 🔴 **즉시 수정** |
| **Orchestrator Groq 낭비** | Groq RPD 1개/요청 불필요 소모 | 🟡 **P1 수정** |
| **NLQ intentFrame 무시** | Groq NLQ 결과를 Cloud Run이 무시 | 🟡 **P1 NLQ Plan 연계** |
| Enrichment multi-path | Reporter에 Evaluator/Optimizer 있어 저영향 | 🟢 관찰만 |

---

## 검증 게이트

```bash
cd cloud-run/ai-engine && npm run type-check
cd cloud-run/ai-engine && npm run test
npm run test:contract
npm run docs:ai-consistency
git diff --check
```
