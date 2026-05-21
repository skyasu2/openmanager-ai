# QA Evidence - v8.12.1 Release Smoke

Date: 2026-05-22 KST

## Target

- Production URL: https://openmanager-ai.vercel.app
- Release tag: `v8.12.1`
- Commit: `3c4df7a68c7b9931f32ba838faa027ebc75fb625`
- Vercel deployment: `dpl_FrMjb4v1eLLxXCYTAToTunPivZWf`
- Deployment URL: https://openmanager-21z0a7nlc-skyasus-projects.vercel.app
- Cloud Run service URL: https://ai-engine-jdhrhws7ia-an.a.run.app

## GitLab CI

- Pipeline: https://gitlab.com/skyasu2/openmanager-ai/-/pipelines/2544691552
- Status: `success`
- Ref: `v8.12.1`
- Jobs:
  - `deploy`: success
  - `deploy_ai_engine`: success
  - `post_deploy_ai_engine_smoke`: success
  - `post_deploy_smoke`: success

## Vercel Deployment Inspect

Command:

```bash
vercel inspect https://openmanager-21z0a7nlc-skyasus-projects.vercel.app
```

Result:

- `id`: `dpl_FrMjb4v1eLLxXCYTAToTunPivZWf`
- `target`: production
- `status`: Ready
- `created`: Fri May 22 2026 06:10:42 KST
- aliases include `https://openmanager-ai.vercel.app`

## Post-Deploy Smoke

Command:

```bash
npm run release:publish:patch
```

Release script post-deploy smoke result:

- `GET /`: PASS
- `GET /login`: PASS
- `GET /api/version`: PASS
- Expected version: `8.12.1`
- Smoke passed on attempt 50/81 after GitLab deploy propagation.

Production API checks:

- `GET https://openmanager-ai.vercel.app/api/version`: version `8.12.1`, commit `3c4df7a68c7b9931f32ba838faa027ebc75fb625`, pipeline `2544691552`
- `GET https://openmanager-ai.vercel.app/api/health`: healthy, database/cache/AI connected
- `GET https://ai-engine-jdhrhws7ia-an.a.run.app/health`: `status=ok`, version `8.12.1`, provider config enabled

Cloud Run:

- Revision: `ai-engine-00503-sq8`
- Traffic: `100%`
- Cloud Build: `09ff9465-57b4-48aa-8f51-af7783488cc2` success
- Cloud Build machineType: empty/default

## Usage Guard

Command:

```bash
npm run check:usage:vercel
```

Result:

- Billing context: `skyasus-projects`
- Period: `2026-05-01T07:00:00.000Z..2026-05-21T21:18:29.288Z`
- Effective: `14.0014 USD`
- Billed: `0.0000 USD`
- Charge count: `12180`
- Status: PASS via `vercel usage --format json --non-interactive`

## Scope Notes

- This was a release deployment smoke run, not a broad browser matrix.
- The AI grounding behavior changed in this release was covered by local contract/unit gates before deploy:
  - AI Engine targeted server metrics test: 25/25 PASS
  - AI Engine full test: 138 files / 1381 tests PASS
  - AI Engine type-check PASS
  - root lint PASS
  - root contract tests 24/24 PASS
- Production conversational AI QA was not rerun in this release-smoke record to avoid repeated live LLM usage; this run verifies deployment, version propagation, health, and CI smoke closure.
