> Owner: platform-architecture
> Status: Accepted
> Doc type: Decision
> Last reviewed: 2026-05-16
> Canonical: docs/adr/adr-005-routing-pattern-over-orchestrator-worker.md
> Tags: adr,ai,routing,multi-agent,orchestrator,free-tier,nlq

# ADR-005: Routing Pattern 전환 (Orchestrator LLM 제거)

## 상태 판정

이 ADR은 현재 런타임이 이미 Orchestrator LLM을 제거했다는 기록이 아니다.

현재 코드 기준 사실관계는 아래와 같다.

| 항목 | 현재 상태 |
|------|-----------|
| Front NLQ `intentFrame` | `DefaultChatTransport.body()`와 job queue options를 통해 supervisor request metadata에 포함될 수 있음 |
| Vercel BFF schema | `metadata.intentFrame`은 `z.unknown().optional()` pass-through라 schema trust 경계가 약함 |
| Cloud Run mode selection | `selectExecutionMode(query, analysisMode)`가 regex 중심으로 `single`/`multi`를 결정 |
| Multi-agent runtime | `decomposeTask()`와 Orchestrator LLM routing이 아직 active |
| Stream output filtering | N4로 `StreamOutputFilter`가 구현되어 historical pass-through 문제는 해소됨 |

따라서 실제 문제는 "intentFrame이 전혀 전달되지 않는다"가 아니라 **전달된 frame을 라우팅 결정의 신뢰 가능한 계약으로 쓰지 않는다**는 점이다.

## 배경

기존 multi-agent 경로는 아래 비용 구조를 가진다.

```text
Vercel BFF
  └─ Front NLQ LLM → intentFrame 생성

Cloud Run AI Engine
  ├─ selectExecutionMode() → regex 재분류
  └─ Orchestrator runtime
       ├─ decomposeTask()          [필요 시 LLM]
       ├─ Orchestrator routing LLM [필요 시 LLM]
       └─ 전문 agent 실행
```

Free Tier 제약에서 가장 큰 병목은 Groq RPD다. Front NLQ LLM 결과를 쓰지 않거나, Orchestrator가 routing/decomposition에 Groq를 먼저 쓰면 Metrics Query Agent가 실제 tool loop에 쓸 Groq 예산이 줄어든다.

반대로 앞단을 자체 ML 수준 heuristic으로 키우는 것도 부적합하다. 한국어/영어 운영 질의, 오타, 문맥 생략, 복합 질문을 규칙만으로 처리하면 Vercel/Cloud Run CPU 사용량과 유지보수 부담이 커지고, 특정 테스트만 통과하는 fragile classifier가 되기 쉽다.

## 결정

단계적으로 아래 방향을 검증한다.

| 단계 | 상태 | 결정 |
|------|------|------|
| N1 | Approved/In Progress | Front NLQ LLM이 만든 `intentFrame.executionMode`를 Cloud Run `selectExecutionMode()`의 primary signal로 사용한다 |
| Q1 | Approved | Orchestrator provider order를 Groq-last로 재배치하고, forced routing 전 불필요한 decomposition/routing 이중 LLM 호출을 줄인다 |
| Q2 Direct routing | Accepted/Approved | Orchestrator LLM routing과 LLM decomposition을 request path에서 제거하고 deterministic specialist routing으로 전환한다 |

[AI SDK Workflow Patterns](https://ai-sdk.dev/docs/agents/workflows)는 `Routing`과 `Orchestrator-Worker`를 별도 workflow pattern으로 설명한다. [Agents Overview](https://ai-sdk.dev/docs/agents/overview)는 LLM tool loop에는 `ToolLoopAgent`, 예측 가능한 제어 흐름에는 structured workflow를 사용하라고 설명한다.

OpenManager의 후보 TO-BE는 이 둘을 섞은 형태다.

```text
Browser / Vercel BFF
  ├─ QueryGuard              [길이/공격/로그 형태만 deterministic]
  └─ Front NLQ LLM           [intent/entity/executionMode]

Cloud Run AI Engine
  ├─ selectExecutionMode     [confidence gate + small fallback]
  └─ Specialist agents       [Metrics Query / Analyst / Reporter / Advisor]
```

## "멀티에이전트" 명칭

현재 구현은 Orchestrator-Worker 기반 multi-agent runtime이다. Direct routing 전환이 완료되면 학술적 의미의 에이전트 간 동적 대화는 줄어들고, 엔지니어링 명칭은 **multi-agent workflow** 또는 **Routing + Tool-Loop Agent workflow**가 더 정확하다.

제품 문구로 "여러 전문 AI 에이전트가 협력해 처리한다"는 유지 가능하다. 다만 내부 문서와 코드 주석에서는 Orchestrator LLM이 남아 있는지, deterministic routing으로 대체됐는지를 구분한다.

## 트레이드오프

| 얻는 것 | 잃는 것 |
|---------|---------|
| Groq RPD를 Metrics Query tool loop에 집중 | LLM Orchestrator의 런타임 동적 handoff 일부 축소 |
| 동일 입력의 라우팅 경로가 더 예측 가능 | 복잡한 A → B → C chain을 model이 자유롭게 구성하는 능력 감소 |
| regex 오타 패턴 누적 감소 | Front NLQ provider 품질과 confidence calibration에 더 의존 |
| Cloud Run cold path에서 불필요한 LLM 직렬 호출 감소 | 별도 direct dispatch 계약과 회귀 테스트 필요 |

## 재검토 조건

| 조건 | 판단 |
|------|------|
| N1 intentFrame accuracy가 한국어/영어 fixture에서 낮음 | Direct routing 보류, regex fallback 범위 유지 |
| Orchestrator Groq-last Q1만으로 RPD 병목이 충분히 해소 | Orchestrator 제거 우선순위 하향 |
| Direct routing에서 RCA/report 품질 회귀 발생 | Orchestrator-Worker 유지 또는 hybrid fallback 채택 |
| Cloud Run min-instances=1 같은 유료 운영이 허용됨 | cold start/latency 압박 완화, Orchestrator 유지 재검토 |

## 구현 참조

- N1 계획: `reports/planning/nlq-preprocessing-redesign-plan.md`
- Q1 계획: `reports/planning/provider-quota-rebalance-plan.md`
- 현재 routing: `cloud-run/ai-engine/src/domains/monitoring/routing-policy.ts`
- 현재 Orchestrator: `cloud-run/ai-engine/src/services/ai-sdk/agents/orchestrator-execution.ts`
- Front frame 전달: `src/hooks/ai/core/createHybridChatTransport.ts`
