# QA Evidence - v8.12.115 Healthy Server TOP-N Post-Deploy Pass

Date: 2026-06-08 08:42 KST
Owner: codex
Target: Vercel production + Cloud Run production ai-engine
Commit: f375b1e9760c835bbeb698c96a72e21e19e38fb5
Release: v8.12.115

## Context

Post-deploy smoke for v8.12.114 confirmed that `건강한 서버 TOP3 알려줘` and
`안정적인 서버 상위 3대` were deterministic, but still returned 17 numbered
healthy servers instead of the requested top 3. Root cause: the semantic intent
frame path preserved `topN`, but `parseCurrentMetricsFrame()` did not restore it
as `rankCount` for the `healthy-only` server-health branch.

## Fix

- Commit: `0f0b6b1ba fix(ai-engine): preserve healthy server top n through intent frame`
- Release commit: `f375b1e976 chore(release): 8.12.115`
- GitLab tag pipeline: `2583436598` success
- Cloud Run revision: `ai-engine-00613-vp4`
- Traffic: `100%` to `ai-engine-00613-vp4`
- Service URL: `https://ai-engine-jdhrhws7ia-an.a.run.app`

## Local Validation

- `cd cloud-run/ai-engine && npm test -- current-metrics-server-health-routing.test.ts`: 1 file / 20 tests passed
- `cd cloud-run/ai-engine && npm run type-check`: passed
- `cd cloud-run/ai-engine && npm test -- current-metrics-evidence-provider.test.ts current-metrics-boundary-guard.test.ts current-metrics-server-health-routing.test.ts`: 3 files / 33 tests passed
- `cd cloud-run/ai-engine && npm run test`: 161 files / 1691 tests passed

## Production Smoke

- Cloud Run `/health`: HTTP 200, `version=8.12.115`
- Vercel `/api/version`: `version=8.12.115`, `releaseTag=v8.12.115`, `pipelineUrl=https://gitlab.com/skyasu2/openmanager-ai/-/pipelines/2583436598`
- Cloud Run limits: `cpu=1`, `memory=512Mi`
- Cloud Run traffic: `100%` to `ai-engine-00613-vp4`

| Query | HTTP | Provider | Model | Final Agent | Numbered Items |
|---|---:|---|---|---|---:|
| 건강한 서버 TOP3 알려줘 | 200 | deterministic | monitoring-server-health | Metrics Query Agent | 3 |
| 안정적인 서버 상위 3대 | 200 | deterministic | monitoring-server-health | Metrics Query Agent | 3 |
| 이상 없는 서버 목록 | 200 | deterministic | monitoring-server-health | Metrics Query Agent | 17 |

## Notes

- `이상 없는 서버 목록` intentionally remains a full healthy-only list.
- The TOP-N variants now preserve the requested count through the intent-frame path.
- No API keys or secret values are recorded in this evidence.
