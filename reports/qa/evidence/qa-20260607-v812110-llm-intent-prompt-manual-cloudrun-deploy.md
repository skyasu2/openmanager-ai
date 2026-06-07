# QA Evidence - v8.12.110 LLM Intent Prompt Manual Cloud Run Deploy

Date: 2026-06-07 23:31 KST
Owner: codex
Target: Cloud Run production ai-engine
Commit: dca6870a0b6ab7589cef7e25d7af7f258de2e843

## Deployment

- Deploy path: manual-fallback (`cloud-run/ai-engine/deploy.sh`)
- GitLab branch pipeline: 2583000076 success
- Cloud Build: ad04b07e-90d2-46d0-bf92-a9e53f4e669f success
- Image tag: `v-20260607-232431-dca6870a0`
- Cloud Run revision: `ai-engine-00608-vq8`
- Traffic: `100%` to `ai-engine-00608-vq8`
- Service URL: `https://ai-engine-jdhrhws7ia-an.a.run.app`

## Preflight

- `cd cloud-run/ai-engine && npm run type-check`: passed
- `cd cloud-run/ai-engine && npm run test`: 160 files passed, 1683 tests passed
- `cd cloud-run/ai-engine && npm run docker:preflight`: passed
- Free-tier guard: passed
- Cloud Build machine type: default, no explicit paid machine type
- Cloud Run limits: `cpu=1`, `memory=512Mi`

## Smoke Checks

- `/health`: HTTP 200, `status=ok`, `version=8.12.110`
- `/monitoring` without auth: authentication required response
- `/monitoring` with `X-API-Key`: HTTP 200
- `/debug/prefilter?q=이상 없는 서버 목록`: `suggestedAgent=Metrics Query Agent`, `confidence=0.88`, expected behavior `Forced routing to Metrics Query Agent`

## Notes

- This deployment intentionally used the manual Cloud Run fallback path for an AI Engine-only prompt contract change.
- The app version remains `8.12.110`; deployed revision and image tag carry the commit identifier `dca6870a0`.
- No API keys or secret values are recorded in this evidence.
