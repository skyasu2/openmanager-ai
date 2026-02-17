---
name: git-workflow
description: Git commit, push, PR creation with conventional commits and safety rules.
version: v1.0.0
user-invocable: true
allowed-tools: Bash, Read, Grep, Edit, mcp__github__push_files, mcp__github__create_branch, mcp__github__create_pull_request, mcp__github__get_pull_request, mcp__github__list_commits, mcp__github__get_pull_request_status, mcp__github__merge_pull_request
disable-model-invocation: true
---

# Git Workflow

Git 커밋, 푸시, PR 생성을 안전한 절차로 수행합니다.

## Trigger Keywords

- "/commit", "/push", "/git"
- "커밋해줘", "push해줘", "PR 만들어줘"
- "커밋 푸시 PR", "PR까지 해줘"

## Workflow A: Commit

1. 워킹트리/스테이징 상태 확인.
- `git status --short`
- `git diff --cached --stat`
- staged 변경이 없으면 중단하고 파일 지정 요청

2. 커밋 범위 검증.
- 요청 범위 외 파일이 staged 되어 있으면 분리 권고
- 코드 변경이면 최소 `npm run test:quick` 또는 대상 검증 결과 확인

3. 리뷰 요청 여부 확인.
- 사용자가 리뷰를 요청했으면 빌트인 `review` 기준으로 findings 반영 후 커밋

4. 커밋 메시지 생성.
- Conventional Commit 사용: `feat|fix|refactor|docs|chore`
- 형식: `<type>(scope): <summary>`

5. 커밋 실행.
- `git commit -m "<message>"`

6. 결과 보고.
- 커밋 해시, 메시지, 변경 파일 수

## Workflow B: Push & PR

1. 인증/브랜치 상태 확인.
- `gh auth status -h github.com`
- `gh auth setup-git`
- `git branch --show-current`
- `git status --short`

2. 배포 범위 확인.
- `git log --oneline --decorate -n 5`
- 코드 변경 시 `npm run test:quick` 또는 대상 검증 수행

3. 리뷰 요청/고위험 변경 확인.
- 리뷰 요청 또는 고위험 변경이면 빌트인 `review` 기준 findings 요약 포함

4. Push 실행.
- 기본: `git push origin <branch>`
- upstream 없으면: `git push -u origin <branch>`

5. PR 생성(요청 시).
- 우선: GitHub MCP `create_pull_request`
- MCP 불가 시: `gh pr create`

6. 원격 상태 확인.
- `git fetch origin`
- `git status -sb`

## Workflow C: Commit → Push → PR (일괄)

1. Workflow A (Commit) 실행
2. Workflow B (Push & PR) 실행
3. 통합 결과 보고

## Safety Rules

- 강제 push, `reset --hard`, `checkout --` 금지 (명시 요청 제외)
- unrelated 변경 자동 되돌리기 금지
- 충돌/범위 불명확 시 중단 후 사용자 확인

## Output Format

```text
Git Workflow Results
- action: commit | push | commit+push+pr
- branch: <name>
- commit: <hash> <message>
- pushed commits: <count>
- pr: <url|not requested>
- status: success|failed
```

## Related Skills

- 빌트인 `review` - 커밋/푸시 전 리뷰 연계
- `lint-smoke` - 사전 품질 검증

## Changelog

- 2026-02-17: v1.0.0 - commit-commands + github-deploy 병합 통합
