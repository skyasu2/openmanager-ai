# Documentation Management Guide

> Owner: docs-platform
> Status: Active Canonical
> Doc type: Explanation
> Last reviewed: 2026-02-15
> Canonical: docs/development/documentation-management.md
> Tags: docs-governance,diataxis,docs-as-code

문서 관리의 운영 기준, 자동화 게이트, 그리고 외부 베스트 프랙티스 대비 갭/우선순위를 정의한다.

## Source of Truth

1. 정책 원본: `.claude/rules/documentation.md`
2. 에이전트 정책 요약: `AGENTS.md`
3. Codex skill: `.codex/skills/openmanager-doc-management/SKILL.md`
4. Claude skill: `.claude/skills/doc-management/SKILL.md`
5. 자동 점검: `scripts/docs/check-docs.sh`, `scripts/docs/doc-budget-report.js`
6. WSL 전용 점검 래퍼: `scripts/wsl/docs-management-check.sh`

## 운영 규칙

1. 우선순위: 병합 > 기존 문서 확장 > 신규 생성
2. 활성 문서 예산: 총 55개(`docs/archived/` 제외)
   - Scope 한도: `reference/architecture 20`, `development 20(= vibe-coding 포함)`, `guides 12`, `troubleshooting 5`, `root 5`
3. 메타데이터(변경 문서 Hard gate):
   - 필수: `Owner`, `Status`, `Doc type`, `Last reviewed`
   - 권장: `Canonical`, `Tags`
   - 레거시 호환: `Last verified`는 임시 허용
4. 90일 이상 미갱신 활성 문서는 stale 경고 후 아카이브 후보로 관리
5. 디렉토리 README 링크가 없는 문서는 운영 기준에서 제외
6. 아카이브(`docs/archived/`)는 임시 보관소로 취급:
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

## 자동화 실행 규약

```bash
# 로컬 통합 점검 (strict off)
npm run docs:check

# 변경 문서 Hard gate (metadata + budget)
npm run docs:budget:strict

# 상세 리포트 생성
npm run docs:budget
```

CI에서는 `DOCS_STRICT_CHANGED=true`와 `DOCS_DIFF_RANGE`를 함께 전달해 PR/Push diff 기준으로 변경 문서를 판정한다.

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

1. `openmanager-doc-management` (Codex):
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

## References

- Diataxis: <https://diataxis.fr/>
- Write the Docs, Docs as Code: <https://www.writethedocs.org/guide/docs-as-code/>
- Google Developer Documentation Style Guide: <https://developers.google.com/style>
- Microsoft Learn metadata guidance: <https://review.learn.microsoft.com/en-us/help/platform/metadata>
