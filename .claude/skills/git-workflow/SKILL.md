---
name: git-workflow
description: Git commit, push, MR/PR creation with conventional commits and safety rules. GitLab is canonical; github-public is the preferred GitHub frontend-only public snapshot updated via sync:github.
version: v2.1.2
user-invocable: true
allowed-tools: Bash, Read, Grep, Edit
disable-model-invocation: true
---

# Git Workflow

> Common baseline: before editing this skill, review `docs/development/vibe-coding/skills.md` and `config/ai/skill-baselines.json`. If behavior changes are not agent-specific, update the baseline first.

Git 커밋, 푸시, PR 생성을 안전한 절차로 수행합니다.

**Remote 우선순위**: `gitlab` = canonical (배포 권위), `github-public` = preferred GitHub frontend-only public snapshot, `origin` = legacy fallback only

## Trigger Keywords

- "/commit", "/push", "/git"
- "커밋해줘", "push해줘", "PR 만들어줘"
- "커밋 푸시 PR", "PR까지 해줘"

## Workflow A: Commit

1. 워킹트리/스테이징 상태 확인.
- `git status --short`
- `git diff --cached --stat`
- staged 변경이 없으면 중단하고 파일 지정 요청

1. 커밋 범위 검증.
- 요청 범위 외 파일이 staged 되어 있으면 분리 권고
- 코드 변경이면 최소 `npm run test:quick` 또는 대상 검증 결과 확인

1. 리뷰 요청 여부 확인.
- 사용자가 리뷰를 요청했으면 변경 내용 기반으로 findings 반영 후 커밋

1. 커밋 메시지 생성.
- Conventional Commit 사용: `feat|fix|refactor|docs|chore|test`
- 형식: `<type>(scope): <summary>`
- 한 줄 요약으로 충분; body는 비자명한 변경에만

1. 커밋 실행.
- `git commit -m "<message>"`

1. 결과 보고.
- 커밋 해시, 메시지, 변경 파일 수

## Workflow B: Push

1. remote 확인.
- `git remote -v` — `gitlab`이 canonical인지 검증
- `git branch --show-current`

1. 배포 범위 확인.
- `git log --oneline --decorate -n 5`
- 코드 변경 시 `npm run test:quick` 또는 대상 검증 수행

1. 리뷰 요청/고위험 변경 확인.
- 고위험 변경이면 주요 리스크 요약 포함

1. GitLab push (canonical).
- 기본: `git push gitlab main`
- 새 브랜치: `git push -u gitlab <branch>`
- branch/main은 validate, semver tag는 deploy/deploy_ai_engine/smoke 파이프라인의 권위 경로

1. pushed HEAD의 GitLab pipeline 확인.
- 기본 명령: `npm run gitlab:pipeline:head -- --wait`
- `GITLAB_TOKEN`이 환경변수 또는 `.env.local`에 있으면 해당 스크립트가 pushed `HEAD` 기준 pipeline을 확인
- `status=not_created`면 docs/reports 전용 변경처럼 pipeline이 생성되지 않았음을 명시
- token이 없으면 자동 확인 불가를 명시
- 최종 보고에는 가능하면 `pipeline id/status/url` 포함

1. GitHub 동기화 (선택, 코드 변경 후).
- `npm run sync:github` — frontend-only public snapshot, 배포 권위 없음
- docs·reports 전용 push는 sync:github 생략 가능

1. 원격 상태 확인.
- `git fetch gitlab`
- `git status -sb`

## Workflow C: Commit → Push (일괄)

1. Workflow A (Commit) 실행
1. Workflow B (Push) 실행
1. 통합 결과 보고

## GitLab MR (선택)

MR이 필요한 경우 GitLab UI에서 직접 생성하거나 아래 명령 사용:
```bash
# GitLab MR 생성 (glab CLI 사용 시)
glab mr create --title "..." --description "..."
```
GitHub PR은 public snapshot 용도이며 배포와 무관합니다.

## Safety Rules

- 강제 push, `reset --hard`, `checkout --` 금지 (명시 요청 제외)
- `origin` 또는 `github-public`에 직접 push 금지 — 공개 snapshot 갱신은 `npm run sync:github` 경유만 허용
- `main` 브랜치 force push 금지 (GitLab / GitHub 모두)
- unrelated 변경 자동 되돌리기 금지
- 충돌/범위 불명확 시 중단 후 사용자 확인

## Output Format

```text
Git Workflow Results
- action: commit | push | commit+push
- remote: gitlab (canonical) | sync:github (snapshot)
- branch: <name>
- commit: <hash> <message>
- pushed commits: <count>
- ci: <pipeline id/status/url | not_created | not_verified>
- status: success | failed
```

## Related Skills

- `lint-smoke` - 사전 품질 검증

## Changelog

- 2026-05-07: v2.1.2 - GitHub public snapshot 범위를 frontend-only로 축소
- 2026-05-05: v2.1.1 - `github-public` 우선/`origin` legacy fallback 정책과 GitLab canonical 표현 동기화
- 2026-04-25: v2.1.0 - push 후 pushed HEAD GitLab pipeline 확인 및 deploy_ai_engine 권위 경로 반영
- 2026-02-17: v1.0.0 - commit-commands + github-deploy 병합 통합
- 2026-04-03: v2.0.0 - GitLab canonical 명확화, GitHub MCP 도구 제거, sync:github 흐름 추가
