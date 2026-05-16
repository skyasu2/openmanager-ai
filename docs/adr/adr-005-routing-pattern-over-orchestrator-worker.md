> Owner: platform-architecture
> Status: Accepted
> Doc type: Decision
> Last reviewed: 2026-05-16
> Canonical: docs/adr/adr-005-routing-pattern-over-orchestrator-worker.md
> Tags: adr,ai,routing,multi-agent,orchestrator,free-tier,nlq

# ADR-005: Routing Pattern 전환 (Orchestrator LLM 제거)

## 상태 판정

이 ADR은 2026-05-16 기준으로 Cloud Run multi-agent request path에서 Orchestrator LLM routing과 LLM decomposition을 제거한 결정을 기록한다.

현재 코드 기준 사실관계는 아래와 같다.

| 항목 | 현재 상태 |
|------|-----------|
| Front NLQ `intentFrame` | `DefaultChatTransport.body()`와 job queue options를 통해 supervisor request metadata에 포함됨 |
| Vercel BFF schema | N3 잔여: `metadata.intentFrame`은 `z.unknown().optional()` pass-through. schema trust 경계 확정 대기 |
| Cloud Run mode selection | N1 완료: `selectExecutionMode()`가 `intentFrame.executionMode`를 confidence ≥ 0.8이면 primary로 신뢰. regex는 4개 fallback으로 축소됨 |
| Multi-agent runtime | Q2 완료: `preFilterQuery()` 결과를 `resolveDirectRoutingTarget()`으로 직접 specialist agent에 dispatch. `decomposeTask()`와 Orchestrator LLM routing은 기본 request path에서 호출하지 않는다 |
| Stream output filtering | N4 완료: `StreamOutputFilter`가 XSS/시스템프롬프트 유출 패턴을 `/api/ai/supervisor/stream/v2`에서 차단 |
| QueryGuard (NLQ 보안 레이어) | N2 완료: `/api/ai/nlq/extract-entities`에 공격 패턴 차단, log_paste 감지, oversized truncate 적용 |

N1/N2/N4가 완료되어 intentFrame은 이제 Cloud Run mode selection의 primary signal이다. 남은 문제는 **N3: `inputType/logExtract`를 Cloud Run 계약으로 확정해 log paste를 multi 분석 경로에 연결하는 것**이다.

## 배경

기존 multi-agent 경로는 아래 비용 구조를 가진다.

```text
Vercel BFF
  └─ Front NLQ LLM → intentFrame 생성

Cloud Run AI Engine
  ├─ selectExecutionMode() → regex 재분류
  └─ Legacy Orchestrator runtime
       ├─ decomposeTask()          [필요 시 LLM]
       ├─ Orchestrator routing LLM [필요 시 LLM]
       └─ 전문 agent 실행
```

Free Tier 제약에서 가장 큰 병목은 Groq RPD다. Front NLQ LLM 결과를 쓰지 않거나, Orchestrator가 routing/decomposition에 Groq를 먼저 쓰면 Metrics Query Agent가 실제 tool loop에 쓸 Groq 예산이 줄어든다.

반대로 앞단을 자체 ML 수준 heuristic으로 키우는 것도 부적합하다. 한국어/영어 운영 질의, 오타, 문맥 생략, 복합 질문을 규칙만으로 처리하면 Vercel/Cloud Run CPU 사용량과 유지보수 부담이 커지고, 특정 테스트만 통과하는 fragile classifier가 되기 쉽다.

## 결정

아래 방향으로 확정하고, 남은 NLQ trust 계약을 이어서 검증한다.

| 단계 | 상태 | 결정 |
|------|------|------|
| N1 | Completed | Front NLQ LLM이 만든 `intentFrame.executionMode`를 Cloud Run `selectExecutionMode()`의 primary signal로 사용한다. confidence ≥ 0.8이면 LLM 결과 우선, regex는 4개 fallback으로 축소됨 |
| Q1 | Completed | Orchestrator provider order를 Groq-last로 재배치하고, forced routing 전 불필요한 decomposition/routing 이중 LLM 호출을 줄였다 |
| Q2 Direct routing | Completed | Orchestrator LLM routing과 LLM decomposition을 request path에서 제거하고 deterministic specialist routing으로 전환했다 |

[AI SDK Workflow Patterns](https://ai-sdk.dev/docs/agents/workflows)는 `Routing`과 `Orchestrator-Worker`를 별도 workflow pattern으로 설명한다. [Agents Overview](https://ai-sdk.dev/docs/agents/overview)는 LLM tool loop에는 `ToolLoopAgent`, 예측 가능한 제어 흐름에는 structured workflow를 사용하라고 설명한다.

OpenManager의 구현된 TO-BE는 이 둘을 섞은 형태다.

```text
Browser / Vercel BFF
  ├─ QueryGuard              [길이/공격/로그 형태만 deterministic]
  └─ Front NLQ LLM           [intent/entity/executionMode]

Cloud Run AI Engine
  ├─ selectExecutionMode     [confidence gate + small fallback]
  ├─ Direct Router           [preFilterQuery -> resolveDirectRoutingTarget]
  └─ Specialist agents       [Metrics Query / Analyst / Reporter / Advisor / Vision]
```

## "멀티에이전트" 명칭

현재 구현은 더 이상 Orchestrator-Worker 기반 runtime이 아니다. 학술적 의미의 에이전트 간 동적 대화와 중앙 LLM supervisor는 줄어들었고, 엔지니어링 명칭은 **routing-based multi-agent workflow** 또는 **Routing + Tool-Loop Agent workflow**가 가장 정확하다.

제품 문구로 **"여러 전문 AI 에이전트가 협력해 처리한다"** 는 유지 가능하다. 이유는 Metrics Query, Analyst, Reporter, Advisor, Vision이 역할별 tool loop와 provider 정책을 가진 독립 specialist agent로 남아 있기 때문이다. 다만 내부 문서와 코드 주석에서는 `multi-agent`를 단독으로 쓰기보다 **routing-based multi-agent workflow**라고 쓰고, Orchestrator LLM/Supervisor가 런타임 handoff를 결정한다는 표현은 사용하지 않는다.

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
| N1 intentFrame accuracy가 한국어/영어 fixture에서 낮음 | confidence gate와 regex fallback 범위 강화 |
| Direct routing 절감 효과가 미미하거나 specialist 품질 회귀가 큼 | 제한적 hybrid fallback 재검토 |
| Direct routing에서 RCA/report 품질 회귀 발생 | Q3/NLQ N1 intentFrame trust 보강 또는 제한적 hybrid fallback 재검토 |
| Cloud Run min-instances=1 같은 유료 운영이 허용됨 | cold start/latency 압박 완화, Orchestrator 유지 재검토 |

## 구현 참조

- N1 계획: `reports/planning/nlq-preprocessing-redesign-plan.md`
- Q0~Q3 계획: `reports/planning/provider-quota-rebalance-plan.md`
- 현재 routing: `cloud-run/ai-engine/src/domains/monitoring/routing-policy.ts`
- Direct Router: `cloud-run/ai-engine/src/services/ai-sdk/agents/orchestrator-direct-routing.ts`
- Multi-agent execution entrypoint: `cloud-run/ai-engine/src/services/ai-sdk/agents/orchestrator-execution.ts`
- Front frame 전달: `src/hooks/ai/core/createHybridChatTransport.ts`
