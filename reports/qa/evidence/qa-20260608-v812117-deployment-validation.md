# QA Evidence - v8.12.117 Deployment Validation

Recorded: 2026-06-08 KST

## Scope

Targeted production deployment validation for `v8.12.117`.

## Evidence

- GitLab tag pipeline `2583876860` succeeded for `v8.12.117`.
- Release commit: `13a501c403565ada062815d7f10cca66258bc1d1`.
- Frontend `/api/version` returned `version=8.12.117`, `releaseTag=v8.12.117`, and the release commit SHA.
- Frontend `/api/health` returned `success=true`, `status=healthy`, and `version=8.12.117`.
- Cloud Run AI Engine `/health` returned `status=ok`; its version remained `8.12.116` because this release did not include AI Engine implementation changes and the release script intentionally did not bump AI Engine metadata.
- Vercel usage check passed: effective `3.8906 USD`, billed `0.0000 USD`.
- Cloud Run free-tier guard passed: maxScale `1`, concurrency `16`, timeout `300`, cpu `1`, memory `512Mi`, cpu throttling `true`.

## Commands

```bash
bash scripts/gitlab/check-head-pipeline.sh --sha 13a501c40 --wait
npm run gitlab:pipeline:inspect -- --pipeline 2583876860
curl -s https://openmanager-ai.vercel.app/api/version
curl -s https://openmanager-ai.vercel.app/api/health
curl -s https://ai-engine-jdhrhws7ia-an.a.run.app/health
npm run check:usage:vercel
npm run check:cloud-run-guard
```

## Result

Deployment validation passed. No active gate warning was observed in this run.
