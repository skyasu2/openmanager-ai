# QA Evidence - Vercel Frontend UI/UX Sweep

- Date: 2026-04-24 KST
- Target: https://openmanager-ai.vercel.app
- Environment: Vercel production
- Vercel deployment: dpl_Ab1ZA6FUYvA4LE67mWidSFvPvYP2 / openmanager-q87lt2d2i-skyasus-projects.vercel.app
- Git HEAD: 31431acea
- Method: Playwright MCP manual interaction + Playwright E2E on Vercel production

## Manual Playwright MCP Coverage

- Landing `/`: header, profile state, system start CTA, feature cards, version/footer rendered.
- Landing feature modal: AI assistant feature modal opened, content rendered, close button worked.
- System boot: system start CTA navigated through `/system-boot` to `/dashboard`.
- Dashboard core: summary cards, status counters, resource widgets, top-5 resource warnings, server cards, session timer rendered.
- Alert modal: active alert button opened modal with current warning item and footer stats; close worked.
- Alert history modal: history button opened modal with filters, anchor timestamp, stats, and alert item; close worked.
- Log explorer modal: log button opened modal with keyword input, level filters, source/server filters, terminal log list, stats; close worked.
- Topology modal: topology map opened with layer/node/edge diagram and controls; close worked.
- Server detail modal: server card opened modal; overview, performance analysis, and log/network tabs switched correctly; close worked.
- AI assistant: sidebar opened, starter prompt cards/input/status/sidebar close were visible and usable without triggering external LLM call.
- Profile menu: guest profile menu opened with session timer, dashboard/login/session actions, and no admin-only item observed.
- Pagination/more: `11개 더 보기` expanded additional server cards.
- Mobile viewport: dashboard rendered at 390x844; mobile E2E verified no horizontal overflow and server detail modal open.

## Automated Playwright Coverage

Command 1:

```bash
PLAYWRIGHT_BASE_URL=https://openmanager-ai.vercel.app PLAYWRIGHT_GUEST_PIN=4231 PLAYWRIGHT_VERCEL_WORKERS=1 PLAYWRIGHT_CHANNEL=chromium ./node_modules/.bin/playwright test tests/e2e/dashboard-alerts-logs.spec.ts tests/e2e/dashboard-server-cards.spec.ts tests/e2e/dashboard-ai-sidebar.spec.ts tests/e2e/mobile-responsive.spec.ts --config playwright.config.vercel.ts --project=chromium --workers=1 --reporter=line
```

Result: 16 passed, 2 skipped, 0 failed. The 2 skipped tests were mobile-only tests intentionally skipped under the desktop `chromium` project.

Command 2:

```bash
PLAYWRIGHT_BASE_URL=https://openmanager-ai.vercel.app PLAYWRIGHT_GUEST_PIN=4231 PLAYWRIGHT_VERCEL_WORKERS=1 PLAYWRIGHT_VERCEL_INCLUDE_MOBILE=1 PLAYWRIGHT_CHANNEL=chromium ./node_modules/.bin/playwright test tests/e2e/mobile-responsive.spec.ts --config playwright.config.vercel.ts --project=mobile-chromium --workers=1 --reporter=line
```

Result: 2 passed, 0 failed.

## Usage Guard

`npm run check:usage:vercel` passed before broad QA. Reported current billing period effective usage 15.7313 USD, billed 0.0000 USD, chargeCount 14007.

## Post-Review Core Route Follow-up

During review, the broad `core-routes-smoke` declaration was rechecked with an
additional Playwright route/API smoke:

- `/` returned 200 and rendered the OpenManager AI landing heading.
- `/login` returned 200 and rendered login/guest entry copy.
- `/qa-non-existent-route-404` returned 404 and rendered the not-found page.
- `/api/health` returned 200 with healthy service metadata.
- `/api/version` returned 200 with `8.11.32`, `Next.js 16.1.6`, and `production`.
- Actionable browser console errors/warnings were 0 after excluding the existing
  accepted policy item `landing-console-api-system-unauthorized`
  (`/api/system` 401 in unauthenticated landing state).

Evidence: `reports/qa/evidence/qa-20260424-vercel-core-routes-followup.log`.

## UI/UX Review Notes

- No blocker found in the checked frontend flow.
- Desktop visual hierarchy is readable across dashboard, feature modal, log terminal, topology, and server detail modal.
- Mobile header is dense and the product name is visually truncated under 390px width, but the responsive E2E passed no-horizontal-overflow and server modal interaction. Treat as low-priority visual polish, not a release blocker.
- This run did not submit a real AI prompt; AI validation here is limited to assistant surface readiness, starter prompt selection, input visibility, and sidebar open/close.
