# 디자인 문서 허브

> OpenManager AI의 모듈/기능 상세 설계 카테고리
> Owner: platform-architecture
> Status: Active Canonical
> Doc type: Reference
> Last reviewed: 2026-05-05
> Canonical: docs/design/README.md
> Tags: design,module,api,ui,index

---

## 목적

이 디렉터리는 모듈과 기능을 어떻게 구현했는지 설명하는 **상세 설계 정리본**입니다.
시스템 전체 구조와 배포/데이터 흐름은 [Architecture](../architecture/README.md)에서 관리합니다.

AI 에이전트는 파일을 수정하기 전에 이 디렉터리에서 해당 영역의 책임 경계와 금지 조건을 먼저 확인합니다. 이 문서는 외부 설명서가 아니라 코드 변경을 안전하게 하기 위한 내부 작업 기준입니다.

- `docs/architecture/*`: 시스템 전체 구조, 런타임 연결, 배포, 데이터 흐름
- `docs/design/*`: AI agent, API, monitoring data, error handling, UI 같은 구현 단위 상세 설계
- `docs/reference/architecture/*`: 상세 기준 문서와 원본 SSOT
- `reports/planning/*`: 앞으로 바꿀 작업의 계약, 승인 상태, 남은 TODO
- `reports/qa/*`: 배포/검증 evidence

즉, 이 디렉터리는 큰 그림을 반복하지 않고, 개발자가 특정 모듈을 고칠 때 확인해야 하는 책임 경계와 Do/Don't를 모아 둡니다.

## 영역별 문서

| 영역 | 문서 | 담당 범위 | 상세 SSOT |
|---|---|---|---|
| AI Agent | [01-ai-agent-design.md](./01-ai-agent-design.md) | Supervisor, Orchestrator, specialist agents, deterministic Eval/Opt | [AI Engine Architecture](../reference/architecture/ai/ai-engine-architecture.md) |
| API | [02-api-design.md](./02-api-design.md) | Next.js BFF route, Cloud Run API, stream/job/facade contract | [API Endpoints](../reference/api/endpoints.md) |
| Monitoring Data | [03-monitoring-data-design.md](./03-monitoring-data-design.md) | OTel dataset, MonitoringDataSource, fact/evidence boundary | [OTel Data Architecture](../reference/architecture/data/otel-data-architecture.md) |
| Error Handling | [04-error-handling-design.md](./04-error-handling-design.md) | recoverable state, source error contract, deterministic recovery | [Resilience](../reference/architecture/infrastructure/resilience.md) |
| UI | [05-ui-design.md](./05-ui-design.md) | Dashboard, AI workspace, 상태/증거 UI, 화면용 diagram data | [Folder Structure](../reference/architecture/folder-structure.md) |

## 설계 관리 원칙

1. 코드는 최종 사실입니다. 문서와 코드가 다르면 코드 기준으로 문서를 고칩니다.
2. 새 기능보다 현재 구현을 먼저 설명합니다. 아직 없는 기능은 `reports/planning`에 남깁니다.
3. 영역별 문서는 짧은 정리본으로 유지합니다. 세부 구현은 reference 문서와 코드 링크로 보냅니다.
4. 모듈/기능 계약 변경은 같은 작업에서 관련 design 문서를 갱신합니다.
5. 비용, 배포, 보안, LLM 호출 제약은 [AI Standards](../guides/ai/ai-standards.md)를 최종 정책으로 봅니다.

## AI 작업 규칙

1. 수정할 영역을 먼저 이 README의 표에서 찾습니다.
2. 관련 `design/*.md` 문서의 "해야 하는 것/하면 안 되는 것"을 확인합니다.
3. 상세 근거가 필요할 때만 `reference/*` 문서를 추가로 읽습니다.
4. 코드 변경 후 해당 design 문서의 금지 조건이나 책임 경계가 바뀌었는지 확인합니다.
5. 단순 버그 수정은 새 문서를 만들지 않고 기존 문서 또는 `TODO.md` 한 줄로 충분한지 먼저 판단합니다.

## 공통 개발 Do / Don't

| 해야 하는 것 | 하면 안 되는 것 |
|---|---|
| route, provider, data source, UI state 변경 시 이 디렉터리의 관련 영역 문서를 같이 갱신합니다. | 기능만 고치고 설계/제약 문서를 낡은 상태로 두지 않습니다. |
| 기존 reference 문서를 링크하고, 새 문서에는 판단 기준과 요약을 남깁니다. | 같은 내용을 여러 문서에 길게 복제하지 않습니다. |
| Free Tier 제약을 구현 조건으로 먼저 검토합니다. | 비용 문제를 고사양 인스턴스, always-on worker, 무제한 LLM 호출로 해결하지 않습니다. |
| generated 문서는 생성 명령으로 갱신합니다. | 생성 산출물을 손으로 임의 수정하지 않습니다. |
| 큰 계약 변경은 `reports/planning`의 SDD/TDD 게이트를 따릅니다. | plan/contract 없이 API shape, AI stream/tool schema, auth/session 계약을 바꾸지 않습니다. |

## 갱신 기준

| 변경 유형 | 갱신할 설계 문서 |
|---|---|
| Next.js API route 추가/삭제 | [02-api-design.md](./02-api-design.md) |
| AI planner/provider/agent/tool schema 변경 | [01-ai-agent-design.md](./01-ai-agent-design.md) |
| OTel 서버/메트릭/data loader 변경 | [03-monitoring-data-design.md](./03-monitoring-data-design.md) |
| 오류 contract, recoverable state 변경 | [04-error-handling-design.md](./04-error-handling-design.md) |
| Dashboard/AI workspace UX 변경 | [05-ui-design.md](./05-ui-design.md) |

## 검증 명령

```bash
npm run docs:budget
npm run docs:ai-consistency
npm run docs:links:internal
npm run docs:lint:changed
```
