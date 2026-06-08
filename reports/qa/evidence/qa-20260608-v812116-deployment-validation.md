# QA Evidence - v8.12.116 Deployment Validation

Date: 2026-06-08 KST
Release: v8.12.116
Commit: 26829ed0c078c35ddd68c508cfa097e5419d03fc
Pipeline: https://gitlab.com/skyasu2/openmanager-ai/-/pipelines/2583781368

## Summary

- GitLab tag pipeline `2583781368` completed with status `success`.
- Frontend production `/api/version` returned `version=8.12.116`, `releaseTag=v8.12.116`, and commit `26829ed0c078c35ddd68c508cfa097e5419d03fc`.
- Cloud Run `/health` returned `status=ok` and `version=8.12.116`.
- Cloud Run free-tier limits remained `cpu=1` and `memory=512Mi`.
- Vercel usage check reported `billed=0.0000 USD` for the current billing period.

## Pipeline Jobs

- `deploy`: success
- `deploy_ai_engine`: success
- `post_deploy_smoke`: success
- `post_deploy_ai_engine_smoke`: success

## Commands

```bash
npm run gitlab:pipeline:head -- --wait
npm run gitlab:pipeline:inspect -- --pipeline 2583781368
curl -s https://openmanager-ai.vercel.app/api/version
curl -s https://ai-engine-jdhrhws7ia-an.a.run.app/health
npm run check:usage:vercel
npm run check:cloud-run-guard
```

## Notes

- Browser conversational AI QA was not repeated in this targeted deployment validation run.
- Public GitHub snapshot sync was not requested.
