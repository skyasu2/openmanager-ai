# Monitoring Data 상세 설계

> OTel dataset, MonitoringDataSource, fact/evidence boundary를 설명하는 상세 설계
> Owner: platform-data
> Status: Active
> Doc type: Reference
> Last reviewed: 2026-05-05
> Canonical: docs/design/03-monitoring-data-design.md
> Tags: design,data,monitoring,otel,evidence

---

## 담당 범위

전체 데이터 흐름은 [Data Flow Architecture](../architecture/04-data-flow.md)를 기준으로 보고, 이 문서는 모듈 내부 계약을 정리합니다.

## 구현 단위

| 단위 | 책임 |
|---|---|
| `public/data/otel-data` | 18대 서버, 24시간, 10분 슬롯 synthetic OTel runtime SSOT |
| `src/data/otel-data/index.ts` | frontend/runtime async loader |
| `MetricsProvider` | Dashboard용 server metrics shape 변환과 cache |
| `precomputed-state.ts` | Cloud Run AI Engine의 OTel state loader |
| `MonitoringDataSource` | replay-json/live-otel provider boundary |
| `MonitoringFactPack` | metric severity, evidence refs, queryAsOf를 deterministic fact로 고정 |
| Knowledge Retrieval Lite | KB evidence search와 recall guard |

## 설계 원칙

- metric severity는 deterministic rule이 책임지고, LLM은 설명과 formatting에 제한됩니다.
- `queryAsOf`와 10분 슬롯 기준을 보존해 Dashboard와 AI가 같은 시점을 보게 합니다.
- `live-otel`은 미래 연결 skeleton이며 기본 runtime source가 아닙니다.
- evidence refs는 report/artifact/UI에서 추적 가능해야 합니다.

## 하면 안 되는 것

- 실제 Prometheus/OTLP/Loki 수집을 기본 path로 추가하지 않습니다.
- AI가 fact pack 없이 metric severity를 독립 판단하게 하지 않습니다.
- Dashboard와 AI가 서로 다른 서버 inventory를 보게 두지 않습니다.
- 외부 embedding/reranking/web fallback을 기본 retrieval path로 넣지 않습니다.

## 상세 문서

- [Data Flow Architecture](../architecture/04-data-flow.md)
- [OTel Data Architecture](../reference/architecture/data/otel-data-architecture.md)
- [Data Architecture](../reference/architecture/data/data-architecture.md)
- [RAG Knowledge Engine](../reference/architecture/ai/rag-knowledge-engine.md)
