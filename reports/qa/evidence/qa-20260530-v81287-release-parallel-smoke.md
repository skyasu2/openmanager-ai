# QA Evidence - v8.12.87 Release Parallel Deploy Smoke

Date: 2026-05-30 KST

## Target

- Production URL: https://openmanager-ai.vercel.app
- Release tag: `v8.12.87`
- Commit: `ed19d759578fb5cc4ca0afeed65068f1b5dcf80c`
- Vercel deployment: `dpl_JD28Eo72pCqgfRMP6qPEJ6M8pBzf`
- Deployment URL: https://openmanager-4hgyfqlcr-skyasus-projects.vercel.app
- Cloud Run service URL: https://ai-engine-jdhrhws7ia-an.a.run.app

## GitLab CI

- Pipeline: https://gitlab.com/skyasu2/openmanager-ai/-/pipelines/2563996427
- Status: `success`
- Ref: `v8.12.87`
- Jobs:
  - `deploy`: success
  - `deploy_ai_engine`: success
  - `post_deploy_smoke`: success
  - `post_deploy_ai_engine_smoke`: success

## Parallel Deploy Timing

`npm run gitlab:pipeline:inspect -- --pipeline 2563996427`:

- Pipeline duration: `280s`
- `deploy` started at `2026-05-30T13:37:20.120Z`, duration `197.570735s`
- `deploy_ai_engine` started at `2026-05-30T13:37:20.992Z`, duration `268.537525s`
- Deploy stage wall time: `269s`
- Deploy duration sum: `466.11s`
- `deploy_parallelism`: `overlap_detected`
- Overlap: `197s`
- Start delta: `0s`
- Resource queues: none

## Post-Deploy Smoke

Release script:

- Current production version gate passed for `8.12.86`
- GitLab release pipeline `2563996427` completed successfully
- Production smoke passed on attempt 1/81 for expected version `8.12.87`

Production API checks:

- `GET https://openmanager-ai.vercel.app/api/version`: version `8.12.87`, release tag `v8.12.87`, commit `ed19d759578fb5cc4ca0afeed65068f1b5dcf80c`, pipeline `2563996427`
- `GET https://ai-engine-jdhrhws7ia-an.a.run.app/health`: `status=ok`, version `8.12.87`, routes ready
- `GET https://ai-engine-jdhrhws7ia-an.a.run.app/monitoring` without auth: `403`, expected for protected monitoring

Cloud Run:

- Revision: `ai-engine-00590-s2t`
- Traffic: `100%`
- Runtime limits: `cpu=1;memory=512Mi`
- Latest Cloud Build after release: success
- Cloud Build machineType: empty/default

## Usage Guard

Command:

```bash
npm run check:usage:vercel
```

Result:

- Billing context: `skyasus-projects`
- Period: `2026-05-01T07:00:00.000Z..2026-05-30T13:43:46.264Z`
- Effective: `19.8825 USD`
- Billed: `0.0000 USD`
- Charge count: `17661`
- Status: PASS via `vercel usage --format json --non-interactive`

## Scope Notes

- This was a release deployment smoke and CI topology verification run, not a broad browser matrix.
- Production conversational AI QA was not rerun because the release changed CI/release infrastructure and version metadata, not AI prompt routing, tool schema, provider selection, response formatting, or Vision routing.
- Vision real-image QA was not in scope because Vision routing/provider behavior did not change.
