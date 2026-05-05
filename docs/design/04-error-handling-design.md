# 오류 처리 상세 설계

> 사용자-facing 오류, recoverable 상태, monitoring source 오류 계약을 설명하는 상세 설계
> Owner: platform-architecture
> Status: Active
> Doc type: Reference
> Last reviewed: 2026-05-05
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
| Monitoring source error | `code`, `sourceMode`, `queryAsOf`, `requestId`, `recoverable` 포함 |
| Artifact intent false-positive | formatting-only rewrite는 artifact/job/report pipeline으로 승격하지 않음 |
| Job queue error | Redis job state와 SSE result/error contract를 통해 브라우저에 전달 |
| Security/input error | BFF에서 auth, CSRF, prompt injection, request shape를 먼저 검증 |

## 설계 원칙

- 사용자에게 보여 줄 오류와 운영자가 추적할 metadata를 분리합니다.
- recoverable cold-start/degraded 상태는 hard failure cache로 저장하지 않습니다.
- deterministic recovery 성공 여부는 stream metadata와 UI state에 일관되게 반영합니다.
- source error는 generic 500으로 뭉개지 않고 진단 가능한 code를 유지합니다.

## 하면 안 되는 것

- Cloud Run warmup timeout을 즉시 fatal 상태로 고정하지 않습니다.
- tool result로 정상 응답을 복구한 뒤에도 사용자-facing `success=false`를 남기지 않습니다.
- monitoring source 오류를 fallback으로 숨겨 실제 source drift를 알 수 없게 만들지 않습니다.
- 모든 오류를 재시도만으로 해결하려 하지 않습니다. 비용/쿼터 영향을 같이 봅니다.

## 상세 문서

- [Resilience](../reference/architecture/infrastructure/resilience.md)
- [API Contracts](../reference/api/contracts.md)
- [AI Engine Architecture](../reference/architecture/ai/ai-engine-architecture.md)
- [Monitoring AI Data Source Plan](../../reports/planning/monitoring-ai-data-source-plan.md)
