# Documentation Management Guide

> Owner: docs-platform
> Status: Active Canonical
> Doc type: Explanation
> Last reviewed: 2026-04-25
> Canonical: docs/development/documentation-management.md
> Tags: docs-governance,diataxis,docs-as-code

문서 관리의 운영 기준, 자동화 게이트, 그리고 외부 베스트 프랙티스 대비 갭/우선순위를 정의한다.

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
2. 활성 문서 예산: 총 80개(`docs/archived/` 제외)
   - Scope 한도: `reference/architecture 28`, `development 28(= vibe-coding 포함)`, `guides 14`, `troubleshooting 7`, `root 5`
   - 파일 길이 기준: How-to/Tutorial은 800줄 이하 권장, Reference/Architecture는 1500줄까지 단일 파일 허용
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
   - 현재 보존 예외 경로: `docs/archived/decisions/*`
   - 기술 레퍼런스/가이드는 삭제 전 반드시 활성 문서로 흡수 후 정리

## Best-Practice 비교 (웹 기준)

| 기준 | 외부 권고 | 현재 적용 | 갭 | 우선순위 |
|------|----------|----------|----|---------|
| 정보 구조 | Diataxis 4분류 | `Doc type`으로 적용 | 일부 문서 라벨 누락 | P0 |
| Docs-as-Code | PR/버전관리/CI 게이트 | lint/link/check 파이프라인 존재 | 변경 문서 메타데이터 hard gate가 약했음 | P0 |
| 스타일 일관성 | 스타일 가이드 기반 작성 | markdownlint + 내부 규칙 | 문서별 owner/책임 경계 약함 | P1 |
| 메타데이터 표준 | owner/status/date/canonical 권장 | 기존 3필드 중심 | Owner/Last reviewed/Canonical 보강 필요 | P0 |
| 문서 수명주기 | stale 정책 + 아카이브 | 90일 stale 감지 존재 | stale는 경고 중심, 자동화 후속 부족 | P1 |
| 중복 방지 | canonical link + merge-first | 중복 후보 탐지 있음 | 기계 판독 가능한 결과 포맷 부족 | P1 |

## 이번 개선에서 반영한 항목

1. 정책 SSOT를 `.claude/rules/documentation.md`로 명시
2. 메타데이터 최소 스키마를 `Owner/Status/Doc type/Last reviewed`로 확장
3. `doc-budget-report` 출력에 `PASS|WARN|FAIL + rule_id + file + action_hint` 추가
4. `check-docs.sh`에 `DOCS_STRICT_CHANGED` 플래그 추가
5. CI(`docs-quality.yml`)에서 schedule 제외 이벤트는 strict gate 활성화
6. Codex/Claude 문서관리 skill 내용을 SSOT 기준으로 동기화
7. `docs-inventory.md` → `reports/docs/` 이동: 자동 생성 스냅샷은 거버넌스 문서가 아닌 리포트로 분류 (`.gitignore` whitelist 포함)
8. 예산 한도 재조정 (`reference/architecture 22→28`, `development 22→28`, `guides 10→14`, `troubleshooting 5→7`): 활성 문서 증가와 운영 현실을 반영해 예산을 상향하고, root 5개 제한은 유지
9. `docs:ai-consistency` 추가: `.mcp.json` 토큰 평문/gitignore 구식 설명, MCP `@latest`/raw `npx -y`, Gemini same-name symlink guidance 같은 AI 운영 문서 drift를 차단
10. `docs:lint:changed` 범위 확장: `docs/` 밖의 AI 운영 Markdown(`AGENTS.md`, `CLAUDE.md`, `GEMINI.md`, `.claude/rules/*.md`, skill `SKILL.md`, `scripts/README.md`)도 변경 시 lint 대상에 포함

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
| 영역 문서(분산) | `docs/reference/*`, `docs/guides/*`, `reports/planning/wbs.md` | 도메인별 체크리스트/근거/결론 유지 |

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
