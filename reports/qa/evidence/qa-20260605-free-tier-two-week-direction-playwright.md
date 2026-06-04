# QA Evidence: Free Tier + Two-Week Direction Review

- Date: 2026-06-05 KST
- Target: Vercel production + Cloud Run production
- Production URL: https://openmanager-ai.vercel.app
- Production version: v8.12.89
- Production commit: 9ae1f6057b8dfa4f20ba1687a1f48aa83a08b88f
- Vercel deployment: dpl_5Af3pqTpnHXXXPUxqQWfRLWBR2r7
- Scope: targeted Playwright MCP verification plus free-tier guard review

## Free-Tier Findings

- Vercel usage check passed: effective 1.9358 USD, billed 0.0000 USD, chargeCount 1827.
- Vercel production alias resolves to a Ready deployment: `openmanager-4ifk1pedm-skyasus-projects.vercel.app`.
- Cloud Run `ai-engine` remains within the expected guardrail: cpu=1, memory=512Mi, maxScale=1, concurrency=16, CPU throttling enabled, 100% traffic on `ai-engine-00592-47p`.
- Cloud Run `/health` returned status ok for v8.12.89 and provider/API config was enabled.
- Recent Cloud Build history since 2026-05-22 did not expose a paid `options.machineType`; historical E2_HIGHCPU_8 builds exist only in older Jan-Feb 2026 history.
- Frontend `/api/health` returned healthy service state with database, cache, and AI connected.

Assessment: current production operation does not show an immediate free-tier cost problem. Continue keeping Cloud Run maxScale=1 and avoiding Cloud Build paid machine types.

## Recent Two-Week Direction

Reviewed commits and QA records from 2026-05-22 through 2026-06-05 KST. The main direction was:

- AI grounding and routing hardening: deterministic evidence, metric routing, trend/ranking filters, group comparisons, follow-up context, advisor/analyst routing, off-domain guard behavior, and response formatting.
- Dashboard and UX polishing: host map, alert feed, assistant label visibility, landing/loading polish, markdown rendering.
- CI, release, and free-tier operations: shell executor/local CI alignment, deploy preflight tooling, Cloud Build config cleanup, runner capacity reporting, QA evidence integrity, and release smoke stability.

QA trend for the period: 95 recorded runs, 662 checks, 601 passed, 19 failed historically, with the latest production runs green. Active gate warnings were empty in `reports/qa/QA_STATUS.md` before this run.

Assessment: the improvement direction is coherent. The latest production behavior confirms the important dashboard-to-AI grounding path rather than only local/unit behavior.

## Playwright MCP Verification

Scenario:

1. Navigate to `https://openmanager-ai.vercel.app`.
2. Confirm landing renders v8.12.89 and guest login surface.
3. Perform guest login through the PIN modal.
4. Click system start and wait for `/dashboard`.
5. Open AI assistant.
6. Send one cost-controlled representative prompt: `현재 서버 전체 상태를 요약해줘`.
7. Inspect console and API network activity.

Observed pass results:

- Guest login API: `POST /api/auth/guest-login` => 200.
- AI wake-up API: `POST /api/ai/wake-up` => 200.
- System boot APIs: `HEAD/POST/GET /api/system` after auth => 200.
- Monitoring report API: `GET /api/monitoring/report` => 200.
- Health/database APIs: `/api/health?service=ai&soft=true` and `/api/database` => 200.
- AI stream: `POST /api/ai/supervisor/stream/v2` => 200.
- Dashboard rendered 18 total servers, 17 online, 1 warning, 0 critical, 0 offline.
- Dashboard resource summary rendered CPU 29%, memory 46%, disk 37%.
- AI response matched the dashboard numbers and identified `db-mysql-dc1-primary` disk 83%.
- AI response exposed analysis basis with tool `monitoring-server-health`.
- PerformanceResourceTiming reported the AI stream resource duration at 1213ms.

Known non-blocking console item:

- Before authentication, landing produced one console error: `HEAD /api/system` => 401.
- This matches existing WONT-FIX item `landing-console-api-system-unauthorized`.
- After authentication, `/api/system` checks returned 200 and dashboard operation was unaffected.

## Evidence Files

- Accessibility snapshot: `tmp/playwright/mcp/snapshots/qa-20260605-two-week-direction-dashboard.yml`
- Console log: `tmp/playwright/mcp/snapshots/qa-20260605-two-week-direction-console.md`
- API network log: `tmp/playwright/mcp/snapshots/qa-20260605-two-week-direction-network.md`

The durable QA artifact is this Markdown file. The `tmp/playwright` files are session evidence and are intentionally not promoted to tracked artifacts.
