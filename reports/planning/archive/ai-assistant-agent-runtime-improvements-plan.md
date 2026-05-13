# AI Assistant Agent Runtime 개선 계획서

> Owner: project
> Status: Completed
> Doc type: Plan
> Created: 2026-05-13
> Last reviewed: 2026-05-14
> Executor: Codex

## 1. 배경 및 재평가 결론

2026-05-13 Claude 아키텍처 분석 세션에서 AI 어시스턴트의 도구 노출, provider 비용 분산, semantic extraction, deterministic routing 개선안 5개가 제안됐다.
Codex는 같은 주제를 실제 코드와 2026-05-13 provider smoke 결과 기준으로 재평가했다.
2026-05-13 후속 분석에서 multi-agent 구성(Metrics Query(legacy id `nlq`)/Analyst/Reporter/Advisor/Vision/Evaluator/Optimizer 7개 agent)을 깊이 검토해 도구 분산, role drift, routing confidence 회색 영역, decomposeTask LLM 과호출, Cerebras 2026-05-27 deprecation contingency 부재 등 7건의 추가 개선점이 발견됐다.

용어 정리: `NLQ`는 Vercel의 `/api/ai/nlq/extract-entities`처럼 자연어 질의를 semantic frame/entity로 파싱하는 경로에 더 가깝다. Cloud Run 실행 에이전트의 실제 역할은 서버 메트릭 조회/필터링/요약이므로 사용자 노출명과 runtime config key를 `Metrics Query Agent`로 정렬한다. 내부 `AgentType`의 `nlq` id와 legacy `NLQ Agent` 문자열은 기존 job/stream 호환 alias로만 유지한다.

### Codex 재평가 핵심

| 항목 | Claude 분석 | Codex 재평가 |
|------|-------------|--------------|
| Agent 역할 재정의 | 즉시 적용 가능 | 동의. Math 도구가 `AgentToolName`과 single path에는 있으나 multi-agent allowlist에는 없음. Advisor의 `detectAnomalies`는 역할 경계상 제거 후보. |
| Provider 재균형 | Metrics Query Agent를 Cerebras-first로 전환 | 즉시 전환 반대. 현재 `getNlqModel()`은 legacy 함수명이나 `minContextTokens: 16_000`을 요구해 `llama3.1-8b`(8K)를 capability gate에서 건너뜀. 2026-05-13 live smoke도 안정 동작 모델은 `llama3.1-8b`뿐이며 2026-05-27 deprecation 리스크가 있음. |
| Tool Registry 일원화 | single/multi drift 근본 해결 | 방향은 맞지만 표현 보정 필요. `MONITORING_AGENT_TOOL_REGISTRY`와 `agent-tool-registry.ts`는 이미 있음. 남은 문제는 "도구 registry 부재"가 아니라 `createPrepareStep()`의 intent별 `activeTools`와 multi-agent role allowlist가 분리된 점. |
| extractEntities 로컬화 | Groq RPD 절약 | 캐시는 이미 완료됨. 전체 로컬화는 정확도 리스크가 있으므로 high-confidence `metric_peak` local-first + LLM fallback으로 제한해 별도 corpus 검증 후 진행. |
| Deterministic Domain 확장 | metric_ranking/server_health 등 LLM 0회화 | 방향은 유효. 단, metric ranking과 status summary는 이미 post-tool deterministic fallback이 일부 존재한다. 새 작업은 기존 로직을 pre-LLM Domain Evidence Provider로 승격하는 형태가 맞음. |

### 현재 실제 경로 요약

```text
artifact preprocessing
  useAIChatCore
  -> classifyChatArtifactIntent(query)
  -> regex none + shouldUseLLMChatArtifactIntent(query)
     -> /api/ai/artifact-intent (Mistral, 3s timeout)
  -> artifact/guidance match이면 여기서 종료
  -> none일 때만 sendQuery(query)

single path
  createPrepareStep(query)
  -> intent별 activeTools 직접 구성
  -> math intent는 Math 도구 노출됨

multi-agent path
  getAgentToolAllowlist(agentName)
  -> resolveDefaultMonitoringAgentTools(allowlist)
  -> Math 도구가 어떤 runtime allowlist에도 없음

provider selection
  getNlqModel()  // legacy name for Metrics Query Agent model selection
  -> providerOrder는 Groq -> Cerebras -> Mistral
  -> requireToolCalling + minContextTokens 16K
  -> Cerebras llama3.1-8b(8K)는 providerOrder를 앞에 둬도 skip됨
```

따라서 Vercel의 artifact LLM과 entity extraction LLM은 "항상 독립 병렬 트리거"가 아니다.
현재 실제 동작은 artifact intent가 먼저 short-circuit하고, artifact가 아닌 것으로 판정된 요청만 `sendQuery()` 내부에서 semantic entity extraction을 수행한다.
두 LLM이 모두 호출되는 경우는 `shouldUseLLMChatArtifactIntent(query) === true`였지만 Mistral classifier가 `none` 또는 fail-open을 반환하고, 이어서 `shouldExtractSemanticIntentFrame(query) === true`가 되는 모호한 질의로 제한된다.

---

## 2. 현황 데이터

### Provider Free Tier Quota 및 실동작 상태

| Provider | 코드상 quota | 2026-05-13 실동작/제약 | 판단 |
|---------|-------------|------------------------|------|
| Groq `meta-llama/llama-4-scout-17b-16e-instruct` | 30 RPM / 1K RPD / 30K TPM / 500K TPD | 현재 Metrics Query·Supervisor 계열 primary. 131K context, tool calling 안정 경로 | RPD가 병목. deterministic/캐시로 절약 |
| Cerebras `llama3.1-8b` | 30 RPM / 14.4K RPD / 60K TPM / 1M TPD | 현재 계정 chat completion HTTP 200. 단 8K context이고 2026-05-27 deprecation | short-context fallback만 유지. Metrics Query primary 승격 보류 |
| Cerebras `gpt-oss-120b` | policy excluded | `/v1/models`에 보여도 current key chat completion 404 | runtime 후보 제외 유지 |
| Cerebras `qwen-3-235b-a22b-instruct-2507` | policy excluded | 2026-05-13 smoke 429 queue/quota, 2026-05-27 deprecation | runtime 후보 제외 유지 |
| Cerebras `zai-glm-4.7` | policy 미등록 | `/v1/models`에 보여도 current key chat completion 404 | policy 등록 전 runtime 제외 |
| Mistral | 2 RPM / 500 RPD / 30K TPM / 1M TPD | fallback 동시성에 취약 | last-resort 유지. primary성 경로 금지 |
| Gemini Flash-Lite | 15 RPM / 1K RPD / 250K TPM / 360M TPD | Vision 전용 | 현 구조 유지 |
| Upstash Redis | 공식 Free: 500K commands/month / 256MB | 기존 일부 주석의 10K/day 표현은 구식 | 위험 낮음. stale 주석/문서만 정정 |

### Vercel 측 직접 LLM 연동

| 라우트 | 모델 | 현재 상태 | 비용 판단 |
|--------|------|-----------|-----------|
| `/api/ai/nlq/extract-entities` | `GROQ_TEXT_MODEL_ID` = Groq Llama 4 Scout 16e | 모델 ID 통일 완료, 5분 TTL/in-flight cache 완료 | 남은 개선은 local-first pre-extractor |
| `/api/ai/artifact-intent` | Mistral `ministral-3b-latest` | Tier2 fallback, 3초 timeout + `none` fail-open | Free Experiment plan은 evaluation/prototyping 목적이므로 production compliance 결정 필요 |

### 코드상 확정된 문제

| 문제 | 근본 원인 | 개선 방향 |
|------|-----------|-----------|
| Math 도구 multi-agent 누락 | single path의 `createPrepareStep()` activeTools와 multi path의 agent allowlist가 분리됨 | 즉시: Metrics Query allowlist에 Math 도구 추가. 중기: intent-aware tool policy layer |
| Advisor 역할 초과 | Advisor allowlist와 instructions가 분석 도구까지 포함 | `detectAnomalies` 제거는 가능하나 advisor instruction의 현재 상태 확인 문구도 같이 정렬 |
| Cerebras quota 주석 구식 | `agent-runtime-policy.ts` 주석이 5 RPM 시절 기준 | 30 RPM / 14.4K RPD와 2026-05-27 deprecation을 함께 표기 |
| Metrics Query Cerebras-first 계획 부정확 | providerOrder만 바꿔도 8K context gate에서 skip됨 | providerOrder 변경 전 replacement/entitlement smoke와 context 정책 결정 필요 |
| Deterministic 범위가 경로별로 흩어짐 | `metric_peak`는 Domain Evidence, ranking/summary는 post-tool fallback | LLM 호출 전 답할 수 있는 패턴부터 Domain Evidence로 승격 |
| Mistral Experiment plan production 사용 리스크 | `/api/ai/artifact-intent`가 production route에서 무료 Experiment plan key를 사용할 수 있음 | 프로젝트 Free Tier 원칙상 자동 유료 전환은 금지. production에서는 local-only 또는 explicit Scale-plan-confirmed env gate 필요 |
| Upstash stale quota comment | `src/lib/redis/ai-cache.ts`와 일부 UI copy에 10K/day 표현 잔존 | 500K commands/month 기준으로 정정 |
| **Cerebras 2026-05-27 deprecation 후 fallback 붕괴** | Analyst/Reporter/Advisor 3개 agent + Cloud Run quota-types 의존이 모두 `CEREBRAS_FIRST` → `llama3.1-8b` 만료 시 fallback chain이 Groq(RPD 1K) + Mistral(RPM 2)만 남음 | 만료 전 contingency plan: provider-model-policy.ts 만료 warning, ops-knowledge.md 리스크 기록, 만료 후 임시 Groq-only 시나리오 latency/quota 시뮬레이션 |
| **Metrics Query Agent 역할 초과 — `searchKnowledgeBase` 보유** | Metrics Query allowlist에 `searchKnowledgeBase`가 있어 KB 의도 질의도 Metrics Query로 흡수 가능 | Metrics Query는 metric query 전문. KB 검색은 Advisor 본업 → Metrics Query에서 제거, Advisor handoff로 정렬 |
| **`findRootCause` 도구가 3개 agent에 중복** | Analyst(본업)·Reporter·Advisor가 모두 `findRootCause` 보유. 동일 도구를 누가 호출할지 LLM이 매 step 결정 → 토큰/step 낭비 | Analyst만 보유. Reporter/Advisor는 RCA가 필요한 경우 Analyst handoff. 또는 도구 시그니처를 agent별로 명시 분리 |
| **Vision Agent maxSteps=5 과대** | toolAllowlist는 2개(`analyzeScreenshot`, `finalAnswer`)뿐인데 maxSteps=5 → cost/step budget 부정확 | `maxSteps=2`로 축소 (analyze → finalAnswer 정상 케이스) |
| **Composite query confidence 0.68 회색 영역** | `forcedRoutingConfidence=0.85` 미달이고 `fallbackRoutingConfidence=0.65` 초과 → LLM Orchestrator routing 강제 발생, decomposeTask LLM도 추가 | confidence를 0.65 이하로 내려 fallback path에 명시적 위임, 또는 0.85 이상으로 올려 즉시 routing |
| **`matchPatterns` SSOT 분리** | `MONITORING_AGENT_ROLES.matchPatterns`가 정의되어 있고 `agent-configs.ts`가 참조하지만 실제 runtime routing은 `orchestrator-context.ts`의 `ANALYST_QUERY_PATTERN`/`REPORTER_QUERY_PATTERN`/`ADVISOR_QUERY_PATTERN` 별도 regex가 처리. matchPatterns는 테스트 expectation만 검증하고 routing은 다른 SSOT가 결정 → drift 위험 | matchPatterns를 routing source로 일원화하거나, routing source를 SSOT로 선언하고 matchPatterns는 metadata 전용으로 명시 |
| **Metrics Query 도구 중복 — `getServerByGroup` vs `getServerByGroupAdvanced`** | 두 도구의 차이/선택 기준이 코드/주석에 없음. LLM이 매번 선택 고민 → step 낭비 | 차이 명시 또는 하나로 통합 (parameter union) |
| **decomposeTask LLM 호출이 무조건 발생 (복합 패턴 매치 시)** | `isComplexQuery()`가 true면 LLM decomposeTask 호출 → Orchestrator routing LLM + decomposition LLM + 각 subtask LLM = 단일 요청에 최대 7회 LLM call | 1) `isComplexQuery` 조건 강화 (matchCount>=2 + query.length>=40), 2) preFilter `likelyCompositeQuery`가 이미 fallback agent를 정한 경우 decomposition skip 검토 |

### Vercel preprocessing 재평가

| 주장 | 판정 | 반영 |
|------|------|------|
| 두 LLM을 하나로 합치면 안 된다 | 대체로 동의 | 목적, timeout, cache, provider quota가 다르므로 통합하지 않음 |
| 같은 쿼리가 두 LLM을 모두 호출할 수 있다 | 부분 동의 | artifact classifier가 `none`/fail-open 후 semantic gate가 열릴 때만 가능. artifact 확정 시 entity extraction은 실행되지 않음 |
| 두 호출을 `Promise.all`로 병렬화 | 현 구조에서는 비권장 | artifact short-circuit 의미가 깨지고 불필요한 Groq 호출이 늘 수 있음. 먼저 instrumentation으로 double-call rate 측정 |
| artifact-intent Edge Runtime 전환 | 조건부 보류 | Next.js Edge Runtime은 Node API 제한이 있고 package 호환 검증 필요. 현재 route는 `withAuth`/rate-limit/provider SDK를 쓰므로 build/test 선행 |
| Mistral 유료 전환 | 정책 충돌 | Mistral Scale 전환은 사용자 비용 승인과 Free Tier 원칙 변경이 필요. 코드 개선 기본안은 local-only 또는 env gate |
| Upstash 500K/month | 동의 | 공식 pricing 기준으로 stale 10K/day 표현 정정 |

---

## 3. 리팩토링 방안 재비교

| 방안 | Codex 판정 | 효과 | 작업량 | 위험도 | 권장 순서 |
|------|------------|:----:|:------:|:------:|:--------:|
| Agent 역할 재정의 + 도구 정리 | 즉시 진행 | ★★★ | ★★☆ | ★☆☆ | 1 |
| Provider evidence + Cerebras contingency | 즉시 진행 | ★★★ | ★☆☆ | ★☆☆ | 2 |
| Vercel preprocessing compliance/gate 강화 | 즉시 진행 | ★★★ | ★★☆ | ★★☆ | 3 |
| Orchestrator routing & decomposition 정비 | 즉시 진행 | ★★★ | ★★☆ | ★★☆ | 4 |
| Tool policy 일원화 | 진행 | ★★★ | ★★★ | ★★☆ | 5 |
| Deterministic Domain Evidence 승격 | 단계 진행 | ★★★★ | ★★★★ | ★★☆ | 6 |
| matchPatterns SSOT 일원화 | 단계 진행 | ★★☆ | ★★☆ | ★☆☆ | 7 |
| extractEntities local-first | corpus 선행 후 진행 | ★★★ | ★★★ | ★★★ | 8 |
| Metrics Query Cerebras-first 전환 | 보류 | ★★☆ | ★★ | ★★★★ | Hold |

### Provider 재균형 보류 기준

Metrics Query providerOrder를 Cerebras-first로 바꾸는 작업은 아래 조건 중 하나가 충족되기 전까지 구현하지 않는다.

- Cerebras에서 16K 이상 context와 tool calling을 지원하는 replacement 모델이 current key로 chat/tool/structured smoke 200을 통과한다.
- `llama3.1-8b`를 8K short-context Metrics Query 전용으로 쓰는 별도 정책을 도입하고, context truncation/품질 회귀 테스트를 먼저 통과한다.
- 2026-05-27 deprecation 이후 runtime replacement가 확정되어 `provider-model-policy.ts`와 Cloud Run env가 함께 갱신된다.

---

## 4. 계약 (Contract)

### 변경 대상 파일

| 작업 | 파일 |
|------|------|
| Agent 역할 재정의 + 도구 정리 | `cloud-run/ai-engine/src/services/ai-sdk/agents/config/agent-runtime-policy.ts` |
| Agent 역할 테스트 | `cloud-run/ai-engine/src/services/ai-sdk/agents/config/agent-runtime-policy.test.ts` |
| Provider evidence + Cerebras 만료 경고 | `cloud-run/ai-engine/src/services/ai-sdk/provider-model-policy.ts`, `cloud-run/ai-engine/src/services/resilience/quota-types.ts` |
| Provider evidence 테스트 | `cloud-run/ai-engine/src/services/ai-sdk/provider-model-policy.test.ts` |
| Cerebras contingency 문서화 | `memory/ops-knowledge.md` (Claude memory), `docs/reference/architecture/ai/ai-engine-architecture.md` |
| Vercel preprocessing low-risk cleanup | `src/lib/redis/ai-cache.ts`, `src/data/tech-stacks/ai-assistant.ts` |
| Vercel preprocessing runtime gate | `src/lib/ai/chat-artifacts/chat-artifact-intent.ts`, `src/app/api/ai/artifact-intent/route.ts`, `src/hooks/ai/core/useQueryExecution.ts` |
| Upstash quota comment/copy | `src/lib/redis/ai-cache.ts`, `src/data/tech-stacks/ai-assistant.ts` |
| Orchestrator routing threshold | `cloud-run/ai-engine/src/services/ai-sdk/agents/orchestrator-context.ts`, `cloud-run/ai-engine/src/services/ai-sdk/agents/orchestrator-types.ts` |
| Decomposition gate 강화 | `cloud-run/ai-engine/src/services/ai-sdk/agents/orchestrator-decomposition.ts` |
| Tool policy 일원화 | `cloud-run/ai-engine/src/domains/monitoring/routing-policy.ts`, `cloud-run/ai-engine/src/services/ai-sdk/agents/config/agent-runtime-policy.ts`, `cloud-run/ai-engine/src/services/ai-sdk/agents/config/agent-tool-registry.ts` |
| Domain Evidence 확장 | `cloud-run/ai-engine/src/domains/monitoring/domain-pack.ts`, 신규 monitoring evidence provider/test |
| matchPatterns SSOT | `cloud-run/ai-engine/src/domains/monitoring/agent-roles.ts`, `cloud-run/ai-engine/src/services/ai-sdk/agents/orchestrator-context.ts` |
| extractEntities local-first | `src/lib/ai/entity-extractor.ts`, `src/app/api/ai/nlq/extract-entities/route.ts`, `src/hooks/ai/core/useQueryExecution.ts` |

### 테스트 시나리오

| 시나리오 | 기대 결과 |
|----------|-----------|
| multi-agent Metrics Query가 수식/통계/용량 예측 질의를 받음 | `getAgentToolAllowlist('Metrics Query Agent')`에 Math 도구 3개 포함 |
| Metrics Query에서 KB 검색 의도 분리 | `getAgentToolAllowlist('Metrics Query Agent')`에 `searchKnowledgeBase` 없음. KB 질의는 Advisor로 라우팅 |
| `findRootCause` 단일 소유 | Analyst만 `findRootCause` 보유. Reporter·Advisor allowlist에서 제거. RCA 필요 시 Analyst handoff |
| Advisor runtime policy 검증 | `detectAnomalies` + `findRootCause` + `correlateMetrics`가 Advisor allowlist에서 제거되고, Advisor는 KB/명령 추천/로그 도구 중심 |
| Reporter runtime policy 검증 | `findRootCause`가 Reporter allowlist에서 제거되고, Reporter는 timeline/incident 작성 도구 중심 |
| Vision Agent budget 정렬 | `getAgentMaxSteps('Vision Agent') === 2` |
| provider smoke evidence freshness | `provider-model-policy.ts`에 2026-05-13 smoke 근거가 있고 stale policy finding이 발생하지 않음 |
| Cerebras 만료 경고 | `provider-model-policy.ts`/`quota-types.ts` 코드/주석에 2026-05-27 deprecation 표기, 만료 후 fallback 시나리오가 ops-knowledge.md에 기록 |
| Metrics Query provider order 보호 | `getNlqModel()`은 legacy 함수명이며 current policy에서 무리하게 Cerebras 8K primary로 바뀌지 않음 |
| artifact/entity double-call guard | artifact로 확정된 요청은 entity extraction을 호출하지 않고, Mistral `none` 후 semantic gate가 열린 경우만 double-call 가능 |
| Mistral production compliance | production에서 Mistral Experiment plan을 암묵적으로 쓰지 않도록 local-only fallback 또는 explicit env gate가 존재 |
| Upstash quota text | active code/comment/copy의 Redis quota 표현이 500K commands/month 기준 |
| Orchestrator routing confidence band | 어떤 query도 (0.65, 0.85) 구간으로 떨어지지 않음. 즉시 routing(>=0.85) 또는 명시적 LLM fallback(<0.65)으로 분리 |
| decomposeTask 호출 빈도 | `isComplexQuery` 조건이 강화돼 단순 multi-keyword 쿼리는 decomposition LLM을 호출하지 않음 |
| intent-aware tool policy | same intent + role 기준으로 single path activeTools와 multi path allowlist overlay가 같은 source를 사용 |
| matchPatterns SSOT | runtime routing 결정에 사용되는 source가 단일 SSOT로 일원화되고, 다른 곳의 matchPatterns는 metadata 용도로 명시 |
| deterministic ranking evidence | current Top-N/ranking 질의가 Cloud Run Domain Evidence에서 LLM 없이 답할 수 있음 |
| local-first entity extraction | high-confidence `metric_peak`는 로컬 추출, 모호한 쿼리는 기존 Groq route fallback |

---

## 5. Task 목록

### Task 0 — 재평가 및 계획 보정 [P1] ✅

- Claude 5개 방안을 실제 코드와 2026-05-13 Cerebras live smoke 기준으로 재평가.
- Metrics Query Cerebras-first 전환을 즉시 구현 항목에서 gated/hold 항목으로 내림.
- Tool Registry 신규 생성이 아니라 intent-aware tool policy 통합으로 범위를 보정.

### Task 1 — Agent 역할 재정의 + 도구 정리 [P2, 즉시 가능]

**수정 1: 도구 추가 (single/multi path drift 해소)**
- `Metrics Query Agent.toolAllowlist`에 추가:
  - `evaluateMathExpression`
  - `computeSeriesStats`
  - `estimateCapacityProjection`

**수정 2: 도구 제거 (역할 경계 정렬)**
- `Metrics Query Agent.toolAllowlist`에서 제거: `searchKnowledgeBase` (KB는 Advisor 본업)
- `Advisor Agent.toolAllowlist`에서 제거: `detectAnomalies`, `findRootCause`, `correlateMetrics` (분석은 Analyst 본업)
- `Reporter Agent.toolAllowlist`에서 제거: `findRootCause`, `correlateMetrics` (Reporter는 timeline/incident 작성 본업)
- RCA가 필요한 Reporter/Advisor 시나리오는 Analyst handoff로 처리. 이때 Orchestrator instruction의 handoff 안내 문구가 적절한지 확인.

**수정 3: Vision Agent budget 정렬**
- `Vision Agent.maxSteps`: `5` → `2` (`analyzeScreenshot` → `finalAnswer` 2-step이 정상 케이스)

**수정 4: Metrics Query 도구 중복 정리**
- `getServerByGroup` vs `getServerByGroupAdvanced` 차이를 코드 주석으로 명시. 둘 중 하나가 deprecated이면 제거 후보.
- 차이가 없으면 single tool로 통합 (parameter union).

**수정 5: 주석 갱신**
- quota 주석 "Cerebras: 5 RPM" → "Cerebras: 30 RPM / 14.4K RPD (2026-04-30 기준, 2026-05-27 llama3.1-8b deprecation 예정)"
- Advisor instruction이 분석 도구 직접 호출을 요구하면 handoff-driven 문구로 정렬.

**수정 6: 실행 에이전트 명칭 정렬**
- Cloud Run multi-agent의 기존 `NLQ Agent` 사용자 노출명/runtime config key를 `Metrics Query Agent`로 변경.
- 내부 `AgentType`의 `nlq` id와 legacy `NLQ Agent` 입력은 기존 job/stream/event 호환을 위해 alias로 유지.
- Vercel `/api/ai/nlq/extract-entities`는 자연어 질의 파싱 경로이므로 NLQ 명칭을 유지.

**검증**
- `cd cloud-run/ai-engine && npx vitest run src/services/ai-sdk/agents/config/agent-runtime-policy.test.ts src/services/ai-sdk/agents/config/agent-configs.nlq-instructions.test.ts src/services/ai-sdk/agents/agent-factory.test.ts`
- `cd cloud-run/ai-engine && npm run type-check`
- handoff regression: `cd cloud-run/ai-engine && npx vitest run src/services/ai-sdk/agents/orchestrator-execution-helpers.test.ts`

### Task 2 — Provider policy evidence + Cerebras contingency [P2, 즉시 가능, 긴급]

**수정 1: smokeEvidence 갱신**
- `provider-model-policy.ts` smokeEvidence에 2026-05-13 current account 결과 반영:
  - `llama3.1-8b`: chat completion HTTP 200
  - `gpt-oss-120b`: chat completion 404
  - `qwen-3-235b-a22b-instruct-2507`: 429 queue/quota
  - `zai-glm-4.7`: `/v1/models` 노출되나 chat completion 404, runtime policy 미등록 유지
- `llama3.1-8b`는 enabled runtime이지만 2026-05-27 deprecation 때문에 primary 승격 근거로 쓰지 않는다고 명시.

**수정 2: Cerebras 만료 contingency (2026-05-27 D-14)**
- `provider-model-policy.ts` 또는 `quota-types.ts` 상단에 명시적 경고 블록:
  ```
  // ⚠️ CEREBRAS DEPRECATION 2026-05-27
  // After this date llama3.1-8b is unavailable. Fallback chain degrades to:
  //   Analyst/Reporter/Advisor: Groq (RPD 1K) → Mistral (RPM 2)
  //   Effective single primary: Groq. Mistral RPM 2 cannot absorb burst.
  // Action: confirm replacement model entitlement before this date.
  ```
- `memory/ops-knowledge.md`에 Cerebras 만료 후 expected behavior와 fallback chain 변화 기록.
- 만료 후 임시 시나리오 시뮬레이션: Cerebras를 강제 disable하고 type-check + targeted vitest로 fallback chain 동작 확인 (실제 비활성은 만료 이후).

**검증**
- `cd cloud-run/ai-engine && npx vitest run src/services/ai-sdk/provider-model-policy.test.ts src/services/resilience/quota-types.test.ts`
- ops-knowledge memory entry 작성 후 link 검증

### Task 3A — Upstash quota stale 표현 정정 [P2, 즉시 가능]

**수정**
- `src/lib/redis/ai-cache.ts`의 `10K commands/day` 주석을 공식 Free tier `500K commands/month` 기준으로 수정.
- `src/data/tech-stacks/ai-assistant.ts`의 `10K req/day` copy를 500K/month 기준으로 수정.

**성격**
- comment/copy-only 저위험 작업.
- 런타임 동작, provider 호출, rate-limit 정책은 변경하지 않는다.

**검증**
- `npm run lint:changed`
- `git diff --check`

### Task 3B — Vercel preprocessing runtime gate 강화 [P2, 즉시 가능]

**수정**
- artifact LLM route의 production compliance 정책 확정:
  - 기본 방향은 Mistral 유료 전환이 아니라 Free Tier 원칙을 유지하는 코드 개선.
  - production에서 `MISTRAL_SCALE_PLAN_CONFIRMED=true` 같은 명시 env가 없으면 Tier2 Mistral classifier를 비활성화하고 local regex/guidance/fail-open만 사용한다.
  - 사용자가 비용 예외를 승인하면 별도 env-sync/deploy 작업으로 Scale plan 전환을 추적한다.
- artifact/entity double-call rate를 계측 또는 테스트로 고정:
  - artifact 확정 요청은 `sendQuery()`를 호출하지 않음.
  - Mistral `none` 후 semantic gate가 열린 요청만 entity extraction으로 진행.
- Edge Runtime 전환은 즉시 적용하지 않고 compatibility spike로만 추적:
  - `@ai-sdk/mistral`, auth wrapper, rate limiter, env access가 Edge build/runtime에서 안전한지 검증 전까지 Node.js runtime 유지.

**검증**
- `npm run test:dom -- src/hooks/ai/useAIChatCore.test.ts src/hooks/ai/core/useQueryExecution.test.ts`
- `npm run test:node -- src/app/api/ai/artifact-intent/route.test.ts`
- `npm run type-check`

### Task 4 — Orchestrator routing & decomposition 정비 [P2, 즉시 가능]

**수정 1: composite query confidence 정비**
- `orchestrator-context.ts`의 `likelyCompositeQuery` 분기 `confidence: 0.68`을 명확히 분리:
  - 옵션 A: `confidence: 0.85` 이상으로 올려 즉시 forced routing (fallback agent로 LLM Orchestrator 우회)
  - 옵션 B: `confidence: 0.6` 이하로 내려 LLM Orchestrator로 명시 위임 (현재 fallbackRoutingConfidence=0.65 미달)
- 권장: 옵션 A. preFilter가 이미 fallback agent를 선택했으므로 즉시 routing이 LLM call 1회 절감.
- `orchestrator-types.ts`의 `forcedRoutingConfidence` / `fallbackRoutingConfidence` 의미와 사용처에 docstring 추가.

**수정 2: decomposeTask gate 강화**
- `orchestrator-decomposition.ts:44` `isComplexQuery()`:
  ```typescript
  // 변경 전: matchCount >= 2 || (matchCount >= 1 && query.length >= 20) || query.length > 100
  // 변경 후: matchCount >= 2 && query.length >= 40 || query.length > 120
  ```
- 짧은 multi-keyword 쿼리(예: "CPU 메모리 확인")가 decomposition LLM을 호출하지 않도록 길이 게이트 강화.
- preFilter가 `likelyCompositeQuery=true` + fallback agent를 정한 경우 decomposition을 skip하는 옵션도 검토 (단, parallel subtask가 의미 있는 진짜 복합 쿼리는 보호).

**수정 3: Reporter pipeline LLM budget 명시**
- `orchestrator-decomposition.ts` 상단 또는 reporter-pipeline.ts에 단일 보고서 요청의 최대 LLM call budget 문서화:
  ```
  // Worst-case LLM calls per Reporter request:
  //   1× Orchestrator routing (if confidence < 0.85)
  //   1× decomposeTask (if isComplexQuery)
  //   5× Reporter maxSteps (Cerebras-first)
  //   0× Evaluator (deterministic)
  //   0× Optimizer (deterministic)
  // → Total worst-case: 7 LLM calls
  ```

**검증**
- `cd cloud-run/ai-engine && npx vitest run src/services/ai-sdk/agents/orchestrator-context.test.ts src/services/ai-sdk/agents/orchestrator-decomposition.test.ts`
- forced routing confidence band: 새 spec으로 0.65~0.85 회색 영역에 떨어지는 쿼리가 없음을 확인

### Task 5 — Tool policy 일원화 [P3, 중기]

**목표**
- existing registry는 유지하고, intent별 tool overlay를 하나의 policy layer로 이동.
- single path `createPrepareStep()`와 multi-agent allowlist가 같은 intent/role tool policy를 읽도록 정렬.

**초안**

```typescript
resolveMonitoringToolPolicy({
  intent,
  agentRole,
  path,
  toggles: { enableWebSearch, enableRAG },
})
// -> { activeTools, forcedToolName?, toolChoice }
```

**완료 기준**
- Math/prediction/ranking/RCA intent가 single/multi path에서 drift 없이 테스트됨.
- `MONITORING_AGENT_TOOL_REGISTRY`는 tool definition SSOT로 유지.
- role allowlist는 보안/권한 상한선, intent overlay는 요청별 active subset으로 역할 분리.

### Task 6 — Deterministic Domain Evidence 승격 [P3-P4]

**범위**
- 1차: `metric_ranking`, `server_health`만 Domain Evidence Provider로 승격.
- 2차 후보: `metric_current`, `log_error_count`.

**주의**
- 기존 `orchestrator-summary-fallback.ts`의 post-tool deterministic ranking/summary 로직은 즉시 삭제하지 않는다.
- 먼저 LLM 호출 전 short-circuit 가능한 provider를 추가하고, fallback은 회귀 방어로 유지한다.
- 기존 post-tool deterministic fallback은 최소 1회 semver release와 production conversational QA 통과 전까지 유지한다.
- release 이후 `metric_ranking`/`server_health`가 Domain Evidence metadata(`provider=deterministic`, `usage=0`)로 안정 확인되면 별도 cleanup task에서 삭제 여부를 판단한다.

**검증**
- Domain parser/capability/evidence provider contract test.
- stream/job supervisor에서 `provider=deterministic`, `usage=0`, `toolsCalled=[evidence-provider-id]` metadata 확인.

### Task 7 — matchPatterns SSOT 일원화 [P3, 중기]

**문제**
- `MONITORING_AGENT_ROLES.matchPatterns` (agent-roles.ts)는 정의되어 있고 `AGENT_CONFIGS`가 참조하지만, 실제 runtime routing은 `orchestrator-context.ts`의 `ANALYST_QUERY_PATTERN`/`REPORTER_QUERY_PATTERN`/`ADVISOR_QUERY_PATTERN`/`COMPOSITE_QUERY_PATTERNS`가 결정한다.
- `matchPatterns`는 `orchestrator.test.ts`가 expectation만 검증하고 routing에 영향을 주지 않음 → drift 위험.

**선택지**
- 옵션 A: `matchPatterns`를 routing source로 일원화. `orchestrator-context.ts`의 별도 regex를 제거하고 `MONITORING_AGENT_ROLES.matchPatterns`를 직접 평가.
- 옵션 B (채택): `matchPatterns`를 metadata-only로 명시하고 routing source는 `query-routing-signals.ts`로 선언. matchPatterns는 description/capability 표기와 public/internal agent 구분 용도.

**결정**
- 현재 runtime routing은 typo/infra context/formatting-only/command catalog/composite confidence 처리가 포함된 `query-routing-signals.ts` 기반 pre-filter가 더 풍부하다.
- 따라서 `matchPatterns`를 routing source로 끌어올리는 대신, monitoring runtime routing SSOT를 `query-routing-signals.ts`로 고정하고 `matchPatterns`는 metadata-only로 명시한다.

**완료 기준**
- runtime routing 결정에 사용되는 source가 단일 SSOT임을 코드 주석/타입으로 명시.
- 다른 곳에 남아 있는 matchPatterns/keyword는 explicit "metadata-only" 표기.
- 기존 routing 테스트가 모두 통과해야 함 (regression 없음).

**검증**
- `cd cloud-run/ai-engine && npx vitest run src/services/ai-sdk/agents/orchestrator.test.ts src/services/ai-sdk/agents/orchestrator-context.test.ts`
- 라우팅 contract test 신규 추가 (선택)

### Task 8 — extractEntities local-first [P4, corpus 선행]

**범위**
- high-confidence `monitoring.metric_peak`만 로컬 규칙으로 추출.
- low-confidence, ambiguity high, 복합 질의는 기존 `/api/ai/nlq/extract-entities` Groq route fallback 유지.

**선행 조건**
- 최소 20개 semantic query corpus를 만들고 local-first와 current LLM route의 frame 결과를 비교.
- corpus는 positive `metric_peak` 12개 이상, negative/off-domain/일반 상태 질의 8개 이상으로 구성한다.
- local-first 적용 기준:
  - positive `metric_peak` recall 90% 이상
  - negative false-positive 0건
  - generated `SemanticIntentFrame`의 `domain`, `intent`, `metric`, `aggregation`, `timeWindow`, `scope` 핵심 슬롯 일치율 95% 이상
- 기준 미달 시 local-first는 적용하지 않고 기존 cache + Groq fallback만 유지한다.

**결과**
- corpus: positive `metric_peak` 13건, fallback/negative 10건.
- local-first 적용 결과: positive recall 100%, negative false-positive 0건, 핵심 슬롯(`domain`, `intent`, `metric`, `aggregation`, `timeWindow`, `scope`) 일치율 100%.
- 적용 범위: 서버 ID가 없는 whole-fleet `load/load1/load5` + 24h/day + peak/time/ranking 질문만 local-first 처리.
- fallback 유지: 특정 서버 질의, 조치/해결/원인/보고서/명령어가 섞인 복합 질의, 일반 상태/랭킹/오프도메인 질의는 기존 Groq route로 유지.

### Task 9 — Metrics Query Cerebras-first 전환 [On Hold]

**보류 사유**
- 현재 runtime 모델 `llama3.1-8b`는 8K라 `getNlqModel()`의 16K context requirement를 통과하지 못함.
- 2026-05-13 current key 기준 안정 동작 모델은 `llama3.1-8b`뿐이고, 이 모델도 2026-05-27 deprecation 예정.
- providerOrder만 바꾸면 실질 효과가 없거나, context requirement를 낮추는 별도 계약 변경이 필요하다.

**재개 조건**
- replacement 모델 entitlement smoke 통과 또는 short-context Metrics Query 정책 별도 승인.

---

## 6. 실행 순서

```text
Now (Day 1-2) — P2 즉시 실행
  Done: Task 1, Task 2, Task 3A, Task 3B, Task 4

Next (Week 1) — P3 중기
  Done: Task 5 Tool policy 일원화, Task 7 matchPatterns SSOT 일원화

After (Week 2-3) — P3-P4
  Done: Task 6 metric_ranking/server_health Domain Evidence 승격

Later — corpus 선행 후 결정
  Done: Task 8 extractEntities local-first corpus 검증 및 제한 적용

Hold — 재개 조건 충족 전까지 미구현
  Task 9: Metrics Query Cerebras-first 전환
```

---

## 7. 완료 조건

- [x] Task 0: Claude 5개 방안 재평가 및 계획 보정
- [x] Task 1: Metrics Query Math 도구 추가, Metrics Query KB 도구 제거, Advisor·Reporter `findRootCause` 정리, Vision maxSteps=2, Metrics Query 도구 중복 정리, stale quota 주석 갱신
- [x] Task 2: Provider model policy에 2026-05-13 live smoke evidence 반영, 2026-05-27 Cerebras 만료 contingency 문서화 (코드 + ops-knowledge.md)
- [x] Task 3A: Upstash quota stale 표현 정정
- [x] Task 3B: Vercel preprocessing runtime gate 강화
- [x] Task 4: Orchestrator forced routing confidence 정비 + decomposition gate 강화 + Reporter LLM budget 문서화
- [x] Task 5: single/multi path tool policy drift 방지 레이어 구현
- [x] Task 6: `metric_ranking`, `server_health` Domain Evidence Provider 승격
- [x] Task 7: matchPatterns SSOT 일원화 (routing source 명시)
- [x] Task 8: local-first entity extraction corpus 검증 및 제한 적용 여부 결정
- [x] Task 9: Metrics Query Cerebras-first는 재개 조건 충족 전까지 미구현 유지
- [x] AI Engine targeted tests, type-check 통과
- [x] root 영향이 있는 경우 `npm run test:quick`, `npm run test:contract` 통과

## 8. 진행 기록

### 2026-05-13 — Codex

- Task 1 완료: multi-agent Metrics Query allowlist에 math/stat/capacity 도구를 추가하고 KB 검색을 제거했다. Reporter/Advisor에서 Analyst-owned RCA 도구를 제거하고 instruction을 handoff 중심으로 정렬했다. Vision Agent `maxSteps`를 2로 낮췄다.
- Task 1B 완료: Cloud Run 실행 에이전트 사용자 노출명/runtime config key를 `Metrics Query Agent`로 정렬하고, 기존 `AgentType: nlq` 및 legacy `NLQ Agent` 입력은 호환 alias로 유지했다. 후속 cleanup에서 Cloud Run `agent-name-compat`와 Root UI `agent-name-compat` 유틸로 legacy alias 정규화를 중앙화해 runtime/schema/factory/role registry/UI label의 중복 매핑을 제거했다. Vercel `/api/ai/nlq/extract-entities`는 자연어 질의 파서 의미를 유지한다.
- Task 2 완료: `provider-model-policy.ts`에 2026-05-13 Cerebras account smoke matrix와 2026-05-27 `llama3.1-8b` deprecation contingency를 반영했다. `quota-types.ts`, `docs/reference/architecture/ai/ai-engine-architecture.md`, `memory/ops-knowledge.md`에 fallback risk를 기록했다.
- Task 3A 완료: Upstash stale quota 표현을 500K commands/month 기준으로 정정했다.
- Task 3B 완료: `/api/ai/artifact-intent` production runtime에서 `MISTRAL_SCALE_PLAN_CONFIRMED=true`가 없으면 Tier2 Mistral classifier를 비활성화하고 local gate/fail-open 경로만 사용하도록 했다. LLM artifact classification이 artifact로 확정된 요청은 chat `sendQuery()`로 떨어지지 않는 회귀 테스트를 추가했다.
- Task 4 완료: composite pre-filter confidence를 forced routing band로 올리고, short single-signal query가 decomposition LLM을 호출하지 않도록 gate를 강화했다. Reporter worst-case LLM call budget을 코드 주석으로 명시했다.
- Task 5 완료: single path `createPrepareStep()`의 intent별 active tool set을 `monitoring-tool-policy.ts`로 중앙화했다. role allowlist는 agent별 security ceiling으로 유지하고, `math`/`prediction`/`metricRanking`/`realtimeMetric`/`rca` overlay가 담당 agent allowlist를 벗어나지 않도록 회귀 테스트를 추가했다. single path prediction/RCA overlay와 multi-agent Analyst ceiling drift를 없애기 위해 Analyst allowlist에 `estimateCapacityProjection`, `buildIncidentTimeline`을 추가했다.
- Task 6 완료: `monitoring-metric-ranking`, `monitoring-server-health` Domain Evidence Provider를 추가해 현재 Top-N 지표 랭킹과 전체 서버 상태 요약을 LLM 호출 전 deterministic answer로 short-circuit한다. 기존 post-tool `orchestrator-summary-fallback.ts`는 release/production QA 전까지 회귀 방어로 유지한다. stream/job metadata는 `provider=deterministic`, `usage=0`, `toolsCalled=[evidence-provider-id]`를 반환하도록 고정했다.
- Task 7 완료: monitoring runtime routing SSOT를 `query-routing-signals.ts`로 명시하고, `MONITORING_AGENT_ROLES.matchPatterns`/`AGENT_CONFIGS.matchPatterns`는 metadata-only catalog hints 및 public/internal 구분 용도임을 코드 상수와 주석으로 고정했다. `server runbook 절차 알려줘` 같은 runtime-only advisor signal 회귀 테스트를 추가했다.
- 검증: Task 6 targeted AI Engine Vitest 4 files / 44 tests, root semantic targeted Vitest 1 file / 9 tests, AI Engine full test 120 files / 1188 tests, AI Engine `npm run type-check`, root `npm run type-check`, `npm run test:quick`, `npm run test:contract`, `npm run lint:changed`, `npm run docs:budget`, `npm run docs:ai-consistency`, `git diff --check` 통과.

### 2026-05-14 — Codex

- Task 8 완료: `extractLocalSemanticEntities()` local-first parser를 추가해 high-confidence whole-fleet `metric_peak`만 Groq 호출 전 처리한다. corpus는 positive 13건/negative 10건으로 구성했고 recall 100%, false-positive 0건, 핵심 슬롯 일치율 100% 기준을 통과했다. 복합 조치/원인/명령어/보고서 질의와 일반 상태·랭킹·오프도메인 질의는 기존 `/api/ai/nlq/extract-entities` Groq route fallback을 유지한다.
- Task 9 유지: Metrics Query Cerebras-first 전환은 8K context gate와 2026-05-27 deprecation 리스크 때문에 재개 조건 충족 전까지 미구현으로 닫는다.
- 검증: Task 8 targeted root Vitest 3 files / 27 tests, root `npm run type-check`, `npm run test:quick`, `npm run test:contract`, `npm run lint:changed`, `npm run docs:budget`, `npm run docs:ai-consistency`, `git diff --check` 통과.
