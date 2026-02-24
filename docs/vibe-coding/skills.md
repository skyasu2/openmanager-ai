# Skills 레퍼런스

> Owner: dev-experience
> Status: Active Canonical
> Doc type: Reference
> Last reviewed: 2026-02-24
> Tags: vibe-coding,skills,automation

## Skills란?

**Skills**는 Claude Code에서 `/명령어`로 실행하는 커스텀 워크플로우입니다.
`.claude/skills/` 디렉토리의 SKILL.md 파일로 정의됩니다.

## 등록된 Skills (4개 + 서브 1개)

### 코드 품질

| Skill | 명령어 | 설명 |
|-------|--------|------|
| lint-smoke | `/lint-smoke` | Lint + TypeScript + 테스트 스모크 체크 |

### Git/배포/비용

| Skill | 명령어 | 설명 |
|-------|--------|------|
| git-workflow | `/commit`, `/commit-push-pr` | Git 커밋/푸시/PR (Conventional Commits) |
| clean_gone | `/clean_gone` | [gone] 브랜치 정리 (git-workflow 서브) |
| cloud-run | `/cloud-run`, `/gcp-cost-check` | Cloud Run 배포 + GCP 비용 점검 |

### 문서 관리

| Skill | 명령어 | 설명 |
|-------|--------|------|
| doc-management | `/doc-management` | 문서 예산 점검, 중복/stale 감지 |

### Built-in Skills (Claude Code 내장)

| Skill | 명령어 | 설명 |
|-------|--------|------|
| review | `/review` | PR 기반 코드 리뷰 |
| frontend-design | (자동 트리거) | UI 컴포넌트/페이지 생성 |

## 파일 구조

```
.claude/skills/
├── git-workflow/
│   ├── SKILL.md          # 커밋/푸시/PR 워크플로우
│   └── clean_gone.md     # [gone] 브랜치 정리
├── cloud-run/
│   ├── SKILL.md          # 배포 + 비용 점검
│   └── references/
│       ├── edge-cases.md # 장애 시나리오 5종
│       └── rollback.md   # 롤백 절차
├── lint-smoke/
│   └── SKILL.md          # 스모크 체크
└── doc-management/
    └── SKILL.md          # 문서 예산 관리
```

## SKILL.md 형식

```markdown
---
name: skill-name
version: v1.0.0
description: 스킬 설명
user-invocable: true
allowed-tools: Bash, Read, Grep
disable-model-invocation: true
---

# Skill Title

## Trigger Keywords
- "/skill-name"

## Workflow
1. 단계 설명...
2. ...
```

필수 메타데이터: `name`, `version`, `description`, `user-invocable`, `allowed-tools`
권장 메타데이터: `disable-model-invocation: true` (사용자 명시 호출만 허용)

## 관련 문서

- [MCP 서버](./mcp-servers.md)
- [Claude Code](./claude-code.md)
