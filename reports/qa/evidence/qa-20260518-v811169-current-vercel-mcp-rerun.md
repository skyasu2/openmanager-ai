# v8.11.169 Current Vercel Playwright MCP Rerun

Target: https://openmanager-ai.vercel.app
Version: 8.11.169
GitLab pipeline: https://gitlab.com/skyasu2/openmanager-ai/-/pipelines/2532228902
Checked at: 2026-05-18T10:13:54+09:00

## Playwright MCP Recovery

- Initial Playwright MCP navigation returned `Target page, context or browser has been closed`.
- `browser_close` reset the stale MCP tab state.
- A fresh Playwright MCP navigation then loaded production successfully.

## Playwright MCP Coverage

- Landing route `/` loaded with title `OpenManager AI - Operational Decision Support Assistant`.
- Footer version badge showed `v8.11.169`.
- Feature card region rendered all 4 cards.
- AI Assistant modal:
  - Opened detail view.
  - Toggled `아키텍처 보기`.
  - Diagram summary showed `8` layers, `21` nodes, `27` connections.
  - Verified labels include `Supervisor Router`, `Fact Layer`, `Knowledge Lite`, `Resumable v2`, `텍스트 Providers`.
- Cloud Platform modal:
  - Opened detail view after AI diagram interaction, confirming diagram state did not leak.
  - Toggled `아키텍처 보기`.
  - Diagram summary showed `4` layers, `11` nodes, `13` connections.
  - Verified labels include `Cloud Run Engine`, `validate · semver tag deploy`, `Upstash Redis`.
- AI Development Workflow modal:
  - Opened in `현재 도구` state.
  - Switched to `CI/CD` tab successfully.
- Reopened AI Assistant after Vibe CI/CD interaction:
  - Returned to detail view.
  - `아키텍처 보기` button was visible again.
  - Confirms modal state remains scoped per card/view.
- Dashboard CTA:
  - `대시보드 열기` navigated to `/dashboard`.
  - Dashboard title `Dashboard | OpenManager AI`.
  - Sidebar links visible: `개요`, `서버`, `알림`, `로그`, `토폴로지`.
  - Header `AI 어시스턴트` button visible.
  - Server snapshot showed `18` total, `16` online, `1` warning, `1` risk, `0` offline.
  - System resources visible: CPU `41%`, Memory `51%`, Disk `35%`.

## Console And Network

- Playwright MCP console messages: `0` errors, `0` warnings.
- Network requests:
  - `/api/system` HEAD/GET: `200`
  - `/api/ai/wake-up`: `200`
  - `/dashboard?_rsc=...`: `200`
  - `/data/otel-data/hourly/hour-10.json`: `200`
  - `/api/monitoring/report`: `200`
  - `/data/otel-data/timeseries.json`: `200`
  - Two `/api/system` requests were `net::ERR_ABORTED` during navigation and were not user-visible failures.

## API And Usage

- `/api/version`: `8.11.169`, commit `8e294644304f181bff1f74fa4fe4936bde833ebe`.
- `/api/health`: `healthy`
  - database connected, 4ms
  - cache connected, 3ms
  - ai connected, 3ms
- `npm run check:usage:vercel`
  - Billing period: 2026-05-01..2026-05-18
  - effective `10.7667 USD`
  - billed `0.0000 USD`
  - chargeCount `9744`
