# OpenManager AI 문서 허브

> OpenManager 내부 개발 문서 허브 — AI 에이전트와 1인 개발자가 작업 중 참조하는 기준
> Owner: documentation
> Status: Active Canonical
> Doc type: Explanation
> Last reviewed: 2026-05-08
> Canonical: docs/README.md
> Tags: docs,index,navigation
>
> Project: OpenManager AI v8.11.156+

이 문서는 공개 제품 문서나 고객 납품 산출물이 아니라, OpenManager를 계속 개발할 때 참조하는 내부 작업 지도입니다. 주 독자는 AI 에이전트(Codex, Claude Code, Gemini)와 프로젝트 소유자입니다.

문서의 목적은 세 가지입니다.

1. 작업 전 현재 구조와 제약을 빠르게 확인한다.
2. 사용자가 질문했을 때 코드와 같은 기준 문서로 답한다.
3. 코드 변경 후 어떤 문서를 같이 갱신해야 하는지 판단한다.

## 문서 구성

| 섹션 | 내용 | 비고 |
|------|------|------|
| **[아키텍처](./architecture/README.md)** | 시스템 전체 구조, 런타임, 배포, 데이터 흐름 | 전체가 어떻게 연결되는가 |
| **[디자인](./design/README.md)** | 모듈/기능 상세 설계, API, UI, 오류 처리 | 각 부분을 어떻게 구현하는가 |
| **[운영](./operations/README.md)** | 배포/환경/장애 대응 문서 입구 | 어떻게 운영하고 검증하는가 |
| **[ADR](./adr/README.md)** | 주요 의사결정 기록 | 왜 그렇게 결정했는가 |
| **[개발 결과물](./reference/README.md)** | 시스템 아키텍처, AI 엔진, 데이터 파이프라인 | 무엇을 만들었나 |
| **[개발환경 (WSL/배포)](./development/README.md)** | 로컬 개발환경, CI/CD, 배포 운영 가이드 | 개발 기반 |
| **[Vibe Coding](./development/vibe-coding/README.md)** | AI 도구 세팅, MCP, Agent Teams, 워크플로우 | AI 협업 방식 |
| **[가이드](./guides/README.md)** | AI 표준, 테스트 전략, 옵저버빌리티 | 운영 지침 |
| **[트러블슈팅](./troubleshooting/README.md)** | 자주 발생하는 문제와 해결법 | 문제 해결 |
| **[프로젝트 역사](./history/project-evolution.md)** | 1년간 아키텍처 변천사, 주요 전환점 | 왜 지금 이 구조인가 |

## AI 작업 시작 경로

AI 에이전트는 새 작업을 시작할 때 아래 순서로 읽습니다. 모든 문서를 한 번에 읽지 않고, 작업 범위에 맞는 문서만 좁혀서 봅니다.

1. [AGENTS.md](../AGENTS.md) — Codex 실행 규칙, 검증/배포/서브에이전트 경계
2. [AI Standards](./guides/ai/ai-standards.md) — Free Tier, 배포 환경, OTel SSOT, 보안 원칙
3. [TODO](../reports/planning/TODO.md) — 현재 active task와 backlog
4. [Architecture](./architecture/README.md) — 전체 시스템 경계
5. [Design](./design/README.md) — 수정할 모듈의 책임과 금지 조건
6. 관련 [Reference](./reference/README.md) — 상세 근거와 오래 남길 기준
7. 관련 `reports/planning/*` 또는 `reports/qa/*` — 현재 작업/검증 evidence

## 질문별 참조 경로

| 질문 | 먼저 볼 문서 |
|---|---|
| 현재 시스템 구조가 어떻게 되는가 | [Architecture](./architecture/README.md), [System Architecture](./reference/architecture/system/system-architecture-current.md) |
| AI Engine/Agent가 어떻게 동작하는가 | [AI Agent 설계 경계](./design/README.md#ai-agent-설계-경계), [AI Engine Architecture](./reference/architecture/ai/ai-engine-architecture.md) |
| API route가 실제로 존재하는가 | [API Endpoints](./reference/api/endpoints.md), `npm run docs:api:endpoints:check` |
| API/stream/job 계약이 무엇인가 | [API 설계 경계](./design/README.md#api-설계-경계), [API Endpoints](./reference/api/endpoints.md) |
| Dashboard와 AI가 같은 데이터를 보는가 | [Data Flow](./architecture/04-data-flow.md), [Data Architecture](./reference/architecture/data/data-architecture.md) |
| 배포/QA/헬스체크 기준은 무엇인가 | [Operations](./operations/README.md), [Deployment Architecture](./architecture/03-deployment-architecture.md) |
| 왜 이 결정을 했는가 | [ADR](./adr/README.md), 관련 `docs/adr/*` |
| 문서를 새로 만들지 합칠지 판단해야 한다 | [Documentation Management](./development/documentation-management.md), [Docs Refactor Audit](../reports/docs/docs-refactor-audit-2026-05-05.md) |

## 추천 파악 경로

### 결과물 파악 (무엇을 만들었나)
1. [Quick Start](./QUICK-START.md)
2. [Architecture](./architecture/README.md)
3. [Design](./design/README.md)
4. [Architecture Design Index](./reference/architecture/README.md)
5. [System Architecture](./reference/architecture/system/system-architecture-current.md)
6. [Frontend Component Dependency Map](./reference/architecture/system/component-dependency-map.md)
7. [AI Engine Architecture](./reference/architecture/ai/ai-engine-architecture.md)
8. [API Endpoints](./reference/api/endpoints.md)

### 개발환경 파악 (어떻게 만들었나)
1. [개발환경 허브](./development/README.md)
2. [프로젝트 설정 (WSL/배포)](./development/project-setup.md)
3. [Vibe Coding 개요](./development/vibe-coding/README.md)
4. [MCP 서버 구성](./development/vibe-coding/mcp-servers.md)
5. [Agent Teams & 워크플로우](./development/vibe-coding/workflows.md)
6. [AI Standards](./guides/ai/ai-standards.md)
7. [AGENTS.md](../AGENTS.md)

## Historical Documents

- `docs/analysis/*`: 시점 기반 분석/검토 문서
- `docs/reviews/*`: 리뷰 리포트 문서
- `docs/archived/*`: 삭제 전 흡수 원칙의 보관소. 과거 ADR, 마이그레이션 검토, 오래된 대형 비교 기록만 예외적으로 보존
- 현재 기준과 다를 수 있으므로 각 문서의 `Status`/기준 버전을 확인하세요.

## Related

- [Project Status](./status.md)
- [Architecture](./architecture/README.md)
- [Design](./design/README.md)
- [Operations](./operations/README.md)
- [ADR](./adr/README.md)
- [Architecture Design Index](./reference/architecture/README.md)
- [AI Engine Architecture](./reference/architecture/ai/ai-engine-architecture.md)
- [LLM Context](./llms.md)
