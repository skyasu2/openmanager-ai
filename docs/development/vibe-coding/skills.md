# Skills 레퍼런스

> Owner: dev-experience
> Status: Active Canonical
> Doc type: Reference
> Last reviewed: 2026-02-25
> Canonical: docs/development/vibe-coding/skills.md
> Tags: vibe-coding,skills,automation

## Skills란?

Skills는 에이전트별로 재사용 가능한 작업 워크플로우를 정의한 `SKILL.md` 묶음입니다.

- Codex: `.codex/skills/**/SKILL.md`
- Claude Code: `.claude/skills/**/SKILL.md`

## 현재 등록된 Skills (에이전트별)

### Codex Custom Skills (6)

| Skill | 호출 방식 | 설명 |
|-------|-----------|------|
| `openmanager-cloud-run` | 스킬명 명시 또는 작업 매칭 | Cloud Run 배포/비용/CLI 점검 |
| `openmanager-code-review` | 스킬명 명시 또는 작업 매칭 | 심각도 우선 코드 리뷰 |
| `openmanager-doc-management` | 스킬명 명시 또는 작업 매칭 | 문서 예산/중복/stale 점검 |
| `openmanager-git-workflow` | 스킬명 명시 또는 작업 매칭 | 안전한 commit/push/PR |
| `openmanager-lint-smoke` | 스킬명 명시 또는 작업 매칭 | 린트/타입/스모크 검증 |
| `openmanager-stitch-incremental` | 스킬명 명시 또는 작업 매칭 | 기존 UI 증분 개선 |

### Claude Custom Skills (4 + Sub 1)

| Skill | 명령어 | 설명 |
|-------|--------|------|
| `lint-smoke` | `/lint-smoke` | Lint + TypeScript + 테스트 스모크 체크 |
| `git-workflow` | `/commit`, `/commit-push-pr` | Git 커밋/푸시/PR (Conventional Commits) |
| `clean_gone` | `/clean_gone` | `[gone]` 브랜치 정리 (git-workflow 서브) |
| `cloud-run` | `/cloud-run`, `/gcp-cost-check` | Cloud Run 배포 + GCP 비용 점검 |
| `doc-management` | `/doc-management` | 문서 예산 점검, 중복/stale 감지 |

### Built-in Skills (Claude Code 내장)

| Skill | 명령어 | 설명 |
|-------|--------|------|
| `review` | `/review` | PR 기반 코드 리뷰 |
| `frontend-design` | 자동 트리거 | UI 컴포넌트/페이지 생성 |

## 파일 구조

```text
.codex/skills/
├── openmanager-cloud-run/
├── openmanager-code-review/
├── openmanager-doc-management/
├── openmanager-git-workflow/
├── openmanager-lint-smoke/
└── openmanager-stitch-incremental/

.claude/skills/
├── cloud-run/
├── doc-management/
├── git-workflow/
└── lint-smoke/
```

## 운영 원칙

- 수치(개수)보다 SSOT 파일 기준으로 확인한다.
- Codex 기준 목록 SSOT: `AGENTS.md` + `.codex/skills/**`
- Claude 기준 목록 SSOT: `.claude/skills/**`
- 스킬 정책 변경 시 문서와 스킬 파일을 함께 갱신한다.

## 관련 문서

- [MCP 서버](./mcp-servers.md)
- [개발 워크플로우](./workflows.md)
- [개발 환경 허브](../README.md)
