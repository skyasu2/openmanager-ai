# Provider Quota Rebalance & NLQ Pipeline Improvement Plan

> Owner: project
> Status: Approved
> Doc type: Plan
> Last reviewed: 2026-05-16
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
| Orchestrator routing | 1 | 단순 분류 JSON 생성, Groq-first |
| Metrics Query Agent (max 4 steps) | 0~4 | Groq-first, 실제 필요 |
| **합계** | **2~6** | complex 요청 1회 |

**1000 RPD / 6 = 약 166 complex 요청/일** → 실사용에서 쉽게 소진

**근본 원인**: 두 가지 낭비가 겹침
1. **NLQ entity extraction 낭비**: `/api/ai/nlq/extract-entities`에서 Groq 1 RPD 소비 → Cloud Run `selectExecutionMode()`가 regex로 재분류해 intentFrame 무시
2. **Orchestrator Groq-first 낭비**: Orchestrator는 짧은 routing JSON 생성인데 Groq-first → Mistral/Z.AI로 충분

**개선 목표**: complex 요청당 Groq 소모 2~6 → **0~4**로 절감 (최대 ~2.5배 효율)

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

**검증 게이트**:
```bash
cd cloud-run/ai-engine && npx vitest run src/services/ai-sdk/provider-model-policy.test.ts
cd cloud-run/ai-engine && npm run type-check
```

---

### Q1. Orchestrator → Mistral/Z.AI-first 전환 (Groq RPD 절감)

**수정 파일**: `cloud-run/ai-engine/src/services/ai-sdk/agents/orchestrator-routing.ts`

```typescript
// 변경 전
const ORCHESTRATOR_PROVIDER_ORDER = GROQ_FIRST_PROVIDER_ORDER; // ['groq','zai','mistral','cerebras']

// 변경 후
const ORCHESTRATOR_PROVIDER_ORDER = MISTRAL_FIRST_PROVIDER_ORDER; // ['mistral','zai','groq','cerebras']
```

**근거**:
- Orchestrator는 짧은 routing JSON 1개를 생성하는 단순 분류 작업
- Mistral: 50 RPM / 50K TPM → Orchestrator용으로 충분하고 여유 있음
- Groq는 Metrics Query Agent의 precision math/tool-calling에만 집중
- 절감 효과: complex 요청당 Groq 1 RPD 절감 → 1000 RPD / 5 = 200 complex 요청/일

**검증 게이트**:
```bash
cd cloud-run/ai-engine && npx vitest run src/services/ai-sdk/agents/orchestrator-routing.test.ts
cd cloud-run/ai-engine && npm run test
```

---

### Q2. intentFrame trust (NLQ → Cloud Run 신뢰 연결)

**이 항목은 NLQ Pre-processing Redesign Plan의 N1과 동일 루트임. 해당 계획의 Draft→Approved 전환 조건 충족 시 함께 구현.**

**예상 효과**: NLQ Groq 호출 결과가 Cloud Run에서 신뢰되면:
- Groq NLQ 비용 = 유효 사용 (현재는 낭비)
- selectExecutionMode regex 15개+ 삭제 또는 confidence < 80 fallback으로만 유지
- 전체 Groq 예산 효율 향상

---

## 작업 순서 및 SDD 적용 여부

| 작업 | SDD 필요 | 우선순위 | 예상 시간 |
|------|:--------:|:-------:|:--------:|
| Q0: gpt-oss-120b 정책 수정 | ❌ (데이터 수정) | P0 즉시 | 30분 |
| Q1: Orchestrator provider order | ✅ (계약 변경) | P1 | 1시간 |
| Q2: intentFrame trust | ✅ (NLQ Plan 연계) | P1 (NLQ Draft→Approved 후) | 별도 |
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
