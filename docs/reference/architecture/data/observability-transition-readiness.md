# Observability Transition Readiness

> Last verified against code: 2026-02-13
> Status: Active Canonical
> Doc type: Reference

## Purpose

이 문서는 OpenManager AI의 관측성 데이터가 "시뮬레이션 기반"임을 명확히 하면서, 실제 환경 전환 가능성을 코드 기준으로 정리합니다.

## Current Reality (As-Is)

| 영역 | 현재 구현 | 코드 근거 |
|---|---|---|
| Prometheus 데이터 | `scripts/data/sync-hourly-data.ts`가 synthetic `hourly-data` JSON 생성 | `scripts/data/sync-hourly-data.ts` |
| OTel 데이터 | `hourly-data`를 빌드 타임에 OTel 시맨틱으로 변환한 derived JSON | `scripts/data/otel-precompute.ts` |
| 런타임 메트릭 소스 | `MetricsProvider`가 `otel-processed -> hourly-data` 순서로 로드 | `src/services/metrics/MetricsProvider.ts` |
| `/api/metrics` | 쿼리 수신 후 내부 데이터 조회 (query endpoint) | `src/app/api/metrics/route.ts` |
| `/api/logs` | Supabase `server_logs` CRUD API | `src/app/api/logs/route.ts` |
| Loki 포맷 | UI/내부 유틸에서 Loki 호환 구조 생성 (실제 ingest API 없음) | `src/services/server-data/loki-log-generator.ts` |

## Explicit Non-Goals (현재 범위 밖)

- 실서버 node_exporter scrape 연동
- OTel Collector에서 OTLP push 수신
- Prometheus TSDB/remote_write 연동
- Loki `/loki/api/v1/push` 및 LogQL API 제공

## Why This Is Still Valuable

- 무료 티어 환경에서 비용 없이 재현 가능한 장애 패턴 제공
- Prometheus/OTel/Loki와 유사한 데이터 계약을 코드에서 유지
- 런타임 소비 계층(`MetricsProvider`, API route)이 분리되어 실제 수집기로 교체 가능한 구조 확보

## Transition Gap Matrix (To-Be)

| 전환 항목 | 현재 상태 | 전환 시 작업 | 난이도 |
|---|---|---|---|
| Metrics Ingest | 파일 로드 | OTLP/Prometheus 수신 어댑터 추가, Provider 교체 | 중 |
| Time-Series Storage | JSON 번들 | TSDB(Prometheus/Mimir/Thanos 등) 연결 | 중 |
| Query Layer | 단순/내부 PromQL | 표준 Prometheus Query API adapter | 중 |
| Log Ingest | Supabase CRUD + Loki 형식 생성 | Loki push/query API 연동 | 중 |
| Source Switching | 암묵적(코드 분기) | `SyntheticProvider`/`RealProvider` env 전환 명시 | 하 |

## Public Disclosure Template

다음 문구를 README 또는 프로젝트 소개 문서에 사용할 수 있습니다.

```text
This project uses synthetic observability data for free-tier operation.
Metrics are generated in Prometheus-like JSON, then transformed into OTel-like derived data at build time.
Runtime consumers are designed with provider boundaries so real Prometheus/OTLP/Loki ingestion can replace the synthetic source without changing UI/business logic.
```

## Guardrails for Future Changes

- `synthetic`/`derived` 출처 표기를 문서와 API 응답 메타데이터에서 유지
- JSON 스키마 검증과 `schemaVersion` 변경 규칙을 CI로 강제
- "실제 수집기 연동" 문구는 코드/엔드포인트가 준비되기 전 사용 금지

## Related

- [Data Architecture](./data-architecture.md)
- [OTel Pipeline Audit](./otel-pipeline-audit.md)
- [Prometheus Comparison](./prometheus-comparison.md)
- [API Endpoints](../../api/endpoints.md)
