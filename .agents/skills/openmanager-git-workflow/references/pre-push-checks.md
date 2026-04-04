# Pre-push Checks

## Minimum checks

```bash
git status --short
git diff --staged --stat
npm run test:quick
```

## Recommended checks for code changes

```bash
npm run type-check
npm run lint
```

## Add when runtime contracts changed

```bash
npm run test:contract
```

Use `test:contract` when changes touch API routes, auth/session wiring, env-sensitive
server code, AI/proxy response handling, or deployment scripts that can change what
the running app returns.

## Report template

```text
Commit/Push Summary
- branch: <name>
- commit: <hash>
- checks: test:quick pass, type-check pass, lint pass
- push: success|failed
```
