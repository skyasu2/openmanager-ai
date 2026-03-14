---
name: clean_gone
version: v1.1.0
description: Cleans up local git branches marked as [gone]. If a gone branch is still attached to a worktree, remove that worktree first and then delete the branch.
user-invocable: true
allowed-tools: Bash
disable-model-invocation: true
---

# Clean Gone Branches

원격에서 삭제된 로컬 브랜치를 정리합니다. worktree에 연결된 브랜치는 worktree를 먼저 정리해야 합니다.

## Trigger Keywords

- "/clean_gone"
- "브랜치 정리"
- "gone 브랜치 삭제"

## Workflow

```bash
# Fetch and prune
git fetch -p

# List gone branches
git branch -vv | grep ': gone]' | awk '{print $1}'

# If a gone branch is still checked out in a linked worktree,
# remove that worktree first or git branch -D will fail.
git worktree list --porcelain

# Delete gone branches after linked worktrees are detached/removed
git branch -vv | grep ': gone]' | awk '{print $1}' | xargs -r git branch -D
```

## Output

```
정리된 브랜치:
- feature/old-feature
- fix/completed-bug

총 2개 브랜치 삭제됨
```

## Changelog

- 2026-03-14: v1.1.0 - worktree 연결 브랜치 선정리 규칙 명시
