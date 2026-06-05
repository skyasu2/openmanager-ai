# QA Evidence - v8.12.90 Vercel Playwright MCP Recheck After GitLab Token Recovery

Run context:
- Date: 2026-06-05 KST
- Target: `https://openmanager-ai.vercel.app`
- Deployment: `dpl_J1PEim6zfHjgGUoB9NcYqgEH2hVj`
- Release: `v8.12.90`
- Release commit: `36b29a5ca3d7e2505312cee873c6c7653c00e9c6`
- GitLab pipeline: `2577188591`
- Scope: targeted verification-only rerun
- Counting policy: `countsTowardSummary=false`

Purpose:
- Recheck Vercel production with Playwright MCP after GitLab API token recovery.
- Confirm that the already deployed pre-auth `/api/system` preload fix still holds.
- Confirm production route smoke, usage, and soft health behavior without inflating aggregate QA totals.

Commands and checks:
- `npm run qa:status`
  - Latest counted run before this rerun: `QA-20260605-0651`
  - Active Gate Warnings: none
  - Expert open gaps: 0
  - WONT-FIX items: 30
- `npm run mcp:playwright:windows:start`
  - Windows Playwright MCP server started on port `8931`
- `bash scripts/mcp/mcp-health-check-codex.sh --probe playwright`
  - MCP config status: 8/8 enabled
  - Playwright listed as enabled
  - live probe skipped because the active server mode is stdio
- `npm run check:usage:vercel`
  - effective: `1.9358 USD`
  - billed: `0.0000 USD`
  - chargeCount: `1827`
- `vercel inspect https://openmanager-ai.vercel.app --timeout 5m`
  - deployment `dpl_J1PEim6zfHjgGUoB9NcYqgEH2hVj`
  - target `production`
  - status `Ready`
  - production alias `https://openmanager-ai.vercel.app`
- `curl -sS https://openmanager-ai.vercel.app/api/version`
  - version `8.12.90`
  - releaseTag `v8.12.90`
  - commit `36b29a5ca3d7e2505312cee873c6c7653c00e9c6`
  - pipeline URL `https://gitlab.com/skyasu2/openmanager-ai/-/pipelines/2577188591`

Playwright MCP route and console checks:
- Pre-auth landing:
  - HTTP status: `200`
  - title: `OpenManager AI - Operational Decision Support Assistant`
  - H1: `OpenManager AI`
  - visible footer/version text included `v8.12.90`
  - console warning/error count: `0`
  - `/api/system` request count: `0`
  - public soft health preload path observed: `/api/health?service=ai&soft=true`
- `/login`:
  - HTTP status: `200`
  - title: `Login | OpenManager AI`
  - guest login button visible
  - expected login/provider copy visible
- `/main`:
  - final URL: `/`
  - HTTP status: `200`
  - landing content rendered
- `/privacy`:
  - HTTP status: `200`
  - title: `개인정보 처리방침 | OpenManager AI`
  - policy content rendered
- Intentional 404 route:
  - HTTP status: `404`
  - title: `404 - Page Not Found | OpenManager AI`
  - custom 404 body rendered
  - browser reported the expected document 404 console error for this intentional route only
- Guest login modal:
  - guest PIN modal opened from `/login`
  - no console warning/error while opening the modal
  - dashboard login was not completed because the MCP execution sandbox cannot read `.env.local` or process env and the PIN was not passed into the MCP session

Health behavior:
- First direct soft health check after the run returned `200` with `status=degraded`, `reasonCode=cloud_run_health_timeout`, `recoverable=true`.
- A subsequent Playwright MCP fetch and direct curl retry returned:
  - status `ok`
  - healthy `true`
  - backend `cloud-run`
  - latency `92ms`
  - ai-engine version `8.12.89`
- Interpretation: recoverable cold-start timeout, not an active production failure.

Result:
- Decision: `go` for the tested targeted scope.
- No active Vercel production regression was observed.
- No `/api/system` pre-auth regression was observed.
- No free-tier billing concern was observed.
