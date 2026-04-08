# QA Evidence - v8.11.3 Root Cause Confirmed

- Recorded at: 2026-04-08 23:10 KST
- Target release commit: 18209be8b8843445fef001f13aa3c3aa9e20cfa9
- Target tag: v8.11.3
- Active production deployment ID: dpl_8K7ZKcNUsY3U6X1Q4tuwU81D6N1d
- Active production deployment URL: https://openmanager-jc49472pn-skyasus-projects.vercel.app

## Current Production Check

Command:

```bash
node scripts/test/vercel-post-deploy-smoke.mjs --url=https://openmanager-ai.vercel.app --retries=0 --expected-version=8.11.3
```

Result:

- `GET /` PASS
- `GET /validation` PASS
- `GET /api/version` FAIL
- failure message: `expected deployed version 8.11.3, got 8.11.0`

## Root Cause

Confirmed failed job output:

```text
❌ Missing required GitLab CI variable: VERCEL_TOKEN
Add it in GitLab → Settings → CI/CD → Variables before running deploy.
```

Interpretation:

- The self-hosted runner is healthy (`runner=ok docker=ok`).
- The semver tag pipeline reaches the frontend `deploy` job, but `VERCEL_TOKEN` is not exposed there.
- The most likely GitLab configuration issue is protected variable exposure mismatch:
  - `VERCEL_TOKEN` is protected but the protected tag pattern for `v*.*.*` is missing or misconfigured, or
  - the variable itself is not configured as expected in GitLab CI/CD settings.
- Recovery path is to fix GitLab protected tag / variable exposure and retry the existing failed tag pipeline or failed job.
- Re-pushing the same existing remote tag does not create a new deploy pipeline.

## Vercel Usage Check

Command:

```bash
npm run check:usage:vercel
```

Result summary:

- billing period: 2026-04-01T07:00:00.000Z..2026-04-08T14:08:00.952Z
- effective usage: 4.5991 USD
- billed: 0.0000 USD
- charge count: 4263
- interpretation: no unexpected billed spike observed
