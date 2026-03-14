---
name: clean_gone
version: v1.0.0
description: Cleans up all git branches marked as [gone] (branches that have been deleted on the remote but still exist locally), including removing associated worktrees.
user-invocable: true
allowed-tools: Bash
disable-model-invocation: true
---

# Clean Gone Branches

원격에서 삭제된 로컬 브랜치를 정리합니다.

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

# Delete gone branches
git branch -vv | grep ': gone]' | awk '{print $1}' | xargs -r git branch -D
```

## Output

```
정리된 브랜치:
- feature/old-feature
- fix/completed-bug

총 2개 브랜치 삭제됨
```
