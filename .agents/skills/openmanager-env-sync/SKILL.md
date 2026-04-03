---
name: openmanager-env-sync
description: Diagnose and fix OpenManager environment drift across .env.local, Vercel preview/production, and server-side fallbacks. Use when health checks fail after deploy, preview and production behave differently, auth or Supabase envs are missing, or the user asks to sync, verify, or harden runtime environment variables.
version: v1.0.0
user-invocable: true
---

# OpenManager Env Sync

Resolve runtime env drift before changing product code.

## Execute this workflow

1. Load policy and current sync path first.
- `sed -n '1,220p' docs/guides/ai/ai-standards.md`
- `sed -n '1,240p' scripts/env/sync-vercel.sh`
- `sed -n '1,220p' src/lib/supabase/env.ts`
- If the issue is auth or callback related, inspect the exact failing route or middleware too.

2. Confirm the symptom is really env drift.
- Typical signals:
  - preview fails while production passes
  - `/api/health` or login flow returns `500` after deploy
  - missing `SESSION_SECRET`, `NEXT_PUBLIC_SUPABASE_*`, `SUPABASE_*`, or Cloud Run bridge vars
  - local works but Vercel runtime does not
- If the request is `HTTP 200` with wrong content, do not default to env sync. Hand off to `$openmanager-state-triage` or code review first.

3. Inspect local source-of-truth values.
- Check `.env.local` for the exact variables the failing path needs.
- Strip quotes when manually reading values.
- Prefer the project's sync script over ad hoc one-off CLI commands.

4. Verify Vercel target state explicitly.
- `vercel env ls preview`
- `vercel env ls production`
- If the user names a specific variable, verify that variable on the needed target before syncing broadly.

5. Sync with the safest supported path.
- Preferred: `bash scripts/env/sync-vercel.sh`
- If scope must stay narrow, sync only the required vars with `vercel env add ... --force`
- Treat missing required vars as a blocker, not a warning.

6. Verify behavior after sync.
- `curl -s https://openmanager-ai.vercel.app/api/health`
- If AI path changed, also verify `curl -s https://openmanager-ai.vercel.app/api/health?service=ai`
- If the issue was preview-only, verify the preview URL directly before declaring success.

7. Choose the next action.
- `env-fixed`: sync resolved the issue
- `env-blocked`: required local secret is missing
- `code-followup`: env is correct but behavior is still wrong
- `qa-followup`: env is fixed and Vercel Playwright QA should run next

## Safety rules

- Do not hardcode secrets in files or commit messages.
- Do not treat infra scaling as a fix for env drift.
- Prefer explicit verification on the exact Vercel target that failed.

## Output format

```text
Env Sync Summary
- target: preview | production | both
- issue: <missing var | stale var | drift | not-env>
- synced: <vars or count>
- verification: pass | fail | blocked
- next step: <single best action>
```
