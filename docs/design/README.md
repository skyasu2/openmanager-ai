# 디자인 문서 허브

> OpenManager AI의 모듈/기능 상세 설계 카테고리
> Owner: platform-architecture
> Status: Active Canonical
> Doc type: Reference
> Last reviewed: 2026-05-05
> Canonical: docs/design/README.md
> Tags: design,module,api,ui,index

---

## 목적

이 디렉터리는 모듈과 기능을 어떻게 구현했는지 설명하는 **상세 설계 정리본**입니다.
시스템 전체 구조와 배포/데이터 흐름은 [Architecture](../architecture/README.md)에서 관리합니다.

AI 에이전트는 파일을 수정하기 전에 이 디렉터리에서 해당 영역의 책임 경계와 금지 조건을 먼저 확인합니다. 이 문서는 외부 설명서가 아니라 코드 변경을 안전하게 하기 위한 내부 작업 기준입니다.

- `docs/architecture/*`: 시스템 전체 구조, 런타임 연결, 배포, 데이터 흐름
- `docs/design/*`: AI agent, API, monitoring data, error handling, UI 같은 구현 단위 상세 설계
- `docs/reference/architecture/*`: 상세 기준 문서와 원본 SSOT
- `reports/planning/*`: 앞으로 바꿀 작업의 계약, 승인 상태, 남은 TODO
- `reports/qa/*`: 배포/검증 evidence

즉, 이 디렉터리는 큰 그림을 반복하지 않고, 개발자가 특정 모듈을 고칠 때 확인해야 하는 책임 경계와 Do/Don't를 모아 둡니다.

## 영역별 문서

| 영역 | 담당 범위 | 상세 SSOT |
|---|---|---|
| [AI Agent](#ai-agent-설계-경계) | Supervisor, Direct Router, specialist agents, deterministic Eval/Opt | [AI Engine Architecture](../reference/architecture/ai/ai-engine-architecture.md) |
| [API](#api-설계-경계) | Next.js BFF route, Cloud Run API, stream/job/facade contract | [API Endpoints](../reference/api/endpoints.md) |
| [Monitoring Data](#monitoring-data-설계-경계) | OTel dataset, MonitoringDataSource, fact/evidence boundary | [OTel Data Architecture](../reference/architecture/data/otel-data-architecture.md) |
| [Error Handling](./04-error-handling-design.md) | recoverable state, source error contract, deterministic recovery | [Resilience](../reference/architecture/infrastructure/resilience.md) |
| [UI](./05-ui-design.md) | Dashboard, AI workspace, 상태/증거 UI, 화면용 diagram data | [Folder Structure](../reference/architecture/folder-structure.md) |

## 설계 관리 원칙

1. 코드는 최종 사실입니다. 문서와 코드가 다르면 코드 기준으로 문서를 고칩니다.
2. 새 기능보다 현재 구현을 먼저 설명합니다. 아직 없는 기능은 `reports/planning`에 남깁니다.
3. 영역별 문서는 짧은 정리본으로 유지합니다. 세부 구현은 reference 문서와 코드 링크로 보냅니다.
4. 모듈/기능 계약 변경은 같은 작업에서 관련 design 문서를 갱신합니다.
5. 비용, 배포, 보안, LLM 호출 제약은 [AI Standards](../guides/ai/ai-standards.md)를 최종 정책으로 봅니다.

## AI 작업 규칙

1. 수정할 영역을 먼저 이 README의 표에서 찾습니다.
2. 관련 `design/*.md` 문서의 "해야 하는 것/하면 안 되는 것"을 확인합니다.
3. 상세 근거가 필요할 때만 `reference/*` 문서를 추가로 읽습니다.
4. 코드 변경 후 해당 design 문서의 금지 조건이나 책임 경계가 바뀌었는지 확인합니다.
5. 단순 버그 수정은 새 문서를 만들지 않고 기존 문서 또는 `TODO.md` 한 줄로 충분한지 먼저 판단합니다.

## 공통 개발 Do / Don't

| 해야 하는 것 | 하면 안 되는 것 |
|---|---|
| route, provider, data source, UI state 변경 시 이 디렉터리의 관련 영역 문서를 같이 갱신합니다. | 기능만 고치고 설계/제약 문서를 낡은 상태로 두지 않습니다. |
| 기존 reference 문서를 링크하고, 새 문서에는 판단 기준과 요약을 남깁니다. | 같은 내용을 여러 문서에 길게 복제하지 않습니다. |
| Free Tier 제약을 구현 조건으로 먼저 검토합니다. | 비용 문제를 고사양 인스턴스, always-on worker, 무제한 LLM 호출로 해결하지 않습니다. |
| generated 문서는 생성 명령으로 갱신합니다. | 생성 산출물을 손으로 임의 수정하지 않습니다. |
| 큰 계약 변경은 `reports/planning`의 SDD/TDD 게이트를 따릅니다. | plan/contract 없이 API shape, AI stream/tool schema, auth/session 계약을 바꾸지 않습니다. |

## 갱신 기준

| 변경 유형 | 갱신할 설계 영역 |
|---|---|
| Next.js API route 추가/삭제 | [API 설계 경계](#api-설계-경계) |
| AI planner/provider/agent/tool schema 변경 | [AI Agent 설계 경계](#ai-agent-설계-경계) |
| OTel 서버/메트릭/data loader 변경 | [Monitoring Data 설계 경계](#monitoring-data-설계-경계) |
| 오류 contract, recoverable state 변경 | [04-error-handling-design.md](./04-error-handling-design.md) |
| Dashboard/AI workspace UX 변경 | [05-ui-design.md](./05-ui-design.md) |

## 검증 명령

```bash
npm run docs:budget
npm run docs:ai-consistency
npm run docs:links:internal
npm run docs:lint:changed
```

---

## AI Agent 설계 경계

이 영역은 AI runtime의 "내부 구현 단위"를 다룹니다. 전체 stream/job/facade 연결은 [Runtime Architecture](../architecture/02-runtime-architecture.md)를 기준으로 봅니다.

### 구현 단위

| 단위 | 책임 |
|---|---|
| NLQ Pipeline (BFF 전처리) | ChatInputArea UX guard → QueryGuard(공격/로그/장문) → Groq NLQ LLM → `SemanticIntentFrame` + `executionMode` 슬롯 → streaming output filter |
| Supervisor | 요청 수신, `intentFrame` 신뢰 경로 기반 mode 결정, single/multi path 선택, stream metadata 보존 |
| Direct Router (`orchestrator-*` legacy module names) | `preFilterQuery()` 기반 fast path, specialist 직접 routing, deterministic fallback |
| Metrics Query Agent (alias: NLQ Agent) | 서버 메트릭 조회, 필터링, 수식/통계 계산, 용량 추정. 코드 SSOT: `cloud-run/ai-engine/src/services/ai-sdk/agents/nlq-agent.ts` |
| Analyst Agent | anomaly, RCA, trend, monitoring snapshot 분석 |
| Reporter Agent | incident/report artifact 생성과 deterministic Eval/Opt pipeline |
| Advisor Agent | 운영 조치 제안, Knowledge Retrieval Lite evidence 활용 |
| Vision Agent | 이미지/멀티모달 분석, Gemini Flash-Lite 경로 |
| Evaluator/Optimizer | LLM agent가 아니라 deterministic report quality pipeline 내부 단계 |

### 설계 원칙

- simple metric lookup, server snapshot, formatting-only rewrite는 가능한 deterministic path에 남깁니다.
- multi-agent escalation은 RCA, report, advisor, vision처럼 실제 전문 Tool-loop agent가 필요한 경우로 제한합니다.
- 내부 문서에서 `multi-agent`는 **routing-based multi-agent workflow**를 뜻합니다 (중앙 LLM supervisor 동적 handoff가 아님).
- provider selection은 agent 내부 임의 호출이 아니라 runtime policy와 capability gate를 통과해야 합니다.

### 하면 안 되는 것

- Supervisor/Direct Router/Agent마다 서로 다른 provider policy를 하드코딩하지 않습니다.
- formatting-only rewrite를 Reporter pipeline으로 승격하지 않습니다.
- Evaluator/Optimizer를 별도 LLM agent처럼 문서화하지 않습니다.
- production 기본 경로에 신규 LLM 호출을 추가할 때 quota/latency/fallback 검토를 생략하지 않습니다.

상세 SSOT: [AI Engine Architecture](../reference/architecture/ai/ai-engine-architecture.md) | [Artifact System Design](./06-artifact-system.md)

---

## API 설계 경계

API 설계는 route 존재 여부보다 책임 경계와 계약 보존을 우선합니다. 엔드포인트 목록과 요청/응답 계약은 [API Endpoints](../reference/api/endpoints.md)를 기준으로 봅니다.

### 주요 API 그룹

| 그룹 | 대표 route | 책임 |
|---|---|---|
| Health/Version | `/api/health`, `/api/version` | 배포 상태, Cloud Run soft health, version evidence |
| Dashboard data | `/api/servers-unified`, `/api/metrics`, `/api/monitoring/report` | OTel data를 UI 친화 shape로 변환 |
| AI stream | `/api/ai/supervisor/stream/v2` | Cloud Run UIMessageStream proxy, auth/security/context shaping |
| AI job | `/api/ai/jobs/**` | Redis job state, SSE polling, Cloud Tasks dispatch trigger |
| AI artifacts | `/api/ai/incident-report`, `/api/ai/intelligent-monitoring`, `/api/ai/artifact-intent` | artifact intent와 deterministic/LLM-gated artifact 생성 |
| Auth/Security | `/api/auth/**`, `/api/csrf-token`, `/api/security/csp-report` | 인증, CSRF, CSP reporting |

### 설계 원칙

- Vercel route는 BFF/proxy/contract preservation 역할에 집중합니다.
- Cloud Run route는 AI execution과 job worker 역할에 집중합니다.
- 새 AI entrypoint는 기존 stream/job/artifact route 계약을 우회하지 않도록 제한합니다.
- route 추가/삭제는 API catalog와 architecture 문서를 같이 갱신합니다.
- 실패 응답은 code/source/requestId/recoverable 같은 진단 가능한 metadata를 유지합니다.

### 하면 안 되는 것

- BFF route에서 장시간 multi-agent 작업을 직접 완료하려고 하지 않습니다.
- stream route와 job route의 의미를 섞어 progress/result contract를 깨지 않습니다.
- artifact intent가 불확실한 요청을 자동으로 LLM-heavy artifact pipeline으로 승격하지 않습니다.
- auth/session/security 처리를 우회하는 내부 route를 새로 만들지 않습니다.

상세 SSOT: [API Endpoints](../reference/api/endpoints.md) | [Runtime Architecture](../architecture/02-runtime-architecture.md)

---

## Monitoring Data 설계 경계

전체 데이터 흐름은 [Data Flow Architecture](../architecture/04-data-flow.md)를 기준으로 보고, 이 영역은 모듈 내부 계약을 정리합니다.

### 구현 단위

| 단위 | 책임 |
|---|---|
| `public/data/otel-data` | 18대 서버, 24시간, 10분 슬롯 synthetic OTel runtime SSOT |
| `src/data/otel-data/index.ts` | frontend/runtime async loader |
| `MetricsProvider` | Dashboard용 server metrics shape 변환과 cache |
| `precomputed-state.ts` | Cloud Run AI Engine의 OTel state loader |
| `MonitoringDataSource` | replay-json/live-otel provider boundary |
| `MonitoringFactPack` | metric severity, evidence refs, queryAsOf를 deterministic fact로 고정 |
| Knowledge Retrieval Lite | KB evidence search와 recall guard |

### 설계 원칙

- metric severity는 deterministic rule이 책임지고, LLM은 설명과 formatting에 제한됩니다.
- `queryAsOf`와 10분 슬롯 기준을 보존해 Dashboard와 AI가 같은 시점을 보게 합니다.
- `live-otel`은 미래 연결 skeleton이며 기본 runtime source가 아닙니다.
- evidence refs는 report/artifact/UI에서 추적 가능해야 합니다.

### 하면 안 되는 것

- 실제 Prometheus/OTLP/Loki 수집을 기본 path로 추가하지 않습니다.
- AI가 fact pack 없이 metric severity를 독립 판단하게 하지 않습니다.
- Dashboard와 AI가 서로 다른 서버 inventory를 보게 두지 않습니다.
- 외부 embedding/reranking/web fallback을 기본 retrieval path로 넣지 않습니다.

상세 SSOT: [OTel Data Architecture](../reference/architecture/data/otel-data-architecture.md) | [Data Architecture](../reference/architecture/data/data-architecture.md) | [RAG Knowledge Engine](../reference/architecture/ai/rag-knowledge-engine.md)
