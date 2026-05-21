# QA Evidence - v8.12.0 Release Smoke

Date: 2026-05-21 KST

## Target

- Production URL: https://openmanager-ai.vercel.app
- Release tag: `v8.12.0`
- Commit: `b21e0aff5091c3420b40322b24a9a11b7908f7d8`
- Vercel deployment: `dpl_9tVqnvdBXyaHqEAiXNHgnYrEmnLp`
- Deployment URL: https://openmanager-8db89na7g-skyasus-projects.vercel.app

## GitLab CI

- Pipeline: https://gitlab.com/skyasu2/openmanager-ai/-/pipelines/2543011513
- Status: `success`
- Ref: `v8.12.0`
- Jobs:
  - `deploy`: success
  - `deploy_ai_engine`: success
  - `post_deploy_ai_engine_smoke`: success
  - `post_deploy_smoke`: success

## Vercel Deployment Inspect

Command:

```bash
vercel inspect openmanager-ai.vercel.app
```

Result:

- `id`: `dpl_9tVqnvdBXyaHqEAiXNHgnYrEmnLp`
- `target`: production
- `status`: Ready
- `created`: Thu May 21 2026 18:52:44 KST
- aliases include `https://openmanager-ai.vercel.app`

## Post-Deploy Smoke

Command:

```bash
npm run test:vercel:post-deploy:smoke -- --url=https://openmanager-ai.vercel.app --expected-version=8.12.0 --expected-commit-sha=b21e0aff5091c3420b40322b24a9a11b7908f7d8 --retries=2 --retry-delay-ms=3000
```

Result:

- `GET /`: PASS
- `GET /login`: PASS
- `GET /api/version`: PASS
- Smoke passed on attempt 1/3.

## Usage Guard

Command:

```bash
npm run check:usage:vercel
```

Result:

- Billing context: `skyasus-projects`
- Period: `2026-05-01T07:00:00.000Z..2026-05-21T09:54:26.758Z`
- Effective: `13.9999 USD`
- Billed: `0.0000 USD`
- Charge count: `12180`
- Status: PASS via `vercel usage --format json --non-interactive`

## Scope Notes

- This was a release deployment smoke run, not a broad browser matrix.
- Dashboard UX behavior for the changed feature was covered earlier in local Playwright QA run `QA-20260521-0552`.
- Conversational AI QA was skipped because this release changed dashboard search/trend UX and release metadata, not AI prompt routing, provider selection, tool schemas, or response contracts.
