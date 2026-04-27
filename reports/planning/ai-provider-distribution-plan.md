> Owner: project
> Status: Draft
> Doc type: Plan
> Last reviewed: 2026-04-27
> Canonical: reports/planning/ai-provider-distribution-plan.md
> Tags: ai, ai-engine, provider, resilience, architecture, spider-web

# AI Provider 분산 배치 (Spider-Web) 개선 계획

- 상태: Draft
- 작성일: 2026-04-27
- TODO.md 연결: Active Tasks > AI Provider 분산 배치 개선
- 기준: QA-20260427-0351/0352, `agent-runtime-policy.ts`, `model-provider.ts`, `provider-model-policy.ts` 직접 분석

---

## 1. 현황 분석

### 1-1. 에이전트별 현재 Provider 우선순위

| 에이전트 | 1순위 | 2순위 | 3순위 | maxSteps | 비고 |
|---------|------|------|------|----------|------|
| **NLQ Agent** | Groq | Cerebras | Mistral | 7 | tool calling 필수 |
| **Analyst Agent** | Groq | Cerebras | Mistral | 10 | tool calling 필수 |
| **Reporter Agent** | Groq | Cerebras | Mistral | 10 | tool calling 필수 |
| **Advisor Agent** | Groq | Cerebras | Mistral | 7 | tool calling 필수 |
| **Supervisor** | Groq | Cerebras | Mistral | — | throwOnEmpty=true |
| **Verifier** | Groq | Cerebras | Mistral | — | throwOnEmpty=true |
| **Orchestrator** | Cerebras | Groq | Mistral | — | 유일한 역순 배치 |
| **Vision Agent** | Gemini | OpenRouter | — | 5 | 별도 native chain |
| **Evaluator** | (없음, tool-only) | | | 0 | — |
| **Optimizer** | (없음, tool-only) | | | 0 | — |

### 1-2. Provider 할당량 (2026-04-27 기준)

| Provider | 모델 | RPD | RPM | TPD | 비고 |
|---------|------|----:|----:|----:|------|
| **Groq** | llama-4-scout-17b (Preview) | 1,000 | — | 500,000 | 1순위 6에이전트 공유 중 |
| **Cerebras** | qwen-3-235b → llama3.1-8b | 14,400 | — | — | 2026-05-27 Qwen 지원 종료 예정 |
| **Mistral** | mistral-large-latest | 500 | ~2 | — | Last resort 전용 |
| **Gemini** | gemini-2.5-flash-lite | 1,000 | — | — | Vision 전용 |
| **OpenRouter** | gemma-3-27b-it:free | 무제한? | — | — | Vision fallback |

### 1-3. 핵심 문제: 거미줄 분산 없음

```
현재 상태 (단일 집중):
 NLQ ──────────┐
 Analyst ──────┤
 Reporter ─────┤──→ Groq(1K RPD) → Cerebras(14.4K) → Mistral(500)
 Advisor ──────┤
 Supervisor ───┤
 Verifier ─────┘

Orchestrator ──→ Cerebras(1순위) → Groq → Mistral  ← 유일하게 다름
Vision ────────→ Gemini → OpenRouter                ← 별도 체인
```

**문제점:**
- Groq 1K RPD를 6개 에이전트가 경쟁 → 실질 **~167회/에이전트/일**
- Groq 장애 시 6개 에이전트 동시 Cerebras fallback → Cerebras 부하 폭증
- Circuit Breaker가 에이전트별로 독립이나, 1순위 provider가 동일하면 도미노 효과 가능
- Cerebras Qwen 2026-05-27 종료 후 llama3.1-8b 단독 → 품질 저하 위험 미대응

---

## 2. 목표: Spider-Web 분산 배치

각 에이전트 그룹이 서로 다른 provider를 1순위로 사용하여:
- Groq 장애 시 Analyst/Reporter/Verifier는 **영향 없음**
- Cerebras 장애 시 NLQ/Supervisor/Advisor는 **영향 없음**
- Groq 1K RPD: NLQ + Supervisor 전용 → **~500회/에이전트/일 (3배 개선)**
- Cerebras 14.4K RPD: Analyst + Reporter + Verifier + Orchestrator 전용 → **여유 있음**

```
목표 상태 (Spider-Web 분산):

 NLQ ─────────────────→ Groq(1) → Cerebras(2) → Mistral(3)
 Supervisor ──────────→ Groq(1) → Cerebras(2) → Mistral(3)
 Advisor ─────────────→ Groq(1) → Cerebras(2) → Mistral(3)
                              ↘ fallback ↗
 Analyst ────────────→ Cerebras(1) → Groq(2) → Mistral(3)
 Reporter ───────────→ Cerebras(1) → Groq(2) → Mistral(3)
 Verifier ───────────→ Cerebras(1) → Groq(2) → Mistral(3)
 Orchestrator ───────→ Cerebras(1) → Groq(2) → Mistral(3)  ← 현재 유지
                              ↘ fallback ↗
 Vision ─────────────→ Gemini(1) → OpenRouter(2)            ← 현재 유지
```

**장애 격리 효과:**
- Groq OPEN → NLQ/Supervisor/Advisor만 Cerebras fallback, Analyst/Reporter/Verifier 무영향
- Cerebras OPEN → Analyst/Reporter/Verifier만 Groq fallback, NLQ/Supervisor/Advisor 무영향
- 양쪽 동시 OPEN → 전체 Mistral fallback (최후 수단, 현재와 동일)

---

## 3. Task 목록

### Task 1: Cerebras runtime chain 종료 대응 (P0, 2026-05-27 전 완료 필수)
- [ ] `provider-model-policy.ts` — Qwen뿐 아니라 현재 같은 deprecation block에 묶인 `llama3.1-8b`까지 포함해 Cerebras runtime chain 전체 replacement 정책 확정
- [ ] `cloud-run/ai-engine/src/services/ai-sdk/provider-model-policy.ts` — deprecation 이후 사용할 Cerebras 대체 모델 또는 provider replacement 선정
- [ ] 대체 모델 후보 조사: Cerebras 신규 모델 릴리스/계정 entitlement/무료 tier limit 재확인 (2026-05-20 전)
- [ ] `CEREBRAS_MODEL_ID` env var 교체 + Cloud Run 재배포

### Task 2: Spider-Web Provider 분산 (P1)
- [ ] `agent-runtime-policy.ts` — Analyst/Reporter `providerOrder` 변경:
  ```typescript
  // 변경 전
  providerOrder: TEXT_AGENT_PROVIDER_ORDER  // ['groq', 'cerebras', 'mistral']
  // 변경 후
  providerOrder: ['cerebras', 'groq', 'mistral'] as const
  ```
- [ ] 상수 추가:
  ```typescript
  const CEREBRAS_FIRST_PROVIDER_ORDER = ['cerebras', 'groq', 'mistral'] as const;
  ```
- [ ] Supervisor, NLQ, Advisor는 `TEXT_AGENT_PROVIDER_ORDER` 유지 확인
- [ ] `model-provider.ts` — Verifier는 현재 `agent-runtime-policy.ts`가 아니라 `getVerifierModel()` 내부에서 provider order가 하드코딩되어 있으므로 별도 변경 또는 runtime policy 편입 중 하나를 선택
- [ ] `agent-model-selectors.ts` 주석 업데이트 (에이전트별 provider chain 명시)
- [ ] `model-provider.ts`, `routes/providers.ts` 상단/응답 설명 업데이트

### Task 3: 분산 배치 검증 QA (P1)
- [ ] test(spec): Analyst/Reporter/Verifier가 Cerebras를 1순위로 사용하는지 단위 테스트 추가
  - 모든 provider가 활성인 상태에서 Analyst/Reporter/Verifier 경로가 Cerebras-first 계약을 만족하는지
  - NLQ/Supervisor/Advisor는 Groq-first 계약을 유지하는지
- [ ] Circuit Breaker 독립성 확인: NLQ-groq CB OPEN이 Analyst-groq CB에 영향 없는지
- [ ] Vercel production QA: Analyst + Reporter + AI Chat 동시 요청 시 provider 분산 로그 확인

### Task 4: Quota-Aware Provider 분산 개선 (P2, 선택)
- [ ] `quota-tracker.ts` — Groq 80% 도달 시 Group A(NLQ/Supervisor/Advisor)가 자동 Cerebras fallback하는 로직 검토
- [ ] 현재 `getSupervisorModelWithQuota()` 패턴이 Analyst/Reporter에도 필요한지 평가

---

## 4. 구현 계약 (Contract)

### 변경 대상 파일

```
cloud-run/ai-engine/src/services/ai-sdk/agents/config/
  agent-runtime-policy.ts        ← 핵심 변경 (Task 2)
  agent-model-selectors.ts       ← 주석 업데이트 (Task 2)

cloud-run/ai-engine/src/services/ai-sdk/
  model-provider.ts              ← Verifier order + 주석 업데이트 (Task 2)
  provider-model-policy.ts       ← Qwen 대체 모델 (Task 1)
  routes/providers.ts            ← provider 역할 설명 업데이트 (Task 2)

tests/ (신규)
  cloud-run/ai-engine 또는 tests/integration/
  agent-provider-distribution.test.ts  ← Task 3 테스트
```

### 불변 조건
- Orchestrator는 `['cerebras', 'groq', 'mistral']` 현재 유지 (이미 Cerebras 1순위)
- Vision Agent는 `['gemini', 'openrouter']` 현재 유지 (별도 체인)
- Evaluator/Optimizer는 LLM 없음 (현재 유지)
- Mistral은 어떤 에이전트에서도 1순위로 올리지 않음 (500 RPD / ~2 RPM 제한)
- Groq RPM 제한 없음 확인 후 변경 적용

### 테스트 시나리오
1. 모든 provider 활성 → Analyst/Reporter/Verifier가 Cerebras를 1순위로 선택
2. 모든 provider 활성 → NLQ/Supervisor/Advisor가 Groq를 1순위로 유지
3. Groq 비활성(`toggleProvider('groq', false)`) → NLQ/Supervisor/Advisor가 Cerebras fallback
4. Cerebras 비활성(`toggleProvider('cerebras', false)`) → Analyst/Reporter/Verifier가 Groq fallback
5. 양쪽 비활성 → 전체 에이전트 Mistral fallback (Supervisor throwOnEmpty=true 정상 동작)

---

## 5. 위험 분석

| 위험 | 가능성 | 영향 | 완화 |
|-----|-------|------|------|
| Cerebras llama3.1-8b 품질이 Analyst/Reporter에 부적합 | 중 | 높음 | Task 1에서 품질 검증 먼저 |
| Qwen 2026-05-27 종료 후 Cerebras 1순위 에이전트 품질 하락 | 높음 | 높음 | Task 1 P0로 우선 처리 |
| providerOrder 변경 후 테스트 회귀 | 낮음 | 낮음 | Task 3 단위 테스트로 방어 |
| Groq llama-4-scout Preview 종료 | 미지수 | 높음 | `GROQ_MODEL_ID` env var로 교체 가능 |
| Provider limit/deprecation 정보 변동 | 중 | 높음 | Approved 전 공식 문서 또는 계정 Limits 화면 기준으로 재검증 |

---

## 6. 검증 기준 (Done Definition)

- [ ] `npm run type-check` 통과
- [ ] `npm run test:quick` 통과 (신규 단위 테스트 포함)
- [ ] `cd cloud-run/ai-engine && npm run type-check` 통과
- [ ] `cd cloud-run/ai-engine && npm run test` 또는 provider 관련 targeted suite 통과
- [ ] Vercel production QA: Analyst + Reporter + AI Chat 응답 정상 (targeted scope)
- [ ] Cloud Run 로그에서 에이전트별 다른 provider 선택 확인 가능
- [ ] Cerebras Qwen 종료 전 대체 모델 env var 교체 완료

---

## 7. 검토 메모 (2026-04-27)

- 이 계획은 아직 Draft다. Provider limit, model entitlement, deprecation date는 변동성이 높으므로 Approved 전 재확인이 필요하다.
- `Verifier`는 현재 `AGENT_RUNTIME_POLICIES`에 없고 `model-provider.ts`의 `getVerifierModel()`에서 provider order를 직접 지정한다. 구현 시 plan Task 2의 대상 파일을 반드시 반영한다.
- 로컬 `provider-model-policy.ts` 기준으로는 Qwen뿐 아니라 `llama3.1-8b`도 같은 `2026-05-27` block 조건을 가진다. Task 1은 Qwen 단독 교체가 아니라 Cerebras runtime chain 전체 교체로 취급한다.
- AI Assistant Analyst/Reporter quality plan은 frontend rendering/summary 개선이고, 이 plan은 Cloud Run provider routing 변경이다. 같은 QA symptom에서 출발했지만 구현 범위와 배포 위험이 다르므로 커밋과 배포 단위를 분리한다.
