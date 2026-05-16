# ADR 문서 허브

> Architecture Decision Record 인덱스
> Owner: platform-architecture
> Status: Active Canonical
> Doc type: Reference
> Last reviewed: 2026-05-05
> Canonical: docs/adr/README.md
> Tags: adr,decisions,architecture

---

## 관리 원칙

ADR은 “왜 그렇게 결정했는가”를 남기는 문서입니다.
현재 ADR 본문은 `docs/adr/`를 기준으로 관리합니다. `reference/architecture`에는 구조 설명과 상세 레퍼런스를 두고, 되돌리기 어려운 결정의 이유는 이 디렉터리에서 찾습니다.

이 프로젝트는 이미 구현이 많이 진행된 brownfield 상태이므로, ADR은 모든 과거 대화를 복원하는 문서가 아니라 앞으로 되돌리기 어려운 결정과 이미 확정된 핵심 구조를 이해하기 위한 짧은 결정 로그로 관리합니다.

## 현재 ADR

| ADR | 결정 |
|---|---|
| [ADR-001](../archived/decisions/adr-001-unified-ai-engine-cache-and-providers.md) | Unified AI Engine Cache and Providers |
| [ADR-002](./adr-002-server-card-rendering-strategy.md) | Server Card Rendering Strategy |
| [ADR-003](./adr-003-promql-vs-js-array-filtering.md) | PromQL vs JS Array Filtering |
| [ADR-004](./adr-004-vercel-ai-sdk-over-langchain.md) | Vercel AI SDK over LangChain |
| [ADR-005](./adr-005-routing-pattern-over-orchestrator-worker.md) | Routing Pattern 전환 (Orchestrator LLM 제거, 2026-05-16) |

> ADR-005는 `Status: Accepted`이며 Q2 구현으로 Cloud Run request path에서 Orchestrator LLM을 제거하는 결정을 고정합니다.

## 새 ADR 작성 기준

- 이미 결정된 큰 구조를 나중에 이해해야 할 때 작성합니다.
- 단순 구현 노트나 TODO는 ADR이 아니라 `reports/planning` 또는 관련 design 문서에 둡니다.
- ADR은 append-only 성격을 유지하고, 결정이 바뀌면 새 ADR을 추가합니다.
- API shape, AI stream/tool schema, auth/session, deployment authority, data SSOT처럼 구조/품질 속성에 영향을 주는 결정만 ADR로 승격합니다.
