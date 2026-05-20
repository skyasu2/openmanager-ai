# 레퍼런스 허브

> 기술 레퍼런스 문서 인덱스
> Owner: platform-architecture
> Status: Active Canonical
> Doc type: Reference
> Last reviewed: 2026-05-20
> Canonical: docs/reference/README.md
> Tags: reference,index,architecture

## Core References

포트폴리오나 신규 작업자가 빠르게 구조를 파악할 때는 `architecture/`와 `design/`을 먼저 보고, 구현 근거가 필요할 때 이 `reference/` 문서를 봅니다.

- [API Endpoints](./api/endpoints.md)
- [API 계약 거버넌스](./api/endpoints.md#api-계약-거버넌스)
- [System Architecture (Hybrid 포함)](./architecture/system/system-architecture-current.md)
- [AI Engine Architecture](./architecture/ai/ai-engine-architecture.md)
- [OTel Data Architecture](./architecture/data/otel-data-architecture.md)
- [Database](./architecture/infrastructure/database.md)
- [Security](./architecture/infrastructure/security.md)

## Architecture Index

- [Architecture](../architecture/README.md)
- [Design](../design/README.md)
- [Operations](../operations/README.md)
- [ADR Index](../adr/README.md)
- [Architecture Design Index](./architecture/README.md)

### AI
- [AI Engine Architecture](./architecture/ai/ai-engine-architecture.md)
- [API Endpoints](./api/endpoints.md)
- [API 계약 거버넌스](./api/endpoints.md#api-계약-거버넌스)
- [Frontend/Backend Comparison](./architecture/ai/frontend-backend-comparison.md)
- [Monitoring ML](./architecture/ai/monitoring-ml.md)
- [RAG Knowledge Engine](./architecture/ai/rag-knowledge-engine.md)

### Data
- [Data Architecture](./architecture/data/data-architecture.md)
- [OTel Data Architecture](./architecture/data/otel-data-architecture.md)
- [Monitoring Stack Comparison](./architecture/data/monitoring-stack-comparison.md)

### Project Specs
- [Definition of Done](./project/definition-of-done.md)

### Infrastructure
- [Database](./architecture/infrastructure/database.md)
- [Security](./architecture/infrastructure/security.md)
- [Resilience (Circuit Breaker & Fallback)](./architecture/infrastructure/resilience.md)
- [Free Tier Optimization](./architecture/infrastructure/free-tier-optimization.md)

### System and Design
- [System Architecture (Current)](./architecture/system/system-architecture-current.md)
- [Frontend Component Dependency Map](./architecture/system/component-dependency-map.md)
- [Folder Structure](./architecture/folder-structure.md)
- [Data Architecture (일관성 계약 포함)](./architecture/data/data-architecture.md)

### Decisions (ADR)
- [ADR Index](../adr/README.md)
- [ADR-002](../adr/adr-002-server-card-rendering-strategy.md)
- [ADR-003](../adr/adr-003-promql-vs-js-array-filtering.md)

### Historical / Archived

- [AI Assistant Initial Design Comparison](../archived/ai-assistant-initial-design-comparison.md) — 초기 대안 비교와 의사결정 이력. 현재 AI runtime 기준은 [AI Engine Architecture](./architecture/ai/ai-engine-architecture.md)를 사용합니다.
- [프로젝트 변천사](../history/project-evolution.md) — 주요 아키텍처 전환 이력. 현재 데이터 SSOT는 [OTel Data Architecture](./architecture/data/otel-data-architecture.md)를 사용합니다.

## Related

- [Docs Home](../README.md)
- [Guides](../guides/README.md)
- [Development](../development/README.md)
- [Operations](../operations/README.md)
- [Troubleshooting](../troubleshooting/README.md)
