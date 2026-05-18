# v8.11.169 Current Vercel Playwright MCP Check

Target: https://openmanager-ai.vercel.app
Version: 8.11.169
GitLab pipeline: https://gitlab.com/skyasu2/openmanager-ai/-/pipelines/2532228902
Checked at: 2026-05-18T09:53:39+09:00

## Playwright MCP Coverage

- Landing route `/` loaded with title `OpenManager AI - Operational Decision Support Assistant`.
- Footer version badge showed `v8.11.169`.
- Feature card region rendered all 4 cards:
  - `AI 어시스턴트`
  - `클라우드 플랫폼 활용`
  - `기술 스택`
  - `AI 개발 워크플로우`
- AI Assistant modal:
  - Opened detail view.
  - Toggled `아키텍처 보기`.
  - Diagram summary showed `8` layers, `21` nodes, `27` connections.
  - Verified labels include `Supervisor Router`, `Fact Layer`, `Knowledge Lite`, `Resumable v2`, `텍스트 Providers`.
- Cloud Platform modal:
  - Opened detail view after AI modal, confirming diagram state did not leak.
  - Toggled `아키텍처 보기`.
  - Diagram summary showed `4` layers, `11` nodes, `13` connections.
  - Verified labels include `Cloud Run Engine`, `validate · semver tag deploy`, `Upstash Redis`.
- Tech Stack modal opened in detail mode after prior diagram modal interactions.
- AI Development Workflow modal opened in `현재 도구` mode; `CI/CD` tab switched correctly.
- After Vibe CI/CD interaction, reopening AI Assistant returned to detail mode with `아키텍처 보기`, confirming modal state is scoped per card.

## Fallback Browser Smoke

The direct MCP browser context closed while clicking the landing `대시보드 열기` CTA, so dashboard/auth/API checks were separated into a non-MCP Playwright smoke using the same production URL.

- `/api/version`: `8.11.169`, commit `8e294644304f181bff1f74fa4fe4936bde833ebe`.
- `/api/health`: `healthy`
  - database connected, 7ms
  - cache connected, 6ms
  - ai connected, 1ms
- Fresh unauthenticated `/dashboard` navigation redirected to `/login?redirectTo=%2Fdashboard`.
- Login page rendered `OpenManager`, `로그인`, and `게스트`.
- Browser console/network:
  - Observed `401 /api/system` in unauthenticated context.
  - Classified as expected auth guard behavior, not a product regression.
  - No relevant unexpected HTTP `>=400` responses remained after filtering expected auth guard calls.

## Usage

- `npm run check:usage:vercel`
- Billing period: 2026-05-01..2026-05-18
- effective `10.7667 USD`
- billed `0.0000 USD`
- chargeCount `9744`
