# QA Evidence - v8.11.3 Release Gate Failure

- Recorded at: 2026-04-08 22:08 KST
- Target release commit: 18209be8b8843445fef001f13aa3c3aa9e20cfa9
- Target tag: v8.11.3
- Production URL: https://openmanager-ai.vercel.app
- Active production deployment ID: dpl_8K7ZKcNUsY3U6X1Q4tuwU81D6N1d
- Active production deployment URL: https://openmanager-jc49472pn-skyasus-projects.vercel.app

## Smoke Result

Command:

```bash
node scripts/test/vercel-post-deploy-smoke.mjs --url=https://openmanager-ai.vercel.app --retries=0 --expected-version=8.11.3
```

Result:

- `GET /` PASS
- `GET /validation` PASS
- `GET /api/version` FAIL
- failure message: `expected deployed version 8.11.3, got 8.11.0`

## Runner Evidence

Runner health:

```text
runner=ok docker=ok
```

Relevant runner jobs observed after `v8.11.3` push:

- `13829853805` success at 2026-04-08 21:59:10 KST
- `13829853789` failed at 2026-04-08 21:59:27 KST after `duration_s=9.958217526`
- `13829853809` success at 2026-04-08 22:01:10 KST

Interpretation:

- Confirmed root cause: the frontend `deploy` job failed immediately because `VERCEL_TOKEN` was not exposed to the semver tag pipeline.
- The most likely configuration issue is protected variable exposure mismatch: protected CI variables exist, but the protected tag pattern for `v*.*.*` is missing or misconfigured.
- Recovery path: fix GitLab protected tag / variable exposure, then retry the existing failed tag pipeline or failed job.
- Re-pushing the same existing remote tag is not sufficient to create a new deploy pipeline.

## Vercel Usage Check

Command:

```bash
npm run check:usage:vercel
```

Result summary:

- billing period: 2026-04-01T07:00:00.000Z..2026-04-08T13:19:50.072Z
- effective usage: 4.5991 USD
- billed: 0.0000 USD
- charge count: 4263
- interpretation: no unexpected billed spike observed
