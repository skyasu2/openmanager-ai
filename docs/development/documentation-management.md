# Documentation Management Guide

> Owner: docs-platform
> Status: Active Canonical
> Doc type: Explanation
> Last reviewed: 2026-05-08
> Canonical: docs/development/documentation-management.md
> Tags: docs-governance,diataxis,docs-as-code

문서 관리의 운영 기준, 자동화 게이트, 그리고 외부 베스트 프랙티스 대비 갭/우선순위를 정의한다.

## Primary Audience

이 저장소의 문서는 외부 고객용 매뉴얼이나 공개 마케팅 자료가 아니다. 기본 독자는 다음 두 그룹이다.

| 독자 | 필요한 것 |
|---|---|
| 프로젝트 소유자 | 과거 바이브 코딩으로 누적된 결정과 현재 구조를 빠르게 회상할 수 있는 기준 |
| AI 에이전트 | 작업 전 읽을 수 있는 짧은 구조 지도, 변경 시 갱신할 문서, 검증 명령 |

따라서 문서는 완전한 고객 납품형 산출물보다 **작고 최신이며 검색 가능한 내부 작업 기억장치**를 우선한다. 공개 포트폴리오 설명보다 개발 중 참조성과 유지보수성이 중요하다.

## AI Reference Contract

AI 에이전트가 문서를 사용할 때의 계약은 다음과 같다.

1. 먼저 [Docs Home](../README.md)의 "AI 작업 시작 경로"를 따른다.
2. 정책은 `docs/guides/ai/ai-standards.md`와 에이전트별 실행 파일(`AGENTS.md`, `CLAUDE.md`, `GEMINI.md`)을 우선한다.
3. 구조 질문은 `docs/architecture/*`, 구현 질문은 `docs/design/*`, 상세 근거는 `docs/reference/*`에서 답한다.
4. 현재 작업 상태는 `reports/planning/TODO.md`, 검증 근거는 `reports/qa/*`에서 확인한다.
5. 문서와 코드가 충돌하면 코드를 기준으로 문서를 갱신한다.
6. 생성 문서(`endpoints.md`, component dependency map, inventory)는 생성 명령으로 갱신하고 손으로 임의 편집하지 않는다.

## Source of Truth

1. 정책 원본: `.claude/rules/documentation.md`
2. 에이전트 정책 요약: `AGENTS.md`
3. Codex skill: `.agents/skills/doc-management/SKILL.md`
4. Claude skill: `.claude/skills/doc-management/SKILL.md`
5. 자동 점검: `scripts/docs/check-docs.sh`, `scripts/docs/doc-budget-report.ts`, `scripts/docs/check-ai-docs-consistency.ts`
6. WSL 전용 점검 래퍼: `scripts/wsl/docs-management-check.sh`
7. 자동 생성 인벤토리: `reports/docs/docs-inventory.md`
8. 자동 생성 컴포넌트 맵: `docs/reference/architecture/system/component-dependency-map.md`, `reports/docs/component-dependency-map.json`

## 운영 규칙

1. 우선순위: 병합 > 기존 문서 확장 > 신규 생성
2. 활성 문서 예산: 총 90개(`docs/archived/` 제외)
   - Scope 한도: `architecture 12`, `design 12`, `operations 8`, `adr 8`, `reference/architecture 28`, `development 28(= vibe-coding 포함)`, `guides 14`, `troubleshooting 7`, `root 5`
   - 파일 길이 기준: Tutorial/How-to는 400줄 이하 권장, Explanation은 300~800줄 권장, Reference/Architecture는 줄 수보다 완결성과 독자·작업 단위 기준을 우선
3. 메타데이터(변경 문서 Hard gate):
   - 필수: `Owner`, `Status`, `Doc type`, `Last reviewed`
   - 권장: `Canonical`, `Tags`
   - 레거시 호환: `Last verified`는 임시 허용
4. 90일 이상 미갱신 활성 문서는 stale 경고 후 아카이브 후보로 관리
5. 디렉토리 README 링크가 없는 문서는 운영 기준에서 제외
6. AI 운영 문서(`AGENTS.md`, `CLAUDE.md`, `GEMINI.md`, `.claude/rules/*.md`, `docs/guides/ai/*`, `docs/development/vibe-coding/*`)는 MCP/Skills stale guidance 검사를 통과해야 함
7. 아카이브(`docs/archived/`)는 임시 보관소로 취급:
   - 원칙: 언제든 삭제 가능해야 함
   - 예외: 작업 계획/의사결정 기록(예: ADR, 회고 로그)만 제한적으로 유지
   - 현재 보존 예외: 과거 ADR, 마이그레이션 검토, 오래된 대형 비교 기록처럼 현재 SSOT는 아니지만 판단 맥락 보존 가치가 있는 문서
   - 기술 레퍼런스/가이드는 삭제 전 반드시 활성 문서로 흡수 후 정리

## 문서 배치 규칙

| 위치 | 넣는 내용 | 넣지 않는 내용 |
|---|---|---|
| `docs/architecture/*` | 전체 시스템 구조, 런타임, 배포, 데이터 흐름 요약 | 모듈 내부 구현 디테일 |
| `docs/design/*` | AI/API/Data/Error/UI 구현 경계와 Do/Don't | 긴 역사 비교, 실험 로그 |
| `docs/reference/*` | 오래 남길 상세 기준, API catalog, 세부 아키텍처 | 현재와 무관한 과거 조사 |
| `docs/operations/*` | 배포, QA, 헬스체크, 장애 대응 진입점 | 개발 철학, 설계 논쟁 |
| `docs/adr/*` | 되돌리기 어렵거나 구조에 영향을 주는 결정 | 단순 작업 메모, TODO |
| `reports/planning/*` | 아직 바꿀 작업의 계획, 계약, task 상태 | 완료된 기준 문서 |
| `reports/qa/*` | 검증 결과, evidence, residual risk | 설계 설명 본문 |
| `docs/archived/*` | 현재 기준에 흡수된 과거 기록 | 활성 기준으로 참조해야 하는 문서 |

## 갱신 트리거

| 변경 유형 | 같이 확인할 문서/명령 |
|---|---|
| API route 추가/삭제 | `npm run docs:api:endpoints`, [API Design](../design/02-api-design.md) |
| AI stream/job/tool schema 변경 | [AI Agent Design](../design/01-ai-agent-design.md), [API Contracts](../reference/api/contracts.md) |
| OTel 서버/metric/data loader 변경 | [Data Flow](../architecture/04-data-flow.md), [OTel Data Architecture](../reference/architecture/data/otel-data-architecture.md) |
| Dashboard/AI UI 변경 | [UI Design](../design/05-ui-design.md), component dependency map |
| 배포/CI/remote 변경 | [Deployment Architecture](../architecture/03-deployment-architecture.md), [Operations](../operations/README.md) |
| 되돌리기 어려운 구조 결정 | [ADR](../adr/README.md) |

## Best-Practice 비교 (웹 기준)

| 기준 | 외부 권고 | 현재 적용 | 갭 | 우선순위 |
|------|----------|----------|----|---------|
| 정보 구조 | Diataxis 4분류 | `Doc type`으로 적용 | 일부 문서 라벨 누락 | P0 |
| Docs-as-Code | PR/버전관리/CI 게이트 | lint/link/check 파이프라인 존재 | 변경 문서 메타데이터 hard gate가 약했음 | P0 |
| 스타일 일관성 | 스타일 가이드 기반 작성 | markdownlint + 내부 규칙 | 문서별 owner/책임 경계 약함 | P1 |
| 메타데이터 표준 | owner/status/date/canonical 권장 | 기존 3필드 중심 | Owner/Last reviewed/Canonical 보강 필요 | P0 |
| 문서 수명주기 | stale 정책 + 아카이브 | 90일 stale 감지 존재 | stale는 경고 중심, 자동화 후속 부족 | P1 |
| 중복 방지 | canonical link + merge-first | 중복 후보 탐지 있음 | 기계 판독 가능한 결과 포맷 부족 | P1 |
| AI 참조성 | 짧고 검색 가능한 작업 단위 지식 | 허브/설계/운영 진입점 정리 중 | 대형 historical reference 축소 필요 | P1 |

## 이번 개선에서 반영한 항목

1. 정책 SSOT를 `.claude/rules/documentation.md`로 명시
2. 메타데이터 최소 스키마를 `Owner/Status/Doc type/Last reviewed`로 확장
3. `doc-budget-report` 출력에 `PASS|WARN|FAIL + rule_id + file + action_hint` 추가
4. `check-docs.sh`에 `DOCS_STRICT_CHANGED` 플래그 추가
5. CI(`docs-quality.yml`)에서 schedule 제외 이벤트는 strict gate 활성화
6. Codex/Claude 문서관리 skill 내용을 SSOT 기준으로 동기화
7. `docs-inventory.md` → `reports/docs/` 이동: 자동 생성 스냅샷은 거버넌스 문서가 아닌 리포트로 분류 (`.gitignore` whitelist 포함)
8. 예산 한도 재조정 (`reference/architecture 22→28`, `development 22→28`, `guides 10→14`, `troubleshooting 5→7`): 활성 문서 증가와 운영 현실을 반영해 예산을 상향하고, root 5개 제한은 유지
9. 2026-05-05 루트 카테고리 신설 반영: `docs/architecture/*` 12개, `docs/design/*` 12개, `docs/operations/*` 8개, `docs/adr/*` 8개 한도와 총량 90개를 추가해 구현 기준 정리본을 별도 예산으로 관리
10. `docs:ai-consistency` 추가: `.mcp.json` 토큰 평문/gitignore 구식 설명, MCP `@latest`/raw `npx -y`, Gemini same-name symlink guidance 같은 AI 운영 문서 drift를 차단
11. `docs:lint:changed` 범위 확장: `docs/` 밖의 AI 운영 Markdown(`AGENTS.md`, `CLAUDE.md`, `GEMINI.md`, `.claude/rules/*.md`, skill `SKILL.md`, `scripts/README.md`)도 변경 시 lint 대상에 포함

## 자동화 실행 규약

```bash
# 로컬 통합 점검 (strict off)
npm run docs:check

# 변경 문서 Hard gate (metadata + budget)
npm run docs:budget:strict

# AI 운영 문서 MCP/Skills drift 검사
npm run docs:ai-consistency

# 상세 리포트 생성
npm run docs:budget

# 문서 인벤토리 갱신 (reports/docs/docs-inventory.md)
npm run docs:inventory

# 컴포넌트 의존도 맵 갱신 (markdown + json)
npm run docs:components:map

# 컴포넌트 의존도 맵 drift 검증 (CI hard gate)
npm run docs:components:verify
```

CI에서는 `DOCS_STRICT_CHANGED=true`와 `DOCS_DIFF_RANGE`를 함께 전달해 PR/Push diff 기준으로 변경 문서를 판정한다.
로컬 pre-push에서는 `src/components/**` 또는 컴포넌트 맵 산출물 변경 시 `docs:components:verify`를 자동 실행한다.
강제 실행이 필요하면 `FORCE_COMPONENT_MAP_VERIFY=true git push`를 사용한다.

## WSL 문서 관리 영역

WSL에서 문서 점검 결과를 별도 경로로 남기기 위해 `logs/docs-reports/wsl/`를 문서 관리 영역으로 사용한다.

```bash
# 기본 점검 (WSL 환경 감지 + docs:check + docs:budget)
npm run docs:check:wsl

# 변경 문서 strict gate 포함 점검
npm run docs:check:wsl:strict
```

출력:
- 환경 정보: `logs/docs-reports/wsl/environment.txt`
- 문서 점검 로그: `logs/docs-reports/wsl/docs-check.log`
- 예산 점검 로그: `logs/docs-reports/wsl/docs-budget.log`

### 운영 모델 (권장)

WSL 문서 관리는 `단일 허브 + 영역별 분산` 하이브리드로 운영한다.

| 구분 | 위치 | 관리 원칙 |
|------|------|-----------|
| 허브(진입점) | `scripts/wsl/docs-management-check.sh`, `docs/development/documentation-management.md` | 실행 명령, 공통 규칙, 로그 경로만 유지 |
| 영역 문서(분산) | `docs/reference/*`, `docs/guides/*` | 도메인별 체크리스트/근거/결론 유지 |

운영 규칙:
1. WSL 관련 신규 문서는 원칙적으로 생성하지 않고 기존 문서에 병합한다.
2. WSL 공통 정책 변경은 허브 문서 먼저 수정한 뒤, 필요한 영역 문서를 후속 동기화한다.
3. PR 전에는 `npm run docs:check:wsl:strict`를 최소 1회 실행한다.

## 추가된 Skill 분석

1. `doc-management` (Codex):
   - 문서 예산/중복/stale/메타데이터 점검 워크플로를 제공
   - 현재 SSOT와 일치하도록 metadata 규칙을 확장
2. `doc-management` (Claude):
   - 동일 목적의 점검 스킬
   - Success criteria를 SSOT 기준(`Owner`, `Last reviewed`)으로 동기화

결론: 두 스킬은 목적이 동일하며, 정책 원본 변경 시 동시 업데이트가 필요하다.

## 검증 및 수용 기준

1. `npm run docs:check`가 종료 코드 0으로 완료된다.
2. `npm run docs:budget:strict`는 변경 문서 필수 메타데이터 누락 시 실패한다.
3. 예산 리포트에 Rule Results(`DOC-*`)가 출력된다.
4. 정책/스킬/스크립트 설명이 동일한 메타데이터 기준을 사용한다.
5. WSL에서 `npm run docs:check:wsl:strict` 실행 시 `logs/docs-reports/wsl/` 하위에 점검 아티팩트가 생성된다.
6. WSL 문서 관리 정책은 하이브리드(허브+분산) 원칙으로 유지된다.
7. `npm run docs:ai-consistency`가 AI 운영 문서의 MCP/Skills stale guidance를 차단한다.

## References

- Diataxis: <https://diataxis.fr/>
- Write the Docs, Docs as Code: <https://www.writethedocs.org/guide/docs-as-code/>
- Google Developer Documentation Style Guide: <https://developers.google.com/style>
- Microsoft Learn metadata guidance: <https://review.learn.microsoft.com/en-us/help/platform/metadata>
