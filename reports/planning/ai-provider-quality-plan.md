> Owner: project
> Status: In Progress
> Doc type: Plan
> Last reviewed: 2026-04-28
> Tags: ai-engine,provider,prompt,quality

# AI Provider 재배치 및 응답 품질 강화 계획

## 배경 및 동기

v8.11.38 Spider-Web 배포 이후 실시한 모델-프롬프트 적합성 분석(2026-04-28)에서 3개의 구조적 문제가 발견됨.

### 발견된 문제

| # | 문제 | 심각도 |
|---|------|--------|
| 1 | **Cerebras fallback cliff** — Analyst/Reporter primary(Qwen 65K) 실패 시 llama3.1-8b(8K ctx)로 낙하. 10-step ReAct 체인은 8K에서 context overflow | P0 |
| 2 | **Advisor 품질 불일치** — Advisor 요구 복잡도는 Analyst급이나 Groq Llama-4-Scout 17B 배치. 응답 품질 추정 65/100 | P1 |
| 3 | **NLQ 프롬프트 과적** — 단일 400줄 프롬프트를 17B 모델이 매 요청마다 파싱. 5-섹션 포맷 순수 준수율 ~80% | P1 |

추가 개선:

| # | 항목 | 현재 | 개선 후 |
|---|------|------|---------|
| 4 | 응답 품질 검사 | 정규식 형식 체크 only | 신뢰도/인과방향/한자 포함 추가 |
| 5 | Supervisor 시스템 프롬프트 | 요약 우선 원칙만 | 에이전트 라우팅 힌트 보강 |

---

## 계약 (Contract)

### 변경 후 Provider 배치

```
Group A — Groq-first (빠른 응답 경로, 단순 쿼리)
  NLQ Agent:        Groq → Cerebras(Qwen만, 8K 배제) → Mistral
  Supervisor:       Groq → Cerebras → Mistral   ← 단일 Supervisor 현행 유지

Orchestrator — Cerebras-first (multi-agent 라우팅)
  Orchestrator:     Cerebras → Groq → Mistral   ← 현행 유지

Group B — Cerebras-first (품질 우선 경로, 복잡 추론)
  Analyst Agent:    Cerebras(Qwen만) → Groq → Mistral
  Reporter Agent:   Cerebras(Qwen만) → Groq → Mistral
  Advisor Agent:    Cerebras(Qwen만) → Groq → Mistral  ← 신규 이동
```

**핵심 변경점:**
- `getAnalystModel`, `getReporterModel`, `getAdvisorModel` 모두 `minContextTokens: 32_000` 추가
  → Cerebras llama3.1-8b (8K ctx) 자동 배제됨 (capability check 실패로 스킵)
- `AGENT_RUNTIME_POLICIES['Advisor Agent'].providerOrder` → `CEREBRAS_FIRST_PROVIDER_ORDER`
- Groq 1K RPD: Groq-first 기본 경로를 NLQ + 단일 Supervisor 2개로 축소
  - multi-agent Orchestrator는 이미 Cerebras-first이므로 Phase 1 변경 대상이 아님

### Groq RPD 재배분 예상

| 배치 | Groq-first 경로 | Groq RPD/경로/일 |
|------|-----------------|-------------------|
| 현행 (Spider-Web) | NLQ, Advisor, Supervisor = 3개 | ~333 |
| 변경 후 | NLQ, Supervisor = 2개 | ~500 |

Advisor가 Cerebras-first로 이동하면 Groq 실질 소비는 Cerebras 장애 시 fallback에만 발생.

---

## Task 목록

### Phase 1: Provider 재배치 (P0/P1)

- [x] T1. `agent-runtime-policy.ts` — Advisor를 `CEREBRAS_FIRST_PROVIDER_ORDER` 로 변경
  - 파일: `cloud-run/ai-engine/src/services/ai-sdk/agents/config/agent-runtime-policy.ts`
  - 변경: `'Advisor Agent': { providerOrder: CEREBRAS_FIRST_PROVIDER_ORDER, ... }`

- [x] T2. `agent-model-selectors.ts` — Analyst/Reporter/Advisor에 `minContextTokens: 32_000` 추가
  - 파일: `cloud-run/ai-engine/src/services/ai-sdk/agents/config/agent-model-selectors.ts`
  - 변경: `getAnalystModel`, `getReporterModel`, `getAdvisorModel` 각 selector에 `requiredCapabilities: { requireToolCalling: true, minContextTokens: 32_000 }` 추가
  - 효과: Cerebras llama3.1-8b (8K ctx)가 capability check 실패로 자동 배제됨

- [x] T3. NLQ에도 context floor 명시 (`minContextTokens: 16_000`)
  - Groq Llama 4 Scout 131K, Cerebras Qwen 65K 모두 통과. Mistral large 32K도 통과.
  - llama3.1-8b (8K) 배제 확보.

- [x] T4. 테스트 — provider 배치 계약 테스트 업데이트
  - 파일: `cloud-run/ai-engine/src/services/ai-sdk/agents/config/agent-model-selectors.test.ts`
  - Advisor가 Cerebras-first임을 검증하는 테스트 추가
  - `minContextTokens: 32_000` 요구사항이 실제로 llama3.1-8b를 배제하는지 단위 테스트 추가
  - provider drift guard 테스트 업데이트

#### Phase 1 검증 (2026-04-28)

- `npx vitest run src/services/ai-sdk/agents/config/agent-runtime-policy.test.ts src/services/ai-sdk/agents/config/agent-model-selectors.test.ts` 통과
- `cd cloud-run/ai-engine && npm run type-check` 통과
- `cd cloud-run/ai-engine && npm run test` 통과 (`84 files / 889 tests`)
- `npm run type-check` 통과
- `npm run test:quick` 통과

### Phase 1.5: Mistral 적극 배치 + 임베딩 레거시 삭제 (2026-04-28)

- [x] T4a. `MISTRAL_FIRST_PROVIDER_ORDER` 추가 — `agent-runtime-policy.ts` + `config/index.ts` barrel export
  - 서머라이제이션 fallback(단순 텍스트 생성, no tools)에 적용 → Groq/Cerebras RPD 절약
- [x] T4b. `orchestrator-routing.ts` 서머라이제이션 fallback — `providerOrder` → `MISTRAL_FIRST_PROVIDER_ORDER`
  - 파일: `src/services/ai-sdk/agents/orchestrator-routing.ts` (line 922)
  - 이유: fallback은 no-tool 단순 요약 — Mistral Large 256K ctx, 500 RPD/일 충분
- [x] T4c. 임베딩 레거시 삭제 (KRL 전환으로 미사용)
  - 삭제: `lib/embedding.ts`, `lib/mistral-provider.ts`, `lib/incident-rag-injector.ts`,
    `lib/incident-rag-injector-utils.ts`, `lib/topology-rag-injector.ts`,
    `server-incident-rag-backfill.ts`, `server-topology-rag-backfill.ts`, `routes/embedding.ts`
  - 삭제(테스트): `lib/embedding.test.ts`, `lib/topology-rag-injector.test.ts`,
    `server-knowledge-sync.test.ts`, `routes/embedding.test.ts`
  - 수정: `server.ts` (embeddingRouter 제거), `approval-store.ts` (syncIncidentsToRAG 제거)

#### Phase 1.5 검증 (2026-04-28)

- `cd cloud-run/ai-engine && npm run type-check` 통과
- `cd cloud-run/ai-engine && npm run test` 통과 (`80 files / 869 tests`)
- `npm run type-check` 통과 (57.9s)
- `npm run test:quick` 통과 (163 tests)

### Phase 1.6: Post-review context guard/documentation alignment (2026-04-28)

- [x] T4d. `getVerifierModel`에도 `minContextTokens: 32_000` 적용
  - 파일: `cloud-run/ai-engine/src/services/ai-sdk/model-provider.ts`
  - 이유: Verifier는 Cerebras-first로 문서화되어 있었지만 Qwen 실패 시 8K `llama3.1-8b`로 낙하할 수 있었음
  - 결과: Qwen 실패 시 8K fallback을 건너뛰고 Groq로 전환
- [x] T4e. Provider role metadata/documentation 정렬
  - `/providers` 응답, provider model metadata, AI architecture/free-tier/resilience docs에서 Advisor를 Group B로 정정

#### Phase 1.6 검증 (2026-04-28)

- `cd cloud-run/ai-engine && npx vitest run src/services/ai-sdk/model-provider.verifier-context.test.ts src/routes/providers.test.ts src/services/ai-sdk/provider-model-metadata.test.ts` 통과
- `cd cloud-run/ai-engine && npx vitest run src/services/ai-sdk/agents/config/agent-model-selectors.test.ts src/services/ai-sdk/agents/config/agent-runtime-policy.test.ts` 통과

### Phase 2: NLQ 프롬프트 계층화 (P1)

현재 `nlq.ts`는 단일 400줄 프롬프트. 17B 모델에게 매 요청마다 전체 파싱을 강제함.

- [ ] T5. query type 분류기 추가
  - 파일 신규: `cloud-run/ai-engine/src/lib/query-type-classifier.ts`
  - 분류 유형 4가지:
    - `STATUS_SUMMARY`: "요약", "현황", "서버 상태", "모든 서버" 등
    - `RANK_QUERY`: "가장 높은", "상위 N", "Top N", "순위"
    - `THRESHOLD_QUERY`: "% 이상", "초과", "임계값" 등
    - `SIMPLE_LOOKUP`: 그 외 단순 조회

- [ ] T6. NLQ instructions 분리
  - 파일 수정: `cloud-run/ai-engine/src/services/ai-sdk/agents/config/instructions/nlq.ts`
  - `NLQ_BASE_INSTRUCTIONS` (80줄 이내): 핵심 원칙 + 도구 선택 규칙
  - `NLQ_STATUS_SUMMARY_CONTEXT`: 5-섹션 포맷 + CLI 참조표 (현황 요청 시만 주입)
  - `NLQ_RANK_CONTEXT`: 순위 응답 포맷 (순위 질의 시만 주입)
  - `getNlqInstructions(queryType: QueryType): string` 조합 함수

- [ ] T7. AgentConfig에서 instructions를 동적으로 주입하도록 연결
  - 파일 수정: `cloud-run/ai-engine/src/services/ai-sdk/agents/config/agent-configs.ts`
  - NLQ Agent의 `getInstructions` 함수형으로 변경 (query 인자 수용)

- [ ] T8. 테스트
  - query type 분류기 단위 테스트
  - NLQ base instructions가 80줄 이내임을 CI 검사하는 lint rule 또는 테스트

### Phase 3: 응답 품질 검사 강화 (P2)

- [ ] T9. `response-quality.ts` 패턴 보강
  - 파일: `cloud-run/ai-engine/src/services/ai-sdk/agents/response-quality.ts`
  - Analyst 추가: `{ pattern: /(신뢰도|confidence):\s*\d+%/, flag: 'MISSING_CONFIDENCE_SCORE' }`
  - Analyst 추가: `{ pattern: /(→|유발|전파|인과|원인.*결과)/, flag: 'MISSING_CAUSAL_DIRECTION' }`
  - Reporter 추가: `{ pattern: /(신뢰도|confidence):\s*\d+%/, flag: 'MISSING_CONFIDENCE_SCORE' }`
  - 공통 BASE에 추가: `{ pattern: /[一-鿿]/, flag: 'CONTAINS_CHINESE_CHARS' }` (한자 감지 — flag만, block 아님)

- [ ] T10. 테스트 업데이트
  - 파일: `cloud-run/ai-engine/src/services/ai-sdk/agents/response-quality.test.ts`
  - 신뢰도 없는 Analyst 응답 → `MISSING_CONFIDENCE_SCORE` flag 검증
  - 한자 포함 응답 → `CONTAINS_CHINESE_CHARS` flag 검증

### Phase 4: Supervisor 시스템 프롬프트 보강 (P2)

- [ ] T11. 에이전트 라우팅 컨텍스트 힌트 추가
  - 파일: `cloud-run/ai-engine/src/services/ai-sdk/supervisor-routing.ts`
  - 현재 SYSTEM_PROMPT_BASE는 "요약 우선" 원칙만 존재
  - 추가: 어떤 질의가 어떤 에이전트로 라우팅되는지 supervisor가 인지하도록 컨텍스트 힌트 추가
  - 예: "이상감지/분석 질의는 Analyst Agent가 처리합니다. 보고서 생성은 Reporter Agent가 처리합니다"

- [ ] T12. 테스트
  - supervisor 시스템 프롬프트에 에이전트 힌트 포함 여부 contract 테스트

---

## Done Definition

- [ ] `npm run type-check` 통과
- [ ] `cd cloud-run/ai-engine && npm run type-check` 통과
- [ ] `cd cloud-run/ai-engine && npm run test` 통과 (T4 포함)
- [ ] `npm run test:quick` 통과
- [x] Analyst/Reporter/Advisor/Verifier의 `minContextTokens: 32_000` 요구사항이 테스트로 고정됨
- [ ] Advisor provider order가 `CEREBRAS_FIRST_PROVIDER_ORDER`임이 테스트로 고정됨
- [ ] Production QA: Analyst/Reporter/Advisor 각 1회씩 실제 응답 확인

---

## 위험 요소

| 위험 | 가능성 | 완화책 |
|------|--------|--------|
| Cerebras Qwen → Groq fallback 시 Groq RPD 소진 급증 | 낮음 | Cerebras 99% uptime 유지 중. fallback은 장애 시만 |
| NLQ 프롬프트 분리 후 현황 요청에서 포맷 미적용 | 중간 | T8 테스트에서 query type 분류 정확도 검증 |
| Advisor Cerebras 이동 후 속도 저하 | 낮음 | Cerebras는 Groq 수준의 속도 제공 |

---

## 참조

- 현행 Spider-Web 배치: `reports/planning/archive/ai-provider-distribution-plan.md`
- 모델 정책 SSOT: `cloud-run/ai-engine/src/services/ai-sdk/provider-model-policy.ts`
- 에이전트 런타임 정책: `cloud-run/ai-engine/src/services/ai-sdk/agents/config/agent-runtime-policy.ts`
- 모델 선택 로직: `cloud-run/ai-engine/src/services/ai-sdk/agents/config/agent-model-selectors.ts`
