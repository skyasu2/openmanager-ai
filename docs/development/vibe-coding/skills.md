# Skills 레퍼런스

> Owner: dev-experience
> Status: Active Canonical
> Doc type: Reference
> Last reviewed: 2026-04-23
> Canonical: docs/development/vibe-coding/skills.md
> Tags: vibe-coding,skills,automation

## Skills란?

Skills는 각 AI CLI가 재사용 가능한 워크플로우를 실행하는 자동화 레이어입니다.
기본 형식은 `SKILL.md` 기반 Agent Skills 패턴을 따르며, 각 AI는 자신만의
공식 스캔 경로를 가집니다. 이 저장소는 Claude/Gemini는 symlink로, Codex는
repo-local path + optional user mirror로 운영합니다.

## 경로별 역할 (실제 동작 기준)

| 경로 | 스캔 주체 | 역할 | 형식 |
|------|-----------|------|------|
| `.claude/skills/` | Claude Code | Claude canonical path + Gemini shared source라는 프로젝트 규칙 | `SKILL.md` (rich frontmatter) |
| `.gemini/skills/` | Gemini CLI | Gemini project path, 이 저장소에서는 `.claude/skills/` symlink 모음 | symlink |
| `.agents/skills/` | Codex CLI | Codex repo-local canonical path | `SKILL.md` + `agents/openai.yaml` + `references/` |
| `~/.codex/skills/` | Codex CLI | Codex user-scope installed skills / local mirror (git ignore) | 로컬 복사본 |

> **Codex 공식 경로**: 최신 공개 문서 기준 Codex는 repo `.agents/skills/`를
> 직접 발견합니다.
>
> **Codex mirror**: 이 저장소의 `npm run skills:sync:codex`는 `.agents/skills/`
> 를 `~/.codex/skills/`로 복사해 user-scope mirror를 유지하는 보조 작업입니다.

> **Gemini symlink 추가**: `ln -sf ../../.claude/skills/<name> .gemini/skills/<name>`

## 현재 등록된 Skills

### Claude + Gemini 공용 (`.claude/skills/`)

| Skill | Claude 명령어 | 설명 |
|-------|--------------|------|
| `git-workflow` | `/commit`, `/commit-push-pr` | GitLab canonical push + GitHub sync |
| `git-clean-gone` | `/clean_gone` | `[gone]` 브랜치 정리 (worktree 포함) |
| `cloud-run` | `/cloud-run` | Cloud Run 배포 + GCP 비용 점검 |
| `lint-smoke` | `/lint-smoke` | Lint + 타입 + 테스트 스모크 검증 |
| `code-review` | `/code-review` | 6관점 심각도 우선 리뷰 (go/conditional/no-go) |
| `doc-management` | `/doc-management` | 문서 예산 점검, 중복/stale 감지 |
| `qa-ops` | `/qa-ops` | Vercel + Playwright MCP 최종 QA 및 누적 기록 |
| `qa-state` | `/qa-state` | 상태 진단 + QA 실행 + 기록 통합 워크플로우 |
| `state-triage` | `/state-triage` | QA/런타임/AI provider 원인 분석 + 다음 단계 |
| `env-sync` | `/env-sync` | Vercel/Cloud Run env drift 진단 + 동기화 |

### Codex 전용 (`.agents/skills/` repo-local canonical)

| Skill | 추가 파일 | 비고 |
|-------|-----------|------|
| `cloud-run` | `agents/openai.yaml`, `references/` | Claude 버전과 별도 유지 |
| `code-review` | `agents/openai.yaml`, `references/` | |
| `doc-management` | `agents/openai.yaml`, `references/` | |
| `env-sync` | `agents/openai.yaml` | |
| `git-workflow` | `agents/openai.yaml`, `references/` | |
| `lint-smoke` | `agents/openai.yaml`, `references/` | |
| `qa-ops` | `agents/openai.yaml`, `references/` | |
| `qa-state` | — | |
| `state-triage` | `agents/openai.yaml` | |
| `stitch-incremental` | `agents/openai.yaml`, `references/` | 온디맨드만, 상시 워크플로우 아님 |

### Built-in (Claude Code 내장)

| Skill | 명령어 | 설명 |
|-------|--------|------|
| `review` | `/review` | PR 기반 코드 리뷰 |
| `frontend-design` | 자동 트리거 | UI 컴포넌트/페이지 생성 |

## 파일 구조

```text
.claude/skills/                 # Claude canonical path + Gemini shared source
├── cloud-run/SKILL.md
├── code-review/SKILL.md
├── doc-management/SKILL.md
├── env-sync/SKILL.md
├── git-clean-gone/SKILL.md
├── git-workflow/SKILL.md
├── lint-smoke/SKILL.md
├── qa-ops/SKILL.md
├── qa-state/SKILL.md
└── state-triage/SKILL.md

.gemini/skills/                 # Gemini CLI project path (symlink view)
├── cloud-run -> ../../.claude/skills/cloud-run
├── git-clean-gone -> ../../.claude/skills/git-clean-gone
└── ...

.agents/skills/                 # Codex repo-local canonical path
├── cloud-run/
│   ├── SKILL.md
│   ├── agents/openai.yaml      # Codex/OpenAI 전용 메타데이터
│   └── references/             # 스킬 참조 문서
├── stitch-incremental/         # Codex 전용 (Claude/Gemini 없음)
└── ...

~/.codex/skills/                # Codex user-scope mirror / installed skills
└── ...                         # 필요 시 npm run skills:sync:codex 로 mirror 갱신
```

## SKILL.md frontmatter 형식 비교

```yaml
# .claude/skills/ 형식 (Claude + Gemini)
---
name: git-workflow
description: ...
version: v2.0.0
user-invocable: true
allowed-tools: Bash, Read, Grep, Edit
disable-model-invocation: true
---

# .agents/skills/ 형식 (Codex)
---
name: git-workflow
description: ...
---
```

이 저장소는 Claude 확장 frontmatter를 `.claude/skills/`에 유지하고, Codex용 UI
메타데이터는 `.agents/skills/<name>/agents/openai.yaml`에 분리해 관리합니다.
Codex 스킬 본문의 핵심 trigger 메타데이터는 `SKILL.md`의 `name` +
`description`입니다.

## 동기화 규칙

| 작업 | 절차 |
|------|------|
| Claude/Gemini 스킬 추가/수정 | `.claude/skills/<name>/SKILL.md` 수정 → `.gemini/skills/`에 symlink 추가 |
| Codex 스킬 추가/수정 | `.agents/skills/<name>/` 수정 |
| Codex mirror 갱신 | 선택 시 `npm run skills:sync:codex` |
| Gemini symlink 추가 | `ln -sf ../../.claude/skills/<name> .gemini/skills/<name>` |
| Codex repo 경로 확인 | `ls .agents/skills/` |
| Codex mirror 확인 | `ls ~/.codex/skills/` |

## 운영 원칙

- 스킬 canonical path: Claude는 `.claude/skills/`, Gemini는 `.gemini/skills/`, Codex는 `.agents/skills/`
- `.gemini/skills/`는 이 저장소에서 `.claude/skills/`를 공유하기 위한 symlink adapter
- `npm run skills:sync:codex`는 `~/.codex/skills/` mirror 유지용 보조 작업이며, repo-local discovery의 필수 전제는 아님
- `stitch-incremental`은 Codex 전용 온디맨드 스킬 (상시 워크플로우 아님)
- 스킬 정책 변경 시 `.claude/skills/`와 `.agents/skills/` 양쪽 모두 업데이트

## 관련 문서

- [MCP 서버](./mcp-servers.md)
- [개발 워크플로우](./workflows.md)
- [개발 환경 허브](../README.md)
