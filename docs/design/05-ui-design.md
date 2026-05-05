# 프론트엔드 경험 설계

> Dashboard, AI workspace, 상태/증거 UI, 화면용 설계도 데이터를 설명하는 구현 기준 설계
> Owner: frontend-platform
> Status: Active
> Doc type: Reference
> Last reviewed: 2026-05-05
> Canonical: docs/design/05-ui-design.md
> Tags: design,frontend,dashboard,ai-workspace,ui

---

## 현재 구현 요약

프론트엔드는 운영 도구 성격의 대시보드와 AI Assistant를 한 경험 안에 묶습니다.

- Dashboard는 18대 synthetic server 상태, 로그, 알림, topology를 표시합니다.
- AI workspace/sidebar는 stream, job, artifact, analysis basis, provider/model evidence를 표시합니다.
- `SystemContextPanel`과 관련 UI는 Cloud Run health, provider/model, warmup 상태를 관측 가능하게 합니다.
- 제품 화면에서 보이는 설계도는 `src/data/architecture-diagrams/*` TS 데이터로 관리됩니다.
- 완료된 assistant 응답은 typewriter 재생이 아니라 Markdown renderer 중심으로 표시합니다.

## 설계도

```mermaid
flowchart TB
    Browser["Browser"] --> App["Next.js App Router"]
    App --> Dashboard["Dashboard Client"]
    App --> AI["AI Workspace / Sidebar"]

    Dashboard --> Metrics["useServerDashboard / MetricsProvider"]
    Dashboard --> Topology["TopologyModal"]
    Topology --> DiagramData["architecture-diagrams data"]

    AI --> ChatCore["useAIChatCore / useHybridAIQuery"]
    AI --> Context["SystemContextPanel"]
    AI --> Artifacts["Incident / Monitoring / Snapshot Artifacts"]
    Context --> Health["/api/health?service=ai&soft=true"]
    ChatCore --> Stream["AI stream/job/facade routes"]
```

## 구현된 영역

| 영역 | 구현 내용 |
|---|---|
| Dashboard | 서버 카드, 서버 상세, 로그/알림, topology modal, 24h 순환 데이터 표시 |
| AI Workspace | stream 응답, job SSE, artifact generation, analysis basis, provider/model 표시 |
| Health UX | Cloud Run cold-start soft degraded를 hard failure가 아니라 warming 상태로 표시 |
| Stream UX | warmup countdown, agent step event, resumable stream option |
| Evidence UI | 마지막 assistant 응답 provider/model, fact/evidence boundary 표시 |
| Product diagrams | `ai-assistant`, `cloud-platform`, `infrastructure-topology`, `tech-stack`, `vibe-coding` |

## 해야 하는 것

- 운영 도구 UI는 반복 사용과 스캔이 쉬운 밀도와 구조를 우선합니다.
- Dashboard와 AI가 같은 OTel/MonitoringFactPack 근거를 보도록 경계를 맞춥니다.
- 화면용 설계도 데이터가 실제 runtime 구조와 다르면 같은 작업에서 갱신합니다.
- 상태 UI는 hard failure, degraded, warming, recoverable을 구분해 표시합니다.
- AI 응답의 provider/model/evidence는 QA에서 관측 가능한 DOM 또는 metadata로 남깁니다.
- Stitch는 컴포넌트 1~2개 단위의 증분 시안 도구로만 사용하고, 코드와 이 설계 문서를 UI SSOT로 둡니다.

## 하면 안 되는 것

- 운영 대시보드를 마케팅 랜딩 페이지처럼 구성하지 않습니다.
- 실제 기능 설명을 과도한 인앱 안내 문구로 대체하지 않습니다.
- Cloud Run cold-start timeout을 즉시 치명적 장애로 캐시하지 않습니다.
- 화면용 설계도를 문서와 따로 방치하지 않습니다.
- 서버/metric 수치를 UI copy에 하드코딩한 뒤 데이터 문서와 따로 관리하지 않습니다.

## 상세 문서

- [Folder Structure](../reference/architecture/folder-structure.md)
- [Component Dependency Map](../reference/architecture/system/component-dependency-map.md)
- [System Architecture](../reference/architecture/system/system-architecture-current.md)
- [Architecture Diagrams Data](../../src/data/architecture-diagrams.data.ts)
- [Stitch Guide](../development/stitch-guide.md)
- [AI Streaming UI Improvement Plan](../../reports/planning/ai-streaming-ui-improvement-plan.md)
