---
name: lint-smoke
description: Run fast OpenManager quality checks before commit or push. Use when the user asks for lint/type/test smoke validation, pre-commit checks, or quick confidence on changed frontend/backend code.
---

# OpenManager Lint Smoke

> Common baseline: before editing this skill, review `docs/development/vibe-coding/skills.md` and `config/ai/skill-baselines.json`. If behavior changes are not agent-specific, update the baseline first.

Run quick validation in a fixed order and report pass/fail with next actions.

## Testing methodology

- Use `docs/guides/testing/test-strategy.md` as the methodology SSOT.
- Default smoke validation is Risk-Based Local-First: run the smallest high-signal local checks for the changed risk surface.
- Keep default smoke checks Small/Medium only. Do not add live LLM, Supabase, Vercel, Cloud Run, Redis, GCP, or other external-service calls.
- Prefer fixing or deleting false-pass tests over adding more tests. Do not chase coverage percentage.

## Execute this workflow

1. Confirm scope.
- If change is only docs or config, run lightweight checks only.
- If code changed, run full smoke sequence.
- If the change can alter runtime contracts (API/auth/env/proxy/deploy-facing behavior),
  include `npm run test:contract`.

1. Run core checks.
- `npm run test:quick`
- `npm run type-check`
- `npm run lint`
- Add `npm run test:contract` when the scope includes server/API/auth/env contract risk **or AI-related code** (`src/lib/ai/`, `src/app/api/ai/`, `cloud-run/ai-engine/src/`). This matches the CI gate exactly.
- If the required confidence would need Large/live tests, report that as a separate opt-in QA need instead of folding it into smoke validation.

1. If `cloud-run/ai-engine` files changed, run additional checks there.
- `cd cloud-run/ai-engine && npm run type-check`
- `cd cloud-run/ai-engine && npm run test`

1. Summarize clearly.
- Passed commands
- Failed commands with exact error message (first 5 lines)
- Concrete follow-up command (one actionable next step per failure)
- If contract checks were intentionally skipped, say why.

1. If the user requested a review, analyze the diff directly for findings.
- Lint smoke is evidence collection, not a substitute for code review.

## Related skills

- `$git-workflow` - commit/push after checks pass
- `$qa-ops` - final QA on Vercel/local with cumulative tracker

## Output format

Use short report blocks:

```text
Lint Smoke Summary
- test:quick: pass|fail
- type-check: pass|fail
- lint: pass|fail
- test:contract: skipped|pass|fail (AI/API contract 변경 시)
- ai-engine checks: skipped|pass|fail
- ready to commit: yes|no
```

## References

- `docs/guides/testing/test-strategy.md`
- `references/commands.md`
- `references/decision-rules.md`
