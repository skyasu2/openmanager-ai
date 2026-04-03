---
name: git-workflow
description: Git commit, push, PR creation with conventional commits and safety rules. GitLab is canonical; GitHub is a code-only public snapshot updated via sync:github.
version: v2.0.0
user-invocable: true
allowed-tools: Bash, Read, Grep, Edit
disable-model-invocation: true
---

# Git Workflow

Git 커밋, 푸시, PR 생성을 안전한 절차로 수행합니다.

**Remote 우선순위**: `gitlab` = canonical (배포 권위), `origin` = GitHub code-only snapshot

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
- 사용자가 리뷰를 요청했으면 `code-review` 스킬 기준으로 findings 반영 후 커밋

4. 커밋 메시지 생성.
- Conventional Commit 사용: `feat|fix|refactor|docs|chore|test`
- 형식: `<type>(scope): <summary>`
- 한 줄 요약으로 충분; body는 비자명한 변경에만

5. 커밋 실행.
- `git commit -m "<message>"`

6. 결과 보고.
- 커밋 해시, 메시지, 변경 파일 수

## Workflow B: Push

1. remote 확인.
- `git remote -v` — `gitlab`이 canonical인지 검증
- `git branch --show-current`

2. 배포 범위 확인.
- `git log --oneline --decorate -n 5`
- 코드 변경 시 `npm run test:quick` 또는 대상 검증 수행

3. 리뷰 요청/고위험 변경 확인.
- 고위험 변경이면 `code-review` 스킬 findings 요약 포함

4. GitLab push (canonical — 배포 트리거).
- 기본: `git push gitlab main`
- 새 브랜치: `git push -u gitlab <branch>`
- GitLab CI validate → deploy 자동 실행됨

5. GitHub 동기화 (선택, 코드 변경 후).
- `npm run sync:github` — code-only 스냅샷, 배포 권위 없음
- docs·reports 전용 push는 sync:github 생략 가능

6. 원격 상태 확인.
- `git fetch gitlab`
- `git status -sb`

## Workflow C: Commit → Push (일괄)

1. Workflow A (Commit) 실행
2. Workflow B (Push) 실행
3. 통합 결과 보고

## GitLab MR (선택)

MR이 필요한 경우 GitLab UI에서 직접 생성하거나 아래 명령 사용:
```bash
# GitLab MR 생성 (glab CLI 사용 시)
glab mr create --title "..." --description "..."
```
GitHub PR은 public snapshot 용도이며 배포와 무관합니다.

## Safety Rules

- 강제 push, `reset --hard`, `checkout --` 금지 (명시 요청 제외)
- `origin`(GitHub)에 직접 push 금지 — `npm run sync:github` 경유만 허용
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
- ci: GitLab CI triggered | skipped
- status: success | failed
```

## Related Skills

- `code-review` - 커밋/푸시 전 6관점 리뷰 연계 (고위험 변경 또는 리뷰 요청 시)
- `lint-smoke` - 사전 품질 검증

## Changelog

- 2026-02-17: v1.0.0 - commit-commands + github-deploy 병합 통합
- 2026-04-03: v2.0.0 - GitLab canonical 명확화, GitHub MCP 도구 제거, sync:github 흐름 추가
