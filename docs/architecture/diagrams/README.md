# 아키텍처 다이어그램 위치

> Mermaid/source diagram과 화면용 diagram data 위치를 모아 둔 다이어그램 인덱스
> Owner: platform-architecture
> Status: Active
> Doc type: Reference
> Last reviewed: 2026-05-05
> Canonical: docs/architecture/diagrams/README.md
> Tags: architecture,diagrams,mermaid,ui-data

---

## Markdown Mermaid / ASCII 다이어그램

| 영역 | 문서 |
|---|---|
| 시스템 전체 | [System Architecture](../../reference/architecture/system/system-architecture-current.md) |
| AI runtime | [AI Engine Architecture](../../reference/architecture/ai/ai-engine-architecture.md) |
| Frontend/Backend AI 경계 | [Frontend/Backend Comparison](../../reference/architecture/ai/frontend-backend-comparison.md) |
| OTel data flow | [OTel Data Architecture](../../reference/architecture/data/otel-data-architecture.md) |
| Knowledge Retrieval | [RAG Knowledge Engine](../../reference/architecture/ai/rag-knowledge-engine.md) |
| 컴포넌트 의존도 | [Component Dependency Map](../../reference/architecture/system/component-dependency-map.md) |

## 제품 화면용 다이어그램 데이터

| 카드 ID | 데이터 파일 |
|---|---|
| `ai-assistant` | [../../../src/data/architecture-diagrams/ai-assistant.ts](../../../src/data/architecture-diagrams/ai-assistant.ts) |
| `cloud-platform` | [../../../src/data/architecture-diagrams/cloud-platform.ts](../../../src/data/architecture-diagrams/cloud-platform.ts) |
| `infrastructure-topology` | [../../../src/data/architecture-diagrams/infrastructure-topology.ts](../../../src/data/architecture-diagrams/infrastructure-topology.ts) |
| `tech-stack` | [../../../src/data/architecture-diagrams/tech-stack.ts](../../../src/data/architecture-diagrams/tech-stack.ts) |
| `vibe-coding` | [../../../src/data/architecture-diagrams/vibe-coding.ts](../../../src/data/architecture-diagrams/vibe-coding.ts) |

## 관리 규칙

- 문서용 다이어그램은 Markdown/Mermaid를 우선합니다.
- 제품 UI에서 렌더링되는 다이어그램은 `src/data/architecture-diagrams/*`를 SSOT로 봅니다.
- `component-dependency-map.md`는 생성 산출물이므로 `npm run docs:components:map`으로만 갱신합니다.
- 다이어그램이 코드 경계와 다르면 코드 기준으로 문서를 갱신합니다.
