# Documentation Rules (SSOT)

> 문서 정책의 단일 기준은 이 파일이다. `AGENTS.md`와 Skill 문서는 이 규칙을 따라 동기화한다.

## 1) Doc Budget Policy

> **우선순위**: 병합 > 기존 문서 확장 > 신규 생성

| 범위 | 한도 | 비고 |
|------|:----:|------|
| 전체 활성 문서 | 55개 | `docs/archived/` 제외 |
| reference/architecture/* | 20개 | 아키텍처 문서 |
| development/* | 20개 | vibe-coding/ 포함 |
| guides/* | 12개 | 운영 지침 |
| troubleshooting/* | 5개 | 문제 해결 |
| root (docs/) | 5개 | README, QUICK-START 등 |

## 2) Metadata Schema (Changed Docs Hard Gate)

신규/수정 문서는 아래 메타데이터를 문서 상단 인용 블록으로 포함한다.

```text
> Owner: team-or-person
> Status: Active Canonical | Active Supporting | Historical | Deprecated | Archived | Draft
> Doc type: Tutorial | How-to | Reference | Explanation
> Last reviewed: YYYY-MM-DD
> Canonical: docs/path.md | n/a
> Tags: comma,separated,tags
```

필수/선택:
- 필수: `Owner`, `Status`, `Doc type`, `Last reviewed`
- 선택: `Canonical`, `Tags`
- 호환: 기존 `Last verified`는 임시 호환 필드로 허용한다. 신규 문서는 `Last reviewed`를 사용한다.

보완 규칙:
- `Status != Active Canonical`인 문서는 `Canonical` 필드를 권장한다.
- 디렉토리 `README.md`에 링크가 없는 문서는 운영 기준에서 제외한다.

## 3) Rollout Policy

- Hard gate: 이번 변경으로 추가/수정된 활성 문서(`docs/archived/` 제외)
- Warn only: 레거시 미수정 문서
- 90일 이상 미갱신 활성 문서는 아카이브 후보로 경고한다.

## 4) Diataxis 분류 기준

| 유형 | 목적 | 예시 |
|------|------|------|
| Tutorial | 학습(따라하기) | QUICK-START.md |
| How-to | 문제 해결 절차 | docker.md, git-hooks-workflow.md |
| Reference | 사실/명세 조회 | endpoints.md, architecture docs |
| Explanation | 배경/설계 맥락 | coding-standards.md |

## 5) 자동화 계약

- `npm run docs:check`: 품질 점검 + 예산 리포트 생성
- `npm run docs:budget:strict`: 변경 문서 메타데이터 누락/예산 초과 시 실패
- CI는 `DOCS_DIFF_RANGE`로 PR/Push 기준 변경 파일 집합을 전달한다.
- 예산 리포트는 `PASS|WARN|FAIL`, `rule_id`, `file`, `action_hint`를 출력한다.

## 6) 금지사항

- 분석/리뷰 문서를 `docs/` 루트에 생성
- 완료된 Historical 문서를 활성 경로에 방치
- Diataxis 라벨 없이 신규 문서 생성
- 동일 주제를 작은 파일로 과분할

## 7) Best-Practice Alignment Baseline

- Diataxis: https://diataxis.fr/
- Docs-as-Code (Write the Docs): https://www.writethedocs.org/guide/docs-as-code/
- Google Developer Documentation Style Guide: https://developers.google.com/style
- Microsoft Docs metadata guidance: https://review.learn.microsoft.com/en-us/help/platform/metadata

---

See also: `docs/development/documentation-management.md`
