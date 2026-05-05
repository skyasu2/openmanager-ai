# Architecture Design Index

> 현재 구현 기준 설계도와 아키텍처 SSOT를 찾기 위한 중앙 인덱스
> Owner: platform-architecture
> Status: Active Canonical
> Doc type: Reference
> Last reviewed: 2026-05-05
> Canonical: docs/reference/architecture/README.md
> Tags: architecture,diagram,ssot,as-built

---

## 관리 원칙

OpenManager의 설계도는 초기 upfront design 산출물이 아니라, 실제 구현이 누적된 뒤 복원한 **as-built architecture** 기준으로 관리합니다.
따라서 새 다이어그램을 계속 추가하기보다, 도메인별 SSOT를 고정하고 구현 변경 시 해당 SSOT만 갱신합니다.

- 코드 사실이 문서보다 우선합니다. 수치나 경로가 다르면 `src/`, `cloud-run/ai-engine/`, `public/data/otel-data/`를 기준으로 문서를 보정합니다.
- 전체 구조는 단일 거대 문서로 합치지 않습니다. 시스템, AI, 데이터, 컴포넌트, 제품 화면용 설계도는 변경 속도가 다르므로 영역별 SSOT로 나눕니다.
- `src/data/architecture-diagrams/*`는 문서가 아니라 제품 UI에서 렌더링되는 설계도 데이터입니다. 관련 Markdown 문서와 함께 갱신합니다.
- generated 문서는 사람이 직접 편집하지 않고 생성 명령으로만 갱신합니다.

## 읽는 순서

처음 구조를 파악할 때는 아래 순서로 읽습니다.

1. [아키텍처 허브](../../architecture/README.md)에서 전체 시스템 구조, 런타임, 배포, 데이터 흐름을 확인합니다.
2. [디자인 허브](../../design/README.md)에서 모듈/기능별 상세 설계와 Do/Don't를 확인합니다.
3. 이 문서에서 상세 SSOT 위치와 갱신 트리거를 확인합니다.
4. [system/system-architecture-current.md](./system/system-architecture-current.md)에서 전체 런타임 경계를 봅니다.
5. AI 변경이면 [ai/ai-engine-architecture.md](./ai/ai-engine-architecture.md), 데이터/모니터링 변경이면 [data/otel-data-architecture.md](./data/otel-data-architecture.md)를 먼저 봅니다.
6. API surface나 route 변경이면 [../api/endpoints.md](../api/endpoints.md)와 [../api/contracts.md](../api/contracts.md)를 같이 봅니다.
7. 배포/비용/AI 운영 규칙은 [../../guides/ai/ai-standards.md](../../guides/ai/ai-standards.md)를 최종 정책 기준으로 봅니다.

## 설계도 인벤토리

| 영역 | 최신 설계도 / 문서 | SSOT 성격 | 현재 상태 | 갱신 트리거 |
|---|---|---|---|---|
| 시스템 전체 | [system/system-architecture-current.md](./system/system-architecture-current.md) | Active Canonical | 현재 route/component 수치 반영 대상 | Next.js route, Cloud Run route, 인프라 의존성 변경 |
| 폴더/코드 책임 | [folder-structure.md](./folder-structure.md) | Active Canonical | 코드 구조 요약 | 주요 디렉터리, route surface, Cloud Run mount 변경 |
| AI Runtime | [ai/ai-engine-architecture.md](./ai/ai-engine-architecture.md) | Active Canonical | Supervisor, Orchestrator, provider gate 기준 | AI route, planner, provider, tool/result schema 변경 |
| AI 설계 복원/비교 | [ai/ai-assistant-initial-design-comparison.md](./ai/ai-assistant-initial-design-comparison.md) | Active Supporting | 현재 구현 SSOT가 아니라 대안 비교와 진화 판단 렌즈 | 큰 방향성 재평가, M단계 완료/보류 변경 |
| Frontend/Backend AI 경계 | [ai/frontend-backend-comparison.md](./ai/frontend-backend-comparison.md) | Active Reference | BFF와 Cloud Run 책임 분리 | stream/job/facade route 또는 UI transport 변경 |
| OTel/Data 토폴로지 | [data/otel-data-architecture.md](./data/otel-data-architecture.md) | Active Canonical | 18대 synthetic topology 기준 | 서버 인벤토리, OTel schema, data loader 변경 |
| 데이터 접근 배경 | [data/data-architecture.md](./data/data-architecture.md) | Active Supporting | zero-internal-traffic 배경 설명 | OTel canonical과 충돌하면 보조 문서로 보정 |
| RAG/Knowledge | [ai/rag-knowledge-engine.md](./ai/rag-knowledge-engine.md) | Active Reference | Knowledge Retrieval Lite 기준 | KB corpus, retrieval contract, evidence policy 변경 |
| 컴포넌트 의존도 | [system/component-dependency-map.md](./system/component-dependency-map.md) | Generated Reference | `npm run docs:components:map` 산출물 | `src/components/**` 구조 변경 후 map 재생성 |
| 제품 화면용 설계도 | [../../src/data/architecture-diagrams.data.ts](../../../src/data/architecture-diagrams.data.ts) | Rendered TS Data | FeatureCardModal/TopologyModal에서 사용 | 화면 모달 설계도, topology card, public-facing 설명 변경 |

## 영역별 문서 묶음

| 영역 | 포함 문서 | 이 영역에서 답해야 하는 질문 |
|---|---|---|
| 전체 시스템 | [system/system-architecture-current.md](./system/system-architecture-current.md), [folder-structure.md](./folder-structure.md) | 사용자는 어디로 들어오고, Vercel/Cloud Run/Supabase/Redis/Cloud Tasks는 어떻게 나뉘는가 |
| AI Runtime | [ai/ai-engine-architecture.md](./ai/ai-engine-architecture.md), [ai/frontend-backend-comparison.md](./ai/frontend-backend-comparison.md), [ai/ai-assistant-initial-design-comparison.md](./ai/ai-assistant-initial-design-comparison.md) | stream/job/facade route, Supervisor/Orchestrator/Agents, provider gate, deterministic fallback이 어떻게 연결되는가. 초기 설계 비교 문서는 대안 판단용으로만 사용한다. |
| 데이터/모니터링 | [data/otel-data-architecture.md](./data/otel-data-architecture.md), [data/data-architecture.md](./data/data-architecture.md), [ai/rag-knowledge-engine.md](./ai/rag-knowledge-engine.md) | 18대 synthetic OTel 데이터와 Knowledge Retrieval Lite가 Dashboard/AI에 어떻게 공급되는가 |
| 인프라/제약 | [infrastructure/free-tier-optimization.md](./infrastructure/free-tier-optimization.md), [infrastructure/resilience.md](./infrastructure/resilience.md), [infrastructure/security.md](./infrastructure/security.md) | 무료 티어, fallback, circuit breaker, 보안 경계가 무엇을 제한하는가 |
| API/계약 | [../api/endpoints.md](../api/endpoints.md), [../api/contracts.md](../api/contracts.md) | route가 실제로 존재하는가, 요청/응답 계약이 무엇인가 |
| 제품 화면용 설계도 | [../../../src/data/architecture-diagrams.data.ts](../../../src/data/architecture-diagrams.data.ts), [../../../src/data/architecture-diagrams/](../../../src/data/architecture-diagrams/) | 사용자가 모달/토폴로지 화면에서 보는 설명이 현재 구현과 맞는가 |
| 계획/QA | [../../../reports/planning/TODO.md](../../../reports/planning/TODO.md), [../../../reports/planning/README.md](../../../reports/planning/README.md), [../../../reports/qa/qa-tracker.json](../../../reports/qa/qa-tracker.json) | 어떤 개선이 남았고, 어떤 QA evidence로 운영 판단을 했는가 |

## 아키텍처 제약 사항

아래 항목은 구현 선택의 기본 제약입니다. 변경이 필요하면 해당 영역 문서와 ADR/plan을 먼저 갱신합니다.

| 제약 | 현재 기준 |
|---|---|
| 배포 비용 | 프로덕션은 Vercel Pro 예외 외에는 무료 티어 또는 무료 티어 상당 사용량을 기준으로 설계합니다. |
| Cloud Run | AI Engine은 기본 1 vCPU / 512Mi 기준입니다. 성능 문제를 스펙 증설로 먼저 해결하지 않습니다. |
| Vercel | Frontend/BFF 계층입니다. 장시간 AI 실행을 Vercel Function에 몰아넣지 않고 Cloud Run/Cloud Tasks/Redis 경계로 분리합니다. |
| 데이터 | 실제 서버 scrape가 아니라 `public/data/otel-data` synthetic OTel dataset이 런타임 SSOT입니다. |
| AI 호출 | 로컬/CI 기본 검증에서는 실 LLM 호출을 금지하고 MSW/Vitest/contract test를 우선합니다. |
| 외부 서비스 | Supabase, Redis, Cloud Tasks, LLM provider 추가/사용 확대는 비용/쿼터/장애 전파 영향을 먼저 검토합니다. |
| 배포 권위 | canonical 개발 저장소와 production deploy 권위는 GitLab CI 기준입니다. GitHub public remote는 공개 snapshot입니다. |
| 문서 예산 | active docs는 `npm run docs:budget` 기준 90개 이내, `docs/architecture/*`와 `docs/design/*`는 각각 12개 이내로 유지합니다. 병합/확장 후 신규 문서 생성을 선택합니다. |

## 개발 Do / Don't

| 해야 하는 것 | 하면 안 되는 것 |
|---|---|
| 아키텍처 영향 변경은 같은 작업에서 관련 설계도/SSOT를 갱신합니다. | 코드만 바꾸고 설계도 수치, route, provider 흐름을 방치하지 않습니다. |
| route 추가/삭제 시 `system-architecture-current.md`, `folder-structure.md`, API catalog를 확인합니다. | `src/app/api/**` 변경을 “구현 세부사항”으로만 취급하지 않습니다. |
| AI route/planner/provider/tool schema 변경 시 AI 문서와 화면용 `ai-assistant` diagram을 같이 봅니다. | `/api/ai/ask` facade를 독립 실행 경로처럼 키우거나 기존 stream/job 계약을 우회하지 않습니다. |
| OTel 데이터 변경은 Dashboard와 AI 응답 양쪽 소비 경로를 검증합니다. | live monitoring backend, cron, DB write를 기본값으로 추가하지 않습니다. |
| 비용 영향은 개발비와 배포비를 분리해 판단합니다. | Free Tier 문제를 고사양 인스턴스, GPU, always-on worker로 먼저 해결하지 않습니다. |
| generated 문서는 생성 명령으로 갱신하고 diff를 검토합니다. | `component-dependency-map.md` 같은 생성 산출물을 손으로 임의 수정하지 않습니다. |
| 큰 기능/계약 변경은 `reports/planning`의 SDD/TDD 게이트를 따릅니다. | 대규모 리팩터링을 plan/contract/failing test 없이 바로 구현하지 않습니다. |
| 시크릿은 `.env.local`, Vercel, GCP Secret Manager 경계로만 관리합니다. | API key, token, provider secret을 문서/코드/스크립트에 하드코딩하지 않습니다. |
| 배포/원격 작업 전 `git remote -v`와 GitLab/GitHub 역할을 확인합니다. | `origin` 또는 `github-public`을 canonical branch처럼 다루지 않습니다. |

## 화면용 설계도 데이터

| 카드 ID | 데이터 파일 | 담당 의미 |
|---|---|---|
| `ai-assistant` | [../../../src/data/architecture-diagrams/ai-assistant.ts](../../../src/data/architecture-diagrams/ai-assistant.ts) | AI Assistant runtime, route facade, provider/data flow |
| `cloud-platform` | [../../../src/data/architecture-diagrams/cloud-platform.ts](../../../src/data/architecture-diagrams/cloud-platform.ts) | GitLab CI, Vercel, Cloud Run, Supabase, Redis, Cloud Tasks |
| `infrastructure-topology` | [../../../src/data/architecture-diagrams/infrastructure-topology.ts](../../../src/data/architecture-diagrams/infrastructure-topology.ts) | 18대 OnPrem DC1 synthetic topology |
| `tech-stack` | [../../../src/data/architecture-diagrams/tech-stack.ts](../../../src/data/architecture-diagrams/tech-stack.ts) | Next.js, React, TypeScript, Tailwind, test/runtime stack |
| `vibe-coding` | [../../../src/data/architecture-diagrams/vibe-coding.ts](../../../src/data/architecture-diagrams/vibe-coding.ts) | AI-first 개발/검증/배포 흐름 |

## 갱신 체크리스트

아키텍처에 영향을 주는 변경은 작업 완료 전에 아래를 확인합니다.

| 변경 유형 | 함께 확인할 파일 |
|---|---|
| `src/app/api/**/route.ts(x)` 추가/삭제 | `system-architecture-current.md`, `folder-structure.md`, 필요 시 `docs/reference/api/endpoints.md` |
| AI stream/job/facade route 변경 | `ai-engine-architecture.md`, `frontend-backend-comparison.md`, `src/data/architecture-diagrams/ai-assistant.ts` |
| planner, provider, tool/result schema 변경 | `ai-engine-architecture.md`, `../../design/01-ai-agent-design.md`; 장기 방향 재평가 시에만 `ai-assistant-initial-design-comparison.md` |
| OTel 서버 인벤토리/메트릭 schema 변경 | `otel-data-architecture.md`, `src/data/architecture-diagrams/infrastructure-topology.ts` |
| 컴포넌트 graph 갱신 | `npm run docs:components:map` 후 `npm run docs:components:verify` |
| 문서 추가/정리 | `npm run docs:budget`, `npm run docs:ai-consistency` |

## 검증 명령

```bash
npm run docs:budget
npm run docs:ai-consistency
npm run docs:components:verify
```
