# Reference

> 기술 레퍼런스 문서 인덱스
> Owner: platform-architecture
> Status: Active Canonical
> Doc type: Reference
> Last reviewed: 2026-05-05
> Canonical: docs/reference/README.md
> Tags: reference,index,architecture

## Core References

포트폴리오나 신규 작업자가 빠르게 구조를 파악할 때는 `architecture/`와 `design/`을 먼저 보고, 구현 근거가 필요할 때 이 `reference/` 문서를 봅니다.

- [API Endpoints](./api/endpoints.md)
- [API Contracts](./api/contracts.md)
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
- [AI Assistant Initial Design Comparison](./architecture/ai/ai-assistant-initial-design-comparison.md)
- [API Endpoints](./api/endpoints.md)
- [API Contracts](./api/contracts.md)
- [Frontend/Backend Comparison](./architecture/ai/frontend-backend-comparison.md)
- [Monitoring ML](./architecture/ai/monitoring-ml.md)
- [RAG Knowledge Engine](./architecture/ai/rag-knowledge-engine.md)

### Data
- [Data Architecture](./architecture/data/data-architecture.md)
- [OTel Data Architecture](./architecture/data/otel-data-architecture.md)
- [Monitoring Stack Comparison](./architecture/data/monitoring-stack-comparison.md)

### Project Specs
- [WBS (모듈 기반)](./project/wbs.md)
- [Requirements (SRS)](./project/requirements.md)
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
- [Design Consistency](./architecture/design/consistency.md)

### Decisions (ADR)
- [ADR Index](../adr/README.md)
- [ADR-002](../adr/adr-002-server-card-rendering-strategy.md)
- [ADR-003](../adr/adr-003-promql-vs-js-array-filtering.md)

### Historical / Archived

- [Server Metadata Comparison](../archived/server-metadata-comparison.md) — v8.0.0 기준 비교 기록. 현재 데이터 SSOT는 [OTel Data Architecture](./architecture/data/otel-data-architecture.md)를 사용합니다.

## Related

- [Docs Home](../README.md)
- [Guides](../guides/README.md)
- [Development](../development/README.md)
- [Operations](../operations/README.md)
- [Troubleshooting](../troubleshooting/README.md)
