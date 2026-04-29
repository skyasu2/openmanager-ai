# QA Evidence: v8.11.60 Vercel Production AI Sidebar Recheck

- Date: 2026-04-29 KST
- Target: https://openmanager-ai.vercel.app
- Vercel deployment: dpl_5trDsasn1jmGV4ic8UqEiu1k3vAe
- Vercel deployment URL: https://openmanager-qkz5q3fpu-skyasus-projects.vercel.app
- Version: 8.11.60
- Commit: 6d97486d1a8b5bc32e0e5b926091f909ae7212c4
- Release tag: v8.11.60
- GitLab tag pipeline: https://gitlab.com/skyasu2/openmanager-ai/-/pipelines/2487846461

## Deployment Verification

- Release script created `chore(release): 8.11.60` and tag `v8.11.60`.
- GitLab tag pipeline `2487846461` completed successfully.
- Jobs:
  - `deploy`: success, 135.0s
  - `deploy_ai_engine`: success, 331.0s
  - `post_deploy_smoke`: success, 6.4s
  - `post_deploy_ai_engine_smoke`: success, 9.2s
- `/api/version` returned `8.11.60`, commit `6d97486d1`, release tag `v8.11.60`.
- `/api/health?simple=true` returned JSON pong.
- `/api/health?service=ai` returned `status: ok`, `backend: cloud-run`, latency 154ms.
- Cloud Run `/health` returned `status: ok`, version `8.11.60`, Redis enabled, routes ready.

## Usage Check

- Command: `npm run check:usage:vercel`
- Result: PASS.
- Active period usage: effective 19.0897 USD, billed 0.0000 USD.

## Dashboard Baseline

- Browser: fresh Playwright MCP session.
- Dashboard loaded through guest session and system start flow.
- Dashboard displayed Vercel static OTel slot 110/143 at 18:20 KST.
- Inventory: total 18, online 17, warning 1, critical 0, offline 0.
- Resource summary: CPU 31%, memory 48%, disk 39%.
- Top resource warning: `cache-redis-dc1-01` MEM 81%.

## Query 1: Summary

- Prompt: `현재 서버 현황 간단히 요약해줘`
- UI clarification selected: `전체 서버 현황`
- Result: PASS.
- Job id: `5baeb6e3-4186-4560-a897-70f55b7bb3db`
- Main answer:
  - total 18
  - normal 17
  - warning 1
  - critical 0
  - offline 0
  - `cache-redis-dc1-01` memory 82%
- UI footer latency: 2418ms.
- Browser Performance API:
  - `POST /api/ai/jobs`: 1129ms
  - `GET /api/ai/jobs/5baeb6e3-4186-4560-a897-70f55b7bb3db/stream`: 3035ms, EventSource `initiator: other`

## Query 2: Cerebras Queue Fallback Regression

- Prompt: `cache-redis-dc1-01 메모리 82% 상승 원인과 즉시 조치 3개를 분석해줘`
- Result: PASS.
- Job id: `98d5bc6e-f4af-491d-8565-e8bdf5f4e8fe`
- Main visible answer was complete. It did not collapse to heading-only text.
- Main answer included:
  - `cache-redis-dc1-01`, memory 82%, warning status
  - correlation evidence `r=0.92`
  - root-cause hypothesis: Redis cache data growth, confidence 80%
  - causal chain: data growth -> memory usage rise -> CPU load rise
  - three immediate actions: Redis cache cleanup, memory threshold adjustment, 5-minute monitoring
- UI footer latency: 17606ms.
- Browser Performance API:
  - `POST /api/ai/jobs`: 751ms
  - `GET /api/ai/jobs/98d5bc6e-f4af-491d-8565-e8bdf5f4e8fe/stream`: 18276ms, EventSource `initiator: other`
- Cloud Run logs showed Cerebras Qwen still hit `queue_exceeded` at 2026-04-29T09:37:04Z.
- The regression is fixed because the main response still rendered a complete fallback answer after Cerebras failed.

## Data Slot Note

- The dashboard was loaded at slot 110/143, where `cache-redis-dc1-01` memory is 81%.
- The AI job was created after the next 10-minute boundary and used query-time slot 111/143, where `cache-redis-dc1-01` memory is 82%.
- This matches the queryAsOf behavior: async jobs answer from the query creation slot, not from a stale dashboard render.

## Finding

Both pending P1 items from QA-20260429-0369 are resolved in the tested production scope:

- `deploy-query-as-of-fix-to-production`: resolved by v8.11.60 production deployment.
- `ai-analysis-main-response-empty-on-cerebras-quota`: resolved by stream/provider fallback behavior; Cerebras queue failure no longer leaves the main answer empty.
