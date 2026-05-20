# Vercel Playwright MCP AI State QA - v8.11.184

Run time: 2026-05-20T17:04:39+09:00

## Environment

- Target: https://openmanager-ai.vercel.app
- Vercel deployment: dpl_EAfnBF9W49oPUsAVn1cWwz8TAYZw
- Deployment URL: https://openmanager-8s0qbrpuy-skyasus-projects.vercel.app
- Version endpoint: 8.11.184 / Next.js 16.1.6
- Release tag: v8.11.184
- Deployed commit: 02a05eba19b7be4d9cc1d19bc9af015d53c6cdce
- Local HEAD at QA time: 760ca1e0370aa2fcc019abd844137316c945d312
- GitLab release pipeline: https://gitlab.com/skyasu2/openmanager-ai/-/pipelines/2536955714

## Vercel And Health State

- Vercel MCP deployment lookup returned READY for production alias openmanager-ai.vercel.app.
- /api/version returned version 8.11.184, releaseTag v8.11.184, commit 02a05eba19b7be4d9cc1d19bc9af015d53c6cdce.
- /api/health returned success=true and database/cache/ai all connected.
- Vercel usage check passed: effective 13.3467 USD, billed 0.0000 USD, chargeCount 11571 for the current billing period.

## Browser Flow

- Landing page rendered and dashboard CTA opened /dashboard.
- Dashboard rendered the OTel snapshot and 18-server state.
- AI sidebar opened from the dashboard and showed AI Engine Ready.
- AI traffic used /api/ai/supervisor/stream/v2 and returned HTTP 200.

## Dashboard State Observed

Initial dashboard snapshot:

- Total: 18
- Online: 16
- Warning: 1
- Risk: 1
- Offline: 0
- System resources: CPU 45%, Memory 54%, Disk 36%
- Top resource risks included cache-redis-dc1-01 MEM 93% and api-was-dc1-01 CPU 81%.

Later dashboard snapshot after slot/state refresh:

- Total: 18
- Online: 17
- Warning: 1
- Risk: 0
- Offline: 0
- System resources: CPU 41%, Memory 53%, Disk 33%
- Top resource risks included cache-redis-dc1-01 MEM 85%, cache-redis-dc1-03 MEM 71%, db-mysql-dc1-backup DISK 70%, api-was-dc1-01 CPU 69%.

## AI Response Checks

### Prompt 1

Prompt: 현재 서버 전체 상태를 요약해줘

Result:

- Visible response completed quickly.
- Correctly reported total 18, normal 16, warning 1, risk 1, offline 0.
- Correctly identified cache-redis-dc1-01 MEM 93% and api-was-dc1-01 CPU 81%.
- Metadata showed Streaming AI / monitoring domain evidence / monitoring-server-health.
- Warning: AI aggregate resource values were CPU 39%, Memory 49%, Disk 38%, while the dashboard showed CPU 45%, Memory 54%, Disk 36% at the observed snapshot.

### Prompt 2

Prompt: Vercel BFF와 Cloud Run AI Engine 책임 경계를 알려줘. KRL 근거가 있으면 함께 알려줘.

Result:

- Visible response completed through /api/ai/supervisor/stream/v2.
- Metadata showed general conversation response, not KRL or monitoring-domain evidence.
- The answer treated the request as a general/web-style technical answer despite this project having KRL architecture content for the Vercel BFF and Cloud Run AI Engine boundary.
- The visible answer leaked raw tool-call markers and reasoning JSON:
  - <|tool_call_begin|>
  - Nothing to process.
  - {"reasoning":"..."}

Assessment: FAIL for KRL/platform-boundary routing and FAIL for response sanitization.

### Prompt 3

Prompt: OpenManager OTel 데이터 SSOT와 18대 서버 상태 판단 기준을 KRL 근거로 요약해줘.

Result:

- Visible response completed through /api/ai/supervisor/stream/v2.
- Response was grounded in monitoring-server-health and correctly reported the refreshed server status: total 18, normal 17, warning 1, risk 0, offline 0.
- It identified cache-redis-dc1-01 MEM 85%.
- However, the requested OTel SSOT/KRL basis was not surfaced; the response collapsed to the live status summary.
- Warning: AI aggregate resource values were CPU 36%, Memory 47%, Disk 35%, while the dashboard showed CPU 41%, Memory 53%, Disk 33%.

Assessment: PASS for live monitoring status, WARN for requested KRL/SSOT evidence and resource aggregate parity.

## State Assessment

Production is operational at the platform level: Vercel deployment READY, health dependencies connected, dashboard rendering works, AI sidebar can answer live status prompts, and AI network calls returned 200.

Production is not fully green at AI state-quality level:

- KRL/platform-boundary questions are not reliably routed to internal knowledge evidence.
- AI response sanitization allowed raw tool-call/reasoning artifacts into the visible answer.
- Dashboard-to-AI aggregate resource values need parity investigation or explicit explanation if they intentionally use different aggregation semantics.

The deployed production commit is v8.11.184, while local HEAD at QA time was 760ca1e0370aa2fcc019abd844137316c945d312. Newer local KRL/code changes should not be assumed deployed until a semver-tag GitLab CI deploy runs.
