# 오류 처리 상세 설계

> 사용자-facing 오류, recoverable 상태, monitoring source 오류 계약을 설명하는 상세 설계
> Owner: platform-architecture
> Status: Active
> Doc type: Reference
> Last reviewed: 2026-05-06
> Canonical: docs/design/04-error-handling-design.md
> Tags: design,error-handling,resilience,contract

---

## 담당 범위

오류 처리는 “실패를 숨기지 않되, recoverable 상태를 치명 오류로 오판하지 않는 것”을 목표로 합니다.

## 주요 오류 경계

| 경계 | 설계 기준 |
|---|---|
| Cloud Run cold start | `/api/health?service=ai&soft=true`는 timeout을 recoverable degraded/warming으로 표현 |
| AI stream provider error | tool result 기반 deterministic recovery가 성공하면 후행 provider error를 사용자-facing 실패로 확정하지 않음 |
| Monitoring source error | Deterministic monitoring route 오류에 `code`, `sourceMode`, `queryAsOf`, `requestId`, `recoverable` 포함 |
| Artifact intent false-positive | formatting-only rewrite는 artifact/job/report pipeline으로 승격하지 않음 |
| Job queue error | Redis job state와 SSE result/error contract를 통해 브라우저에 전달 |
| Security/input error | BFF에서 auth, CSRF, prompt injection, request shape를 먼저 검증 |

## 설계 원칙

- 사용자에게 보여 줄 오류와 운영자가 추적할 metadata를 분리합니다.
- recoverable cold-start/degraded 상태는 hard failure cache로 저장하지 않습니다.
- deterministic recovery 성공 여부는 stream metadata와 UI state에 일관되게 반영합니다.
- source error는 generic 500으로 뭉개지 않고 진단 가능한 code를 유지합니다.

## Monitoring Source Error Boundary

`monitoring source error contract`는 현재 deterministic monitoring route 전용 계약입니다.

적용 범위:

- Cloud Run `POST /api/ai/monitoring/snapshot`
- Cloud Run `POST /api/ai/monitoring/analyze-batch`
- Vercel `POST /api/ai/intelligent-monitoring` 중 batch 분석이 Cloud Run monitoring source 오류를 pass-through하는 경로

표준 오류 응답은 다음 필드를 유지합니다.

| 필드 | 의미 |
|---|---|
| `success: false` | 성공 payload와 구분 |
| `error` | 사용자-facing 오류 메시지 |
| `code` | `LIVE_SOURCE_DISABLED`, `DATA_SOURCE_UNAVAILABLE`, `SNAPSHOT_STALE`, `SLOT_NOT_FOUND`, `SERVER_NOT_FOUND`, `METRIC_NOT_FOUND` 중 하나 |
| `sourceMode` | `replay-json` 또는 `live-otel` |
| `queryAsOf` | 오류가 발생한 데이터 기준 시각 |
| `requestId` | Cloud Run/Vercel 추적용 요청 ID |
| `recoverable` | 재시도 또는 fallback 판단용 boolean |

`/api/ai/intelligent-monitoring`의 batch pass-through는 이 오류를 generic fallback으로 숨기지 않습니다. Cloud Run status와 payload를 보존해 `live-otel` disabled, stale snapshot, slot/server/metric miss를 운영자가 구분할 수 있게 합니다.

비적용 범위:

- Cloud Run `POST /api/ai/analyze-server`는 기존 server analysis compatibility route입니다. tool-only deterministic insight를 반환하지만 `analytics-monitoring-error.ts`의 standard monitoring source error contract로 승격하지 않고 기존 generic `handleApiError` 경계를 유지합니다.
- Cloud Run/Vercel `POST /api/ai/incident-report`는 보고서 availability를 우선합니다. monitoring grounding 또는 Reporter Agent가 실패하면 가능한 경우 tool-based/degraded fallback을 반환하며, grounding 실패를 standard monitoring source hard error로 올리지 않습니다.

향후 `/analyze-server` 또는 `/incident-report`를 동일 오류 계약으로 편입하려면 별도 plan에서 API status, fallback availability, UI copy, QA contract를 함께 변경해야 합니다.

## 하면 안 되는 것

- Cloud Run warmup timeout을 즉시 fatal 상태로 고정하지 않습니다.
- tool result로 정상 응답을 복구한 뒤에도 사용자-facing `success=false`를 남기지 않습니다.
- deterministic monitoring route의 source 오류를 fallback으로 숨겨 실제 source drift를 알 수 없게 만들지 않습니다.
- 모든 오류를 재시도만으로 해결하려 하지 않습니다. 비용/쿼터 영향을 같이 봅니다.

## 상세 문서

- [Resilience](../reference/architecture/infrastructure/resilience.md)
- [API Contracts](../reference/api/contracts.md)
- [AI Engine Architecture](../reference/architecture/ai/ai-engine-architecture.md)
- [Monitoring AI Data Source Plan](../../reports/planning/archive/monitoring-ai-data-source-plan.md)
