# Docs Refactor Audit - 2026-05-05

> docs 경로 전수 조사와 리팩터링 후보 분석 리포트
> Owner: docs-platform
> Status: Active
> Doc type: Analysis
> Last reviewed: 2026-05-05
> Canonical: reports/docs/docs-refactor-audit-2026-05-05.md
> Tags: docs,audit,refactor,architecture,design

## 1. Scope

- 대상: `docs/**/*.md`
- 활성 문서: **74개**
- 보관 문서: **5개**
- 전체 markdown: **79개**
- 전체 라인 수: **17,746줄**
- 기준 리포트: [docs-inventory.md](./docs-inventory.md)

이번 조사의 목적은 문서를 바로 대량 이동하는 것이 아니라, 현재 흩어진 설계/운영/개발 문서를 어떤 기준으로 통폐합, 최신화, 보관, 재배치할지 정하는 것이다. 2026-05-05 추가 판단: 이 문서 세트의 1차 독자는 외부 평가자가 아니라 프로젝트 소유자와 AI 에이전트이므로, 공개 설명보다 내부 참조성, 검색성, 코드 변경 시 갱신 기준을 우선한다.

## 2. Current Topology

현재 구조는 새로 만든 `architecture/`, `design/`, `operations/`, `adr/`를 작업자용 진입점으로 두고, `reference/architecture/`를 상세 설계 SSOT로 유지하는 방향이 가장 적합하다.

| Scope | Count | 역할 평가 | 방향 |
|---|---:|---|---|
| `architecture/` | 6 | 전체 구조를 빠르게 파악하는 입구 | 유지. 상세 본문은 `reference/architecture`로 연결 |
| `design/` | 6 | 기능/모듈 설계 입구 | 유지. API/AI/UI/데이터 설계별 링크 허브로 관리 |
| `operations/` | 3 | 운영 문서 허브와 배포/롤백 runbook이 있음 | 유지. 장애 대응 상세는 troubleshooting과 연결 |
| `adr/` | 3 | 결정 기록 본문과 인덱스가 같은 위치에 있음 | 신규/활성 ADR 정본 위치로 유지 |
| `reference/` | 24 | 상세 아키텍처/프로젝트/API 기준 | 유지하되 decision/log 성격 문서는 `adr` 또는 `archived`로 분리 |
| `development/` | 18 | 개발 환경, 도구, CI/CD, 문서 관리 | 유지. AI 도구 문서 중복만 정리 |
| `guides/` | 8 | 실행 중심 how-to | 유지. 오래된 인덱스/정책 최신화 필요 |
| `troubleshooting/` | 2 | 문제 해결 | 유지. 운영 문서와 교차 링크 강화 |
| root docs | 4 | 온보딩/상태/LLM 인덱스 | 유지. `QUICK-START.md`는 18대 OTel topology 기준 최신화 완료 |

## 3. Oldest-First Findings

오래된 문서부터 확인한 결과, 단순히 오래되었다는 이유로 보관할 문서는 적고, 대부분은 "짧은 최신화" 또는 "상세 SSOT 링크 보강"이 맞다.

| Priority | File | Last commit | Finding | Action |
|---|---|---:|---|---|
| P0 | `docs/reference/api/endpoints.md` | 2026-05-02 | 실제 route 33개, 문서 36개. 누락 4개, 코드에 없는 문서 항목 7개 확인 | 완료: 코드 기준 33개로 재생성, `docs:api:endpoints` 추가 |
| P0 | `docs/QUICK-START.md` | 2026-03-29 | 주요 기능이 15개 서버로 설명됨. 현재 OTel topology는 18대 | 완료: 18대 OTel 기준으로 수정 |
| P0 | `docs/reference/architecture/data/data-architecture.md` | 2026-04-25 | 현재 SSOT는 OTel 18대인데 legacy 15대 구성이 본문에 크게 남아 있음 | 완료: legacy 표 제거, 18대 계층 요약으로 축소 |
| P1 | `docs/guides/README.md` | 2026-02-15 | 인덱스 자체는 작고 유효하지만 새 `architecture/design/operations/adr` 진입점이 없음 | 완료: 새 구조 링크 반영 |
| P1 | `docs/reference/api/contracts.md` | 2026-02-28 | 계약 문서가 핵심 7개 엔드포인트만 다룸 | 완료: 핵심 계약 우선순위 문서로 scope 명확화 |
| P1 | `docs/reference/architecture/design/consistency.md` | 2026-02-17 | 내용은 데이터 일관성 배경으로 유효하나 v8.0.0 표현과 `/api/metrics/current` 예시는 현행 코드와 분리됨 | 완료: OTel/MonitoringDataSource 기준 supporting 문서로 재작성 |
| P1 | `docs/guides/standards/health-check-policy.md` | 2026-03-25 | 자동 호출 금지 정책은 유효. 비용/운영 정책 문서와 연결 부족 | 완료: operations/배포 smoke/AI soft health 연결 |
| P1 | `docs/development/stitch-guide.md` | 2026-03-19 | 온디맨드 UI 개선 도구라는 위치가 명확함 | 완료: UI design 문서와 상호 연결 |
| P1 | `docs/development/README.md` | 2026-03-30 | 개발 허브로 유효. 새 문서 구조 링크 보강 필요 | 완료: 설계/운영 진입점 추가 |
| P1 | `docs/reference/architecture/data/monitoring-stack-comparison.md` | 2026-02-17 | 외부 스택 비교 문서인데 Canonical처럼 표시되어 OTel SSOT와 역할 혼선 가능 | 완료: Active Supporting으로 낮추고 v8.11.97/OTel SSOT 기준 보정 |
| P1 | `docs/troubleshooting/README.md` | 2026-02-17 | 새 operations/deployment/rollback 구조와 연결 부족 | 완료: triage route와 operations 링크 추가 |
| P1 | `docs/development/git-hooks-workflow.md` | 2026-03-27 | Vercel 중심 CI/CD 표현이 GitLab canonical 기준과 충돌 | 완료: GitLab CI canonical + Vercel deploy target 기준으로 수정 |
| P1 | `docs/status.md` | 2026-04-23 | v8.11.9 스냅샷으로 현재 v8.11.97 작업 상태와 거리 발생 | 완료: v8.11.97 snapshot과 문서 역할 재정리 반영 |
| P2 | `docs/development/vibe-coding/multi-agent-tools.md` | 2026-04-02 | Claude 중심 설명이 프로젝트 현실과 맞으나 AGENTS/Codex 규칙과 중복됨 | 완료: 세 AI 모두 end-to-end 가능, Codex subagent 명시 요청 기준 반영 |
| P2 | `docs/guides/testing/test-strategy.md` | 2026-04-02 | 테스트 철학은 현행과 대체로 일치 | 완료: GitLab deterministic gate, Vercel+Playwright MCP final QA, operations 링크 반영 |

### API Catalog Drift

실제 `src/app/api/**/route.ts*` 기준 엔드포인트는 33개다. 이 드리프트는 1차 정리에서 `npm run docs:api:endpoints` 생성 스크립트를 추가하고, `endpoints.md`를 코드 기준으로 재생성해 해소했다.

해소된 문서 누락:

- `/api/ai/artifact-intent`
- `/api/ai/ask`
- `/api/ai/jobs/[id]/retry`
- `/api/web-vitals`

제거된 문서 잔존 항목:

- `/api/alerts/stream`
- `/api/auth/revoke-github-token`
- `/api/performance/metrics`
- `/api/test/auth`
- `/api/time`
- `/api/vercel-usage`
- `/api/version/status`

이 문서는 앞으로 수동 편집보다 생성 스크립트를 우선 사용한다. drift 점검은 `npm run docs:api:endpoints:check`로 수행한다.

## 4. Large Document Candidates

큰 문서는 "삭제"보다 "요약 상단 + 상세 부록화"가 적합하다. 현재 개발 막바지 단계에서는 큰 문서가 가진 맥락을 잃는 비용이 더 크다.

| File | Lines | Issue | Refactor Direction |
|---|---:|---|---|
| `docs/reference/architecture/ai/ai-engine-architecture.md` | 1224 | AI Engine 전체 설계, 모델 정책, provider fallback, 운영 제약이 한 파일에 집중 | 완료: AI 작업용 빠른 참조 추가. 세부 절 분리는 후속 검토 |
| `docs/reference/architecture/ai/ai-assistant-initial-design-comparison.md` | 842 | 역사/비교 성격이 강함 | 완료: 구현 SSOT가 아니라 대안 비교 렌즈임을 명시. 핵심 결론 흡수 후 archive 후보 |
| `docs/archived/server-metadata-comparison.md` | 732 | 비교/선택 기록 성격 | 완료: 현재 OTel SSOT로 대체하고 archived로 이동 |
| `docs/development/ci-cd.md` | 684 | GitLab/Vercel/Cloud Run/공개 snapshot/로컬 CI가 모두 있음 | 완료: 실제 배포/롤백 절차는 `operations` runbook으로 분리하고, 이 문서는 CI/CD reference로 역할 축소 |
| `docs/reference/architecture/system/system-architecture-current.md` | 566 | 현행 시스템 상세 SSOT라 크지만 가치 높음 | 유지. `docs/architecture/*`의 상세 링크 대상으로 관리 |
| `docs/development/dev-tools.md` | 533 | 설치/도구/운영 레퍼런스가 길어짐 | 빠른 시작과 중복 제거, 도구별 anchor 정리 |

## 5. Individual File Classification

Legend:

- Keep: 현 위치 유지
- Refresh: 최신화 필요
- Link: 새 구조에서 링크/역링크 보강
- Merge: 다른 문서와 통합 검토
- Split: 큰 문서 분리 검토
- Archive: 보관 후보

### Root

| File | Status | Assessment | Action |
|---|---|---|---|
| `docs/README.md` | Active Canonical | 전체 문서 허브로 유효 | Keep, Link |
| `docs/QUICK-START.md` | Active | 온보딩 문서. 18대 OTel topology 반영 완료 | Keep |
| `docs/status.md` | Active | v8.11.97 기준 프로젝트 상태 스냅샷 | Keep, 주기 갱신 |
| `docs/llms.md` | Active | LLM/AI crawler reference | Keep |

### Architecture

| File | Status | Assessment | Action |
|---|---|---|---|
| `docs/architecture/README.md` | Active Canonical | 아키텍처 입구 | Keep |
| `docs/architecture/01-system-overview.md` | Active | 상세 SSOT 링크형 요약 | Keep |
| `docs/architecture/02-runtime-architecture.md` | Active | 런타임 경계 요약 | Keep |
| `docs/architecture/03-deployment-architecture.md` | Active | 배포 구조 요약 | Keep, operations 링크 |
| `docs/architecture/04-data-flow.md` | Active | 데이터 흐름 요약 | Keep |
| `docs/architecture/diagrams/README.md` | Active | 다이어그램 인덱스 | Keep |

### Design

| File | Status | Assessment | Action |
|---|---|---|---|
| `docs/design/README.md` | Active Canonical | 상세 설계 입구 | Keep |
| `docs/design/01-ai-agent-design.md` | Active | AI 상세 설계 요약 | Keep, Link |
| `docs/design/02-api-design.md` | Active | API 설계 요약 | Keep, API catalog drift 반영 후 링크 |
| `docs/design/03-monitoring-data-design.md` | Active | 모니터링 데이터 설계 요약 | Keep |
| `docs/design/04-error-handling-design.md` | Active | 에러 처리 설계 요약 | Keep |
| `docs/design/05-ui-design.md` | Active | UI 설계 요약 | Keep, Stitch 링크 |

### Operations / ADR

| File | Status | Assessment | Action |
|---|---|---|---|
| `docs/operations/README.md` | Active Canonical | 운영 문서 입구만 존재 | Keep, 배포/롤백/트러블슈팅 링크 확장 |
| `docs/operations/deployment-guide.md` | Active Canonical | production 배포 runbook | Keep |
| `docs/operations/rollback-guide.md` | Active Canonical | rollback 판단/실행 runbook | Keep |
| `docs/adr/README.md` | Active Canonical | 결정 기록 입구 | Keep |
| `docs/adr/adr-002-server-card-rendering-strategy.md` | Active | 서버 카드 렌더링 결정 기록 | Keep |
| `docs/adr/adr-003-promql-vs-js-array-filtering.md` | Active | 데이터 쿼리 전략 결정 기록 | Keep |

### Development

| File | Status | Assessment | Action |
|---|---|---|---|
| `docs/development/README.md` | Active Canonical | 개발 허브, 설계/운영 진입점 반영 완료 | Keep |
| `docs/development/ci-cd.md` | Active | CI/CD 정책과 historical appendix reference. 배포/롤백 절차는 operations로 분리 | Keep, later shrink legacy appendix |
| `docs/development/coding-standards.md` | Active | 개발 표준 | Keep |
| `docs/development/dev-tools.md` | Active | 도구 레퍼런스 | Keep, dedupe with quick start |
| `docs/development/docker.md` | Active | Docker/AI Engine 로컬 실행 | Keep |
| `docs/development/documentation-management.md` | Active Canonical | 문서 정책 SSOT | Keep |
| `docs/development/environment-variables.md` | Active | env 맵 | Keep |
| `docs/development/git-hooks-workflow.md` | Active | GitLab canonical 기준 hooks/CI 게이트로 갱신 | Keep |
| `docs/development/project-setup.md` | Active Canonical | 제로베이스 설정 | Keep |
| `docs/development/project-starter-assets.md` | Active | 재사용 자산 인덱스 | Keep |
| `docs/development/stitch-guide.md` | Active | UI 증분 개선 정책, UI design 연결 완료 | Keep |
| `docs/development/vibe-coding/README.md` | Active Canonical | AI 협업 허브 | Keep |
| `docs/development/vibe-coding/claude-code.md` | Active Supporting | Claude 전용 운영 | Keep |
| `docs/development/vibe-coding/mcp-servers.md` | Active Supporting | MCP 운영 | Keep |
| `docs/development/vibe-coding/multi-agent-tools.md` | Active | AI 도구 선택 기준. 현재 세션 주도 + 수동 교차 검증 기준 반영 | Keep |
| `docs/development/vibe-coding/setup.md` | Active Supporting | AI 도구 설치 | Keep |
| `docs/development/vibe-coding/skills.md` | Active Canonical | Skills 카탈로그 | Keep |
| `docs/development/vibe-coding/workflows.md` | Active | AI 협업 워크플로우 | Keep |

### Guides

| File | Status | Assessment | Action |
|---|---|---|---|
| `docs/guides/README.md` | Active Canonical | 실행 가이드 인덱스, 새 구조 연결 완료 | Keep |
| `docs/guides/ai/ai-standards.md` | Active | AI 공통 원칙 SSOT | Keep |
| `docs/guides/ai/skill-standards.md` | Active Canonical | Skill 기준 | Keep |
| `docs/guides/ai/vision-agent-guide.md` | Active | Vision 기능 가이드 | Keep |
| `docs/guides/observability.md` | Active | 관측성 가이드 | Keep, operations 링크 |
| `docs/guides/standards/health-check-policy.md` | Active | 비용 보호 정책, 배포 smoke/AI soft health 예외 명확화 | Keep |
| `docs/guides/testing/e2e-testing-guide.md` | Active Canonical | E2E 기준 | Keep |
| `docs/guides/testing/test-strategy.md` | Active | 테스트 전략. GitLab deterministic gate와 final QA 기록 기준 반영 | Keep |

### Reference API / Architecture / Project

| File | Status | Assessment | Action |
|---|---|---|---|
| `docs/reference/README.md` | Active Canonical | 상세 레퍼런스 허브 | Keep |
| `docs/reference/api/contracts.md` | Active | 핵심 계약 우선순위와 endpoint catalog 생성 기준 명확화 | Keep |
| `docs/reference/api/endpoints.md` | Active | 실제 route 기준 재생성 완료 | Keep, generate via script |
| `docs/reference/architecture/README.md` | Active Canonical | 상세 아키텍처 인덱스 | Keep |
| `docs/reference/architecture/ai/ai-assistant-improvement-boundaries.md` | Active Supporting | AI 개선 경계 결정 | Keep |
| `docs/reference/architecture/ai/ai-assistant-initial-design-comparison.md` | Active Supporting | 초기 설계 비교/진화 판단 렌즈. 구현 SSOT 아님 | Keep, Archive candidate after key conclusions are absorbed |
| `docs/reference/architecture/ai/ai-engine-architecture.md` | Active Canonical | AI Engine SSOT, AI 작업용 빠른 참조 추가 | Keep, Split candidate |
| `docs/reference/architecture/ai/frontend-backend-comparison.md` | Active | FE/BE 비교 | Keep |
| `docs/reference/architecture/ai/monitoring-ml.md` | Active | ML/모니터링 참고 | Refresh or merge into AI architecture |
| `docs/reference/architecture/ai/rag-knowledge-engine.md` | Active | RAG 설계 | Keep |
| `docs/reference/architecture/data/data-architecture.md` | Active Supporting | legacy 표 제거, zero-internal-traffic 배경만 유지 | Keep |
| `docs/reference/architecture/data/monitoring-stack-comparison.md` | Active Supporting | Prometheus/Grafana 대비 supporting comparison, OTel SSOT 링크 보강 | Keep |
| `docs/reference/architecture/data/otel-data-architecture.md` | Active Canonical | OTel 데이터 SSOT | Keep |
| `docs/reference/architecture/design/consistency.md` | Active Supporting | OTel/MonitoringDataSource 기준 데이터 일관성 supporting 문서 | Keep |
| `docs/reference/architecture/folder-structure.md` | Active Canonical | 폴더 구조 SSOT | Keep |
| `docs/reference/architecture/infrastructure/database.md` | Active | Supabase 역할과 OTel monitoring SSOT 경계 보강 | Keep |
| `docs/reference/architecture/infrastructure/free-tier-optimization.md` | Active | 비용 제약 기준 | Keep |
| `docs/archived/gitlab-migration-feasibility.md` | Archived Supporting | 활성 경로에서 보관 경로로 이동 완료 | Keep archived |
| `docs/reference/architecture/infrastructure/resilience.md` | Active | 복원력 설계 | Keep |
| `docs/reference/architecture/infrastructure/security.md` | Active | 보안 구현 SSOT 파일과 guest/audit/header 경계 보강 | Keep |
| `docs/reference/architecture/system/component-dependency-map.md` | Active | 컴포넌트 의존성 | Keep |
| `docs/reference/architecture/system/system-architecture-current.md` | Active Canonical | 시스템 상세 SSOT | Keep |
| `docs/reference/project/definition-of-done.md` | Active Canonical | DoD 기준 | Keep |
| `docs/reference/project/requirements.md` | Active Canonical | 요구사항 | Keep |
| `docs/reference/project/wbs.md` | Active Canonical | WBS | Keep |

### Troubleshooting

| File | Status | Assessment | Action |
|---|---|---|---|
| `docs/troubleshooting/README.md` | Active Canonical | 문제 해결 허브, operations/deployment/rollback triage route 반영 | Keep |
| `docs/troubleshooting/common-issues.md` | Active Canonical | 공통 문제 해결 | Keep |

### Archived

| File | Assessment | Action |
|---|---|---|
| `docs/archived/codex-main-transition-guide.md` | 보관 문서 | Keep archived |
| `docs/archived/decisions/adr-001-unified-ai-engine-cache-and-providers.md` | 과거 ADR | Keep archived |
| `docs/archived/gitlab-migration-feasibility.md` | GitLab migration 검토 기록 | Keep archived |
| `docs/archived/prometheus-migration-improvements.md` | 과거 개선 기록 | Keep archived |
| `docs/archived/server-metadata-comparison.md` | v8.0.0 서버 메타데이터 비교 기록 | Keep archived |

## 6. Recommended Refactor Waves

### Wave 1 - Correctness Fixes

1. 완료: `docs/reference/api/endpoints.md`를 실제 33개 route 기준으로 갱신하고 생성 스크립트를 추가한다.
2. 완료: `docs/QUICK-START.md`의 15대 서버 표현을 18대 OTel topology 기준으로 수정한다.
3. 완료: `docs/reference/architecture/data/data-architecture.md`의 legacy 15대 서버 표를 축소한다.
4. 완료: `docs/reference/architecture/infrastructure/gitlab-migration-feasibility.md`를 `docs/archived/gitlab-migration-feasibility.md`로 이동한다.

### Wave 2 - New Topology Link Pass

1. 완료: `docs/guides/README.md`, `docs/development/README.md`, `docs/reference/README.md`에 `architecture/`, `design/`, `operations/`, `adr/` 진입점을 반영한다.
2. 완료: `docs/operations/README.md`에서 CI/CD, health check, troubleshooting, QA tracker를 운영 runbook처럼 연결한다.
3. 완료: `docs/design/05-ui-design.md`에서 Stitch 가이드와 컴포넌트/UI 기준을 연결한다.

### Wave 3 - Large Doc Reduction

1. 완료: `ai-engine-architecture.md` 상단에 AI 작업용 빠른 참조를 추가했다. provider/model/stream/job-store 세부 분리는 후속 검토로 유지한다.
2. 완료: `ci-cd.md`는 CI/CD reference로 역할을 낮추고, [deployment-guide.md](../../docs/operations/deployment-guide.md)와 [rollback-guide.md](../../docs/operations/rollback-guide.md)를 운영 runbook으로 추가했다.
3. 완료: `server-metadata-comparison.md`는 archived로 이동했다. `ai-assistant-initial-design-comparison.md`는 현재 planning에서 기준 문서로 참조하므로 active supporting으로 유지하되, 구현 SSOT가 아님을 명시했다.

### Wave 4 - Governance

1. API route catalog 자동 검사를 추가한다.
2. 30일마다 `docs:inventory`, `docs:budget`, `docs:links:internal`, `docs:ai-consistency`를 실행하고 리포트만 갱신한다.
3. `Status: Archived*` 문서는 활성 경로에 남기지 않는 규칙을 적용한다.
4. 신규 설계는 먼저 `architecture` 또는 `design`에 요약 진입점을 만들고, 상세 구현 기준은 `reference/architecture` 또는 모듈별 설계 문서로 연결한다.

## 7. Old/Random Review Pass

2026-05-05 추가 검토는 오래된 `Last reviewed`/레거시 메타데이터 문서와 random sample을 함께 확인했다. 목적은 문서가 존재하는지보다, 새 `architecture/design/operations/adr/reference` 구조에서 AI가 잘못된 정본을 따라가지 않는지 확인하는 것이다.

| Sample | Review type | Result | Action |
|---|---|---|---|
| `monitoring-stack-comparison.md` | oldest-first | 외부 스택 비교 문서로 유지하되 `Active Supporting`으로 조정. OTel Data Architecture가 현재 SSOT임을 명시 | 완료 |
| `troubleshooting/README.md` | oldest-first | operations/deployment/rollback 진입점과 증상별 triage route 추가 | 완료 |
| `git-hooks-workflow.md` | oldest-first | Vercel 중심 CI 표현을 GitLab canonical + Vercel deploy target 기준으로 수정 | 완료 |
| `docs/status.md` | oldest-first | v8.11.97 스냅샷과 QA/docs refactor 진행 상태 반영 | 완료 |
| `monitoring-ml.md` | old metadata | 경량 TS 기반 ML 설명이 현재 코드 경로와 일치함을 확인 | `Last reviewed` 갱신, 코드 참조 검토 메모 추가 |
| `resilience.md` | old metadata | v8.11.97/2026-05-05 운영값 표기가 이미 반영되어 있음 | 후속 후보에서 제거 |
| `ai-assistant-improvement-boundaries.md` | random | Free Tier/portfolio/assistant boundary 기준과 현재 정책이 일치 | 수정 없음 |
| `docs/reference/architecture/data/otel-data-architecture.md` | random + legacy metadata | 18대 OTel SSOT와 일치. `Last verified: 2026-02-17` 레거시 alias가 stale처럼 보일 수 있음 | `Last reviewed` 갱신, source merge/review note로 정리 |
| `docs/troubleshooting/common-issues.md` | random | Git remote confusion 내용은 유효. Docs Link Breakage action bullet이 아래 섹션 끝에 붙어 있었음 | bullet 위치 보정, `Last reviewed` 갱신 |
| `docs/adr/adr-003-promql-vs-js-array-filtering.md` | random | 결정 자체는 18대 OTel 기준으로 유효. 다만 `Version: v8.0.0` 표기가 현재 기준처럼 보일 수 있음 | 최초 분석 기준과 현재 재검토 기준을 분리 |
| `docs/development/coding-standards.md` | random | TypeScript strict/type-first 기준이 공통 AI standards와 충돌하지 않음 | 수정 없음 |
| `docs/design/03-monitoring-data-design.md` | random | MonitoringDataSource/FactPack/18대 OTel 경계가 현재 구조와 일치 | 수정 없음 |
| `cloud-run/ai-engine/src/services/ai-sdk/agents/config/instructions/analyst.ts` | code copy drift | Analyst 지시문에 "15대 전체" 표현이 남아 18대 OTel SSOT와 충돌 | 18대로 보정 |

## 8. Budget Result

현재 활성 문서 수는 74개로 전체 예산 90개 이내다. 새 문서 구조를 만들 여유는 있지만, 앞으로는 새 문서 추가보다 기존 문서의 링크/요약/보관 정리가 우선이다.

```text
PASS DOC-BUDGET-001 file=docs action_hint="74 active docs within 90 budget after operations runbook split"
PASS DOC-API-DRIFT-001 file=docs/reference/api/endpoints.md action_hint="Synced with 33 actual route files"
PASS DOC-STALE-CONTENT-001 file=docs/QUICK-START.md action_hint="18-server OTel topology wording applied"
PASS DOC-LEGACY-001 file=docs/reference/architecture/data/data-architecture.md action_hint="Legacy 15-server table removed"
PASS DOC-ARCHIVE-PLACEMENT-001 file=docs/archived/gitlab-migration-feasibility.md action_hint="Archived Supporting doc moved under docs/archived"
PASS DOC-ADR-PLACEMENT-001 file=docs/adr action_hint="ADR-002 and ADR-003 moved under docs/adr"
PASS DOC-ARCHIVE-PLACEMENT-002 file=docs/archived/server-metadata-comparison.md action_hint="Historical metadata comparison archived; current SSOT points to OTel Data Architecture"
PASS DOC-OPS-RUNBOOK-001 file=docs/operations action_hint="Deployment and rollback runbooks added"
PASS DOC-AI-TOOLS-001 file=docs/development/vibe-coding/multi-agent-tools.md action_hint="Current-session-led 3-CLI policy and Codex subagent gating reflected"
PASS DOC-SECURITY-DB-001 file=docs/reference/architecture/infrastructure action_hint="Security and database SSOT boundaries refreshed"
PASS DOC-RANDOM-REVIEW-001 file=reports/docs/docs-refactor-audit-2026-05-05.md action_hint="Old metadata and random sample review recorded"
PASS DOC-OTEL-META-001 file=docs/reference/architecture/data/otel-data-architecture.md action_hint="Legacy Last verified alias replaced with source merge/review note"
PASS DOC-TROUBLESHOOTING-001 file=docs/troubleshooting/common-issues.md action_hint="Docs Link Breakage actions placed under the correct section"
PASS RUNTIME-COPY-DRIFT-001 file=cloud-run/ai-engine/src/services/ai-sdk/agents/config/instructions/analyst.ts action_hint="15-server wording corrected to 18-server OTel topology"
```
