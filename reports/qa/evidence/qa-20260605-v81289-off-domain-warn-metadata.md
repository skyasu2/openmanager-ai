# QA Evidence - v8.12.89 Off-Domain Warn Metadata Production Check

Date: 2026-06-05 KST

## Target

- Production URL: https://openmanager-ai.vercel.app
- Release tag: `v8.12.89`
- Commit: `9ae1f6057b8dfa4f20ba1687a1f48aa83a08b88f`
- GitLab pipeline: https://gitlab.com/skyasu2/openmanager-ai/-/pipelines/2576980796
- Vercel deployment: `dpl_5Af3pqTpnHXXXPUxqQWfRLWBR2r7`
- Vercel deployment URL: https://openmanager-4ifk1pedm-skyasus-projects.vercel.app
- Cloud Run service URL: https://ai-engine-jdhrhws7ia-an.a.run.app
- Cloud Run revision: `ai-engine-00592-47p`

## Local Validation

- `cd cloud-run/ai-engine && npm run test -- src/lib/off-domain-guard.test.ts src/services/ai-sdk/supervisor-multi-fallback.test.ts`
  - 2 files passed
  - 40 tests passed
- `cd cloud-run/ai-engine && npm run type-check`
  - PASS
- `cd cloud-run/ai-engine && npm run test`
  - 148 files passed
  - 1629 tests passed
- `npm run test:contract`
  - 3 files passed
  - 24 tests passed

## Deployment Verification

- Base production gate before release:
  - `node scripts/test/vercel-post-deploy-smoke.mjs --expected-version=8.12.88`
  - PASS on attempt 1/1
- Release dry-run:
  - next version: `8.12.89`
  - release-as: `patch`
  - included fix: `fix(ai-engine): expose off-domain warn metadata`
- Release consistency:
  - `npm run docs:status:check`: PASS
  - `node scripts/release/check-release-consistency.js`: PASS
- Canonical push:
  - `git push --follow-tags gitlab main`
  - `v8.12.89` tag pushed
- Frontend production smoke:
  - `node scripts/test/vercel-post-deploy-smoke.mjs --expected-version=8.12.89`
  - PASS on attempt 8/81
- Cloud Run health polling:
  - `/health` switched from `8.12.88` to `8.12.89` on attempt 3

## Runtime State

- `GET https://openmanager-ai.vercel.app/api/version`
  - version: `8.12.89`
  - releaseTag: `v8.12.89`
  - commitSha: `9ae1f6057b8dfa4f20ba1687a1f48aa83a08b88f`
  - pipelineUrl: `https://gitlab.com/skyasu2/openmanager-ai/-/pipelines/2576980796`
- `vercel inspect https://openmanager-ai.vercel.app`
  - deployment: `dpl_5Af3pqTpnHXXXPUxqQWfRLWBR2r7`
  - status: Ready
  - alias: `https://openmanager-ai.vercel.app`
- `GET https://ai-engine-jdhrhws7ia-an.a.run.app/health`
  - status: `ok`
  - version: `8.12.89`
  - routesReady: `true`
  - config: `groq=true`, `mistral=true`, `zai=true`, `cerebras=true`, `gemini=true`, `tavily=true`, `cloudRunApi=true`
- `gcloud run services describe ai-engine --region=asia-northeast1`
  - latestReadyRevisionName: `ai-engine-00592-47p`
  - traffic: `100%`
  - cpu: `1`
  - memory: `512Mi`
  - image: `asia-northeast1-docker.pkg.dev/openmanager-free-tier/cloud-run/ai-engine:v-20260604-235032-9ae1f60`

## Guardrail Checks

Cloud Run direct supervisor route:

```text
POST /api/ai/supervisor
Headers: X-API-Key present, Content-Type application/json
```

### General coding warn metadata

- Query: `파이썬 피보나치 코드 짜줘`
- Result: pass
- Response includes: `서버 모니터링`
- Metadata:
  - provider: `groq`
  - modelId: `meta-llama/llama-4-scout-17b-16e-instruct`
  - offDomainAction: `warn`
  - offDomainCategory: `general_coding`
  - toolsCalled: `finalAnswer`
  - durationMs: `1451`
  - usage.totalTokens: `5379`

### Live/current fact block regression

- Query: `오늘 서울 날씨 알려줘`
- Result: pass
- Response includes: `실시간 외부 조회`
- Metadata:
  - provider: `deterministic`
  - modelId: `off-domain-guard`
  - offDomainAction: `block`
  - offDomainCategory: `live_fact`
  - usage.totalTokens: `0`

## Usage Guard

Command:

```bash
npm run check:usage:vercel
```

Result:

- Billing context: `skyasus-projects`
- Period: `2026-06-01T07:00:00.000Z..2026-06-04T15:01:36.508Z`
- Effective: `1.9358 USD`
- Billed: `0.0000 USD`
- Charge count: `1827`
- Status: PASS via `vercel usage --format json --non-interactive`

## Notes

- This was a targeted release-facing verification for the v8.12.89 metadata fix.
- Standard five-question conversational AI QA was not rerun because the change is metadata observability only; answer content, routing policy, tool schema, and provider policy were not changed.
- Vision real-image QA was not in scope because Vision routing/provider behavior did not change.
- GitLab API pipeline lookup returned 401 locally, so the pipeline id was taken from `/api/version` after production deploy.
