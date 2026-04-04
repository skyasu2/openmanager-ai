---
name: openmanager-lint-smoke
description: Run fast OpenManager quality checks before commit or push. Use when the user asks for lint/type/test smoke validation, pre-commit checks, or quick confidence on changed frontend/backend code.
version: v1.1.0
user-invocable: true
---

# OpenManager Lint Smoke

Run quick validation in a fixed order and report pass/fail with next actions.

## Execute this workflow

1. Confirm scope.
- If change is only docs or config, run lightweight checks only.
- If code changed, run full smoke sequence.
- If the change can alter runtime contracts (API/auth/env/proxy/deploy-facing behavior),
  include `npm run test:contract`.

2. Run core checks.
- `npm run test:quick`
- `npm run type-check`
- `npm run lint`
- Add `npm run test:contract` when the scope includes server/API/auth/env contract risk.

3. If `cloud-run/ai-engine` files changed, run additional checks there.
- `cd cloud-run/ai-engine && npm run type-check`
- `cd cloud-run/ai-engine && npm run test`

4. Summarize clearly.
- Passed commands
- Failed commands with exact error message (first 5 lines)
- Concrete follow-up command (one actionable next step per failure)
- If contract checks were intentionally skipped, say why.

5. If the user requested a review, hand off to review workflow.
- Lint smoke is evidence collection, not a substitute for code review.
- Use `$openmanager-code-review` to produce 6-perspective severity-ranked findings.

## Related skills

- `$openmanager-code-review` - 6-perspective severity-first review
- `$openmanager-git-workflow` - commit/push after checks pass
- `$openmanager-qa-ops` - final QA on Vercel/local with cumulative tracker

## Output format

Use short report blocks:

```text
Lint Smoke Summary
- test:quick: pass|fail
- type-check: pass|fail
- lint: pass|fail
- ai-engine checks: skipped|pass|fail
- ready to commit: yes|no
```

## References

- `references/commands.md`
- `references/decision-rules.md`

## Changelog

- 2026-03-19: v1.0.0 - version/user-invocable 메타 추가, step 4 실패 조치 구체화
