# Decision Rules

- Prefer `test:quick` for fast feedback.
- Add `test:contract` when the change touches API routes, auth/session flow, env-sensitive
  server code, AI proxy behavior, or deployment/runtime scripts.
- If any smoke command fails, do not claim "ready to push".
- If root checks pass but AI engine changed and was not checked, mark as "partial".
- If contract-sensitive code changed and `test:contract` was not run, mark as "partial".
- Include exact failing command and first actionable fix.
