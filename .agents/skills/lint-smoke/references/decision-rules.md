# Decision Rules

- Prefer `test:quick` for fast feedback.
- Use `docs/guides/testing/test-strategy.md` for the project testing methodology.
- Add `test:contract` when the change touches API routes, auth/session flow, env-sensitive
  server code, AI proxy behavior, or deployment/runtime scripts.
- Keep default smoke checks Small/Medium only. Live external checks are opt-in QA, not smoke.
- Prefer correcting false-pass tests over increasing test count or coverage percentage.
- If any smoke command fails, do not claim "ready to push".
- If root checks pass but AI engine changed and was not checked, mark as "partial".
- If contract-sensitive code changed and `test:contract` was not run, mark as "partial".
- Include exact failing command and first actionable fix.
