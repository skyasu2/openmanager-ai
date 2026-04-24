---
name: clean_gone
version: v1.2.0
description: Cleans up local git branches marked as [gone]. If a gone branch is still attached to a worktree, remove that worktree first and then delete the branch.
user-invocable: true
allowed-tools: Bash
disable-model-invocation: true
---

# Clean Gone Branches

> Common baseline: before editing this skill, review `docs/guides/ai/skill-standards.md` and `config/ai/skill-baselines.json`. If behavior changes are not agent-specific, update the baseline first.

원격에서 삭제된 로컬 브랜치를 정리합니다. worktree에 연결된 브랜치는 worktree를 먼저 정리해야 합니다.

## Trigger Keywords

- "/clean_gone"
- "브랜치 정리"
- "gone 브랜치 삭제"

## Workflow

1. fetch & prune으로 최신 원격 상태 반영.

```bash
git fetch -p
```

2. gone 브랜치 목록 확인 (dry-run).

```bash
git branch -vv | grep ': gone]' | awk '{print $1}'
```

gone 브랜치가 없으면 여기서 종료하고 사용자에게 알린다.

3. worktree 연결 여부 확인.

```bash
git worktree list --porcelain
```

gone 브랜치가 worktree에 연결되어 있으면 해당 worktree를 먼저 제거:

```bash
# 연결된 worktree 경로 확인 후
git worktree remove <worktree-path> --force
```

4. 삭제 전 사용자에게 목록 보고 후 진행.

삭제 대상 브랜치를 나열하고, 명시적 요청이 있을 때만 아래 실행:

```bash
git branch -vv | grep ': gone]' | awk '{print $1}' | xargs -r git branch -D
```

5. 결과 확인.

```bash
git branch -vv
```

## Output Format

```text
정리된 브랜치:
- feature/old-feature
- fix/completed-bug

총 N개 브랜치 삭제됨
worktree 제거: <경로> (해당 시)
```

## Changelog

- 2026-03-14: v1.1.0 - worktree 연결 브랜치 선정리 규칙 명시
- 2026-04-03: v1.2.0 - dry-run 확인 단계 추가, 삭제 전 사용자 보고 절차 명시
