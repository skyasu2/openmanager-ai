# Skills 레퍼런스

> Owner: dev-experience
> Status: Active Canonical
> Doc type: Reference
> Last reviewed: 2026-03-14
> Canonical: docs/development/vibe-coding/skills.md
> Tags: vibe-coding,skills,automation

## Skills란?

Skills 또는 Custom Commands는 에이전트별로 재사용 가능한 작업 워크플로우를 정의한 로컬 자동화 레이어입니다.

- Codex: `.codex/skills/**/SKILL.md`
- Claude Code: `.claude/skills/**/SKILL.md`
- Gemini CLI: `.gemini/commands/**/*.toml`

## 현재 등록된 Skills (에이전트별)

### Codex Custom Skills (8, 로컬 전용)

| Skill | 호출 방식 | 설명 |
|-------|-----------|------|
| `openmanager-cloud-run` | 스킬명 명시 또는 작업 매칭 | Cloud Run 배포/비용/CLI 점검 |
| `openmanager-code-review` | 스킬명 명시 또는 작업 매칭 | 심각도 우선 코드 리뷰 |
| `openmanager-doc-management` | 스킬명 명시 또는 작업 매칭 | 문서 예산/중복/stale 점검 |
| `openmanager-env-sync` | 스킬명 명시 또는 작업 매칭 | preview/production env drift 진단/동기화 |
| `openmanager-git-workflow` | 스킬명 명시 또는 작업 매칭 | 안전한 commit/push/PR |
| `openmanager-lint-smoke` | 스킬명 명시 또는 작업 매칭 | 린트/타입/스모크 검증 |
| `openmanager-qa-ops` | 스킬명 명시 또는 작업 매칭 | Vercel + Playwright MCP 최종 QA 및 누적 기록 |
| `openmanager-state-triage` | 스킬명 명시 또는 작업 매칭 | 최근 QA/런타임 증거 기반 원인 분류 및 다음 단계 결정 |
| `openmanager-stitch-incremental` | 스킬명 명시 또는 작업 매칭 | 기존 UI 증분 개선 |

### Claude Custom Skills (7 + Sub 1)

| Skill | 명령어 | 설명 |
|-------|--------|------|
| `lint-smoke` | `/lint-smoke` | Lint + TypeScript + 테스트 스모크 체크 |
| `git-workflow` | `/commit`, `/commit-push-pr` | Git 커밋/푸시/PR (Conventional Commits) |
| `clean_gone` | `/clean_gone` | `[gone]` 브랜치 정리 (git-workflow 서브) |
| `cloud-run` | `/cloud-run`, `/gcp-cost-check` | Cloud Run 배포 + GCP 비용 점검 |
| `doc-management` | `/doc-management` | 문서 예산 점검, 중복/stale 감지 |
| `qa-ops` | `/qa-ops`, `/qa` | Vercel + Playwright MCP 최종 QA 및 누적 기록 |
| `state-triage` | `/state-triage` | 최근 QA/런타임 증거 기반 원인 분류 및 다음 액션 결정 |
| `env-sync` | `/env-sync` | `.env.local` ↔ Vercel preview/production env drift 진단/동기화 |

### Gemini Custom Commands (4, 로컬 전용)

| Command | 호출 방식 | 설명 |
|---------|-----------|------|
| `openmanager:cloud-run` | `/openmanager:cloud-run` | Cloud Run deploy, free-tier guard, GCP 비용 점검 |
| `openmanager:env-sync` | `/openmanager:env-sync` | preview/production env drift 진단/동기화 |
| `openmanager:qa-ops` | `/openmanager:qa-ops` | Vercel + Playwright MCP 최종 QA 및 누적 기록 |
| `openmanager:state-triage` | `/openmanager:state-triage` | 최근 QA/런타임/배포 상태 분석 후 다음 단계 결정 |

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
├── openmanager-env-sync/
├── openmanager-git-workflow/
├── openmanager-lint-smoke/
├── openmanager-qa-ops/
├── openmanager-state-triage/
└── openmanager-stitch-incremental/

.claude/skills/
├── cloud-run/
├── doc-management/
├── env-sync/
├── git-workflow/
├── lint-smoke/
├── qa-ops/
└── state-triage/

.gemini/commands/
└── openmanager/
    ├── cloud-run.toml
    ├── env-sync.toml
    ├── qa-ops.toml
    └── state-triage.toml
```

## 운영 원칙

- 수치(개수)보다 SSOT 파일 기준으로 확인한다.
- Codex 기준 목록 SSOT: `AGENTS.md` + `.codex/skills/**`
- Claude 기준 목록 SSOT: `.claude/skills/**`
- Gemini 기준 목록 SSOT: `GEMINI.md` + 로컬 `.gemini/commands/**`
- `.codex/`와 `.gemini/`는 현재 git 추적 제외 경로이므로, 저장소에는 카탈로그와 규칙만 남기고 실제 로컬 워크플로우 파일은 개발자 환경에서 관리한다.
- 스킬 정책 변경 시 문서와 스킬 파일을 함께 갱신한다.

## 관련 문서

- [MCP 서버](./mcp-servers.md)
- [개발 워크플로우](./workflows.md)
- [개발 환경 허브](../README.md)
