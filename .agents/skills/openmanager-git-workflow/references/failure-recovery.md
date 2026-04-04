# Failure Recovery

## Push rejected (non-fast-forward)

1. Fetch and inspect:

```bash
git fetch gitlab
git log --oneline --left-right --graph HEAD...gitlab/<branch>
```

2. Rebase safely only when appropriate:

```bash
git pull --rebase gitlab <branch>
```

3. Re-run checks and push again.

## PR creation failure

- Canonical/private work: open the Merge Request manually in GitLab after the branch push succeeds.
- GitHub auth/token health and `gh pr create` fallback only matter for explicit GitHub public-snapshot tasks.

## Merge conflict with unrelated agent changes

- Do not discard changes.
- Isolate intended files and ask user for conflict strategy if scope is ambiguous.
