# QA Evidence: Vercel Production AI Sidebar Cerebras Recheck

- Date: 2026-04-29 KST
- Target: https://openmanager-ai.vercel.app
- Deployment id: dpl_Amo8uRyiubLFYuxn9LnHThSjk4Ve
- Reported version: 8.11.59
- Reported commit: 94f4dea65aa09f321b4fb883906afbcb4185a058
- Expected newer commit not deployed: 198183658 fix(ai): pin async job metric data slot

## Environment

- Vercel production deployment was Ready.
- `/api/version` still served v8.11.59 / 94f4dea.
- `/api/health?simple=true` returned a JSON pong response.
- `npm run check:usage:vercel` passed with effective usage 19.0897 USD and billed usage 0.0000 USD for the active period.

## Dashboard Baseline

- Slot: 16:30 KST, slot 99/143.
- Inventory: total 18, online 17, warning 0, risk 1, offline 0.
- Resource summary: CPU 40%, memory 51%, disk 39%.
- Top risk/value entries:
  - cache-redis-dc1-01 MEM 92%
  - api-was-dc1-01 CPU 78%
  - db-mysql-dc1-primary MEM 75%
  - api-was-dc1-02 CPU 74%
  - db-mysql-dc1-backup DISK 70%

## Query 1

- Prompt: "현재 서버 현황 간단히 요약해줘"
- UI path: clarification was shown, then "전체 서버 현황" was selected.
- Result: PASS.
- Job id: d64ba4b7-1d45-4847-9556-2317ef0f0db8.
- Main answer matched the dashboard baseline:
  - total 18
  - normal 17
  - warning 0
  - risk 1
  - cache-redis-dc1-01 memory 92%
- UI footer latency: 2150 ms.
- Browser resource timings:
  - POST /api/ai/jobs: 460 ms
  - GET /api/ai/jobs/d64ba4b7-1d45-4847-9556-2317ef0f0db8/stream: 3554 ms

## Query 2

- Prompt: "cache-redis-dc1-01 메모리 92% 상승 원인과 즉시 조치 3개를 분석해줘"
- Result: FAIL.
- Job id: 18eacb83-1f78-4192-94fd-544acf90bc86.
- Main visible assistant answer collapsed to:
  - "핵심 요약"
  - "분석 결과:"
- The "분석 근거" panel still contained useful detail:
  - cache-redis-dc1-01 memory was 92% and exceeded the 90% threshold.
  - Severity was high.
  - Immediate actions covered monitoring, cleanup/TTL, Redis parameter or scale optimization.
- Browser resource timings:
  - POST /api/ai/jobs: 459 ms
  - GET /api/ai/jobs/18eacb83-1f78-4192-94fd-544acf90bc86/stream: 15903 ms

## Cloud Run Evidence

Cloud Run logs around 2026-04-29T07:36:30Z..07:37:10Z showed:

- `/api/jobs/process` completed HTTP 200 in about 15 seconds.
- Cerebras API call target: `https://api.cerebras.ai/v1/chat/completions`.
- Model: `qwen-3-235b-a22b-instruct-2507`.
- Decomposition failed after retries with `queue_exceeded`.
- A later Cerebras call failed with `token_quota_exceeded` and `retry-after: 59`.
- Worker logged: `[Stream Analyst Agent] Empty response with 1 tool results - attempting summarization fallback`.

## Finding

The short deterministic summary path is production-safe for the observed dashboard slot. The longer Cerebras-backed analysis path is still not reliable in production because provider queue or token quota failures can leave the main visible answer nearly empty even though the evidence panel has enough structured detail.
