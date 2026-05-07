# AI Agent 상세 설계

> AI Agent 모듈 내부 책임과 구현 금지 조건을 설명하는 상세 설계
> Owner: platform-architecture
> Status: Active
> Doc type: Reference
> Last reviewed: 2026-05-05
> Canonical: docs/design/01-ai-agent-design.md
> Tags: design,ai,agent,supervisor

---

## 담당 범위

이 문서는 AI runtime의 “내부 구현 단위”를 다룹니다. 전체 stream/job/facade 연결은 [Runtime Architecture](../architecture/02-runtime-architecture.md)를 기준으로 봅니다.

## 구현 단위

| 단위 | 책임 |
|---|---|
| Supervisor | 요청 수신, mode 결정, single/multi path 선택, stream metadata 보존 |
| Orchestrator | intent routing, pre-filter, specialist handoff, deterministic summary fallback |
| NLQ Agent | 서버/메트릭 조회와 데이터 기반 질의 응답 |
| Analyst Agent | anomaly, RCA, trend, monitoring snapshot 분석 |
| Reporter Agent | incident/report artifact 생성과 deterministic Eval/Opt pipeline |
| Advisor Agent | 운영 조치 제안, Knowledge Retrieval Lite evidence 활용 |
| Vision Agent | 이미지/멀티모달 분석, Gemini Flash-Lite 경로 |
| Evaluator/Optimizer | LLM agent가 아니라 deterministic report quality pipeline 내부 단계 |

## 설계 원칙

- simple metric lookup, server snapshot, formatting-only rewrite는 가능한 deterministic path에 남깁니다.
- multi-agent escalation은 RCA, report, advisor, vision처럼 실제 전문 agent가 필요한 경우로 제한합니다.
- provider selection은 agent 내부 임의 호출이 아니라 runtime policy와 capability gate를 통과해야 합니다.
- `plannerShadow`는 authority가 아니라 관측/비교 metadata입니다.

## 하면 안 되는 것

- Supervisor/Orchestrator/Agent마다 서로 다른 provider policy를 하드코딩하지 않습니다.
- formatting-only rewrite를 Reporter pipeline으로 승격하지 않습니다.
- Evaluator/Optimizer를 별도 LLM agent처럼 문서화하지 않습니다.
- production 기본 경로에 신규 LLM 호출을 추가할 때 quota/latency/fallback 검토를 생략하지 않습니다.

## 상세 문서

- [Runtime Architecture](../architecture/02-runtime-architecture.md)
- [AI Engine Architecture](../reference/architecture/ai/ai-engine-architecture.md)
- [AI Assistant Architecture Evolution Plan](../../reports/planning/archive/ai-assistant-architecture-evolution-plan.md)
