# 아키텍처 문서 허브

> 시스템 전체 구조와 런타임 연결 관계를 설명하는 아키텍처 카테고리
> Owner: platform-architecture
> Status: Active Canonical
> Doc type: Reference
> Last reviewed: 2026-05-05
> Canonical: docs/architecture/README.md
> Tags: architecture,index,as-built

---

## 구분 기준

`docs/architecture`는 시스템 전체 그림을 다룹니다.
모듈 내부 구현 방식, API shape, UI 상태 관리, 오류 처리 세부 설계는 [docs/design](../design/README.md)에서 관리합니다.

AI 에이전트가 구조 질문을 받거나 큰 변경을 시작할 때는 이 문서를 먼저 보고, 실제 수정 전에는 관련 `design` 문서와 상세 `reference` 문서를 좁혀서 확인합니다.

| 카테고리 | 다루는 질문 |
|---|---|
| architecture | 전체 시스템이 어떻게 생겼고, 어떤 런타임/서비스가 어떻게 연결되는가 |
| design | 각 기능/모듈을 어떻게 구현했고, 어떤 계약과 금지 조건을 지켜야 하는가 |
| operations | 배포, 환경, 장애 대응, QA evidence를 어떻게 운영하는가 |
| adr | 왜 그 결정을 했고, 어떤 대안을 버렸는가 |

## 문서 목록

| 순서 | 문서 | 담당 범위 |
|---:|---|---|
| 1 | [system-design-guide.md](./system-design-guide.md) | Browser, Vercel BFF, Cloud Run, Supabase, Redis, Cloud Tasks 경계 |
| 2 | [02-runtime-architecture.md](./02-runtime-architecture.md) | AI runtime, stream/job/facade, Supervisor/Orchestrator 흐름 |
| 3 | [03-deployment-architecture.md](./03-deployment-architecture.md) | GitLab CI, Vercel, Cloud Run, GitHub public snapshot, QA recording |
| 4 | [04-data-flow.md](./04-data-flow.md) | synthetic OTel data, Dashboard/AI data flow, retrieval grounding |
| - | [다이어그램 인덱스](#다이어그램-인덱스) | Mermaid/source diagram 위치와 화면용 diagram data |

## 상세 SSOT

이 디렉터리는 as-built 아키텍처 정리본입니다. 세부 기준은 아래 reference 문서를 따릅니다.

- [Architecture Design Index](../reference/architecture/README.md)
- [System Architecture](../reference/architecture/system/system-architecture-current.md)
- [AI Engine Architecture](../reference/architecture/ai/ai-engine-architecture.md)
- [OTel Data Architecture](../reference/architecture/data/otel-data-architecture.md)
- [Free Tier Optimization](../reference/architecture/infrastructure/free-tier-optimization.md)

## 갱신 기준

| 변경 유형 | 갱신할 문서 |
|---|---|
| 서비스/런타임 경계 변경 | `system-design-guide.md` |
| AI stream/job/facade 또는 Supervisor/Orchestrator 변경 | `02-runtime-architecture.md` |
| 배포 권위, remote, CI, QA recording 변경 | `03-deployment-architecture.md` |
| OTel dataset, MonitoringDataSource, retrieval grounding 변경 | `04-data-flow.md` |
| 제품 화면용 diagram 또는 Mermaid diagram 변경 | [다이어그램 인덱스](#다이어그램-인덱스) 참조 |

## 다이어그램 인덱스

### Markdown Mermaid / ASCII 다이어그램

| 영역 | 문서 |
|---|---|
| 시스템 전체 | [System Architecture](../reference/architecture/system/system-architecture-current.md) |
| AI runtime | [AI Engine Architecture](../reference/architecture/ai/ai-engine-architecture.md) |
| Frontend/Backend AI 경계 | [Frontend/Backend Comparison](../reference/architecture/ai/frontend-backend-comparison.md) |
| OTel data flow | [OTel Data Architecture](../reference/architecture/data/otel-data-architecture.md) |
| Knowledge Retrieval | [RAG Knowledge Engine](../reference/architecture/ai/rag-knowledge-engine.md) |
| 컴포넌트 의존도 | [Component Dependency Map](../reference/architecture/system/component-dependency-map.md) |

### 제품 화면용 다이어그램 데이터

| 카드 ID | 데이터 파일 |
|---|---|
| `ai-assistant` | [src/data/architecture-diagrams/ai-assistant.ts](../../src/data/architecture-diagrams/ai-assistant.ts) |
| `cloud-platform` | [src/data/architecture-diagrams/cloud-platform.ts](../../src/data/architecture-diagrams/cloud-platform.ts) |
| `infrastructure-topology` | [src/data/architecture-diagrams/infrastructure-topology.ts](../../src/data/architecture-diagrams/infrastructure-topology.ts) |
| `tech-stack` | [src/data/architecture-diagrams/tech-stack.ts](../../src/data/architecture-diagrams/tech-stack.ts) |
| `vibe-coding` | [src/data/architecture-diagrams/vibe-coding.ts](../../src/data/architecture-diagrams/vibe-coding.ts) |

### 관리 규칙

- 문서용 다이어그램은 Markdown/Mermaid를 우선합니다.
- 제품 UI에서 렌더링되는 다이어그램은 `src/data/architecture-diagrams/*`를 SSOT로 봅니다.
- `component-dependency-map.md`는 생성 산출물이므로 `npm run docs:components:map`으로만 갱신합니다.
- 다이어그램이 코드 경계와 다르면 코드 기준으로 문서를 갱신합니다.

## AI 참조 규칙

- 전체 구조 설명은 이 디렉터리에서 답하고, 세부 구현 판단은 [Design](../design/README.md)로 넘깁니다.
- 현재 구현과 다른 과거 설계는 `reference`에 남기지 말고 supporting/archived로 낮춥니다.
- 사용자가 "왜 이렇게 되어 있나"를 물으면 [ADR](../adr/README.md) 또는 관련 planning archive를 함께 확인합니다.
