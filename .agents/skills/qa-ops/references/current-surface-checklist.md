# Current Product Surface Checklist

Use this checklist to ensure QA covers the pages and features that exist today,
not just the original baseline flow.

## Route Surface

- `/`
  - Landing render
  - Profile bootstrap state coherence
  - Feature card modals
  - System start CTA and countdown
  - Guest restriction modal
- `/main`
  - Legacy redirect to `/`
- `/login`
  - OAuth buttons
  - Guest PIN login
  - Login policy copy
  - Privacy link
- `/system-boot`
  - Boot flow
  - Redirect to `/dashboard`
- `/dashboard`
  - 15 server cards
  - Resource overview
  - Status filter
  - Active alerts modal
  - Topology modal
  - Server detail modal (3 tabs)
  - Log explorer modal
  - Profile menu
- `/dashboard/ai-assistant`
  - Fullscreen AI workspace
- `/auth/error`
  - Auth failure fallback page
- `/auth/success`
  - Legacy callback handoff / redirect behavior
- `/privacy`
  - Policy page render and back-link

## AI Product Surface

- AI sidebar open/close
- Starter prompts
- Tools menu / right panel
- Streaming chat response
- Feedback flow
- Analyst full analysis and drilldown / empty state
- Reporter generate / empty CTA / detail view / state retention

## Observability And Security Surface

- Vercel timing header SSOT
  - `X-AI-Latency-Ms`
  - `X-AI-Processing-Ms`
- Vercel observability panel surface
  - dashboard server-status summary
  - system resource panel
  - resource alert top5
  - notification badge
  - `/api/health`
- Cloud Run admin observability surface
  - direct `CLOUD_RUN_AI_URL/monitoring`
  - direct `CLOUD_RUN_AI_URL/monitoring/traces`
  - requires `X-API-Key: $CLOUD_RUN_API_SECRET`
  - not served from `https://openmanager-ai.vercel.app/monitoring/*`
- Langfuse traceId propagation / live proof
- Prompt injection / blocked input regression UX
- Security regression smoke pack

## Coverage Rules

- Use `docs/guides/testing/test-strategy.md` for the risk-based testing methodology.
- Pick representative high-risk scenarios instead of broad route/device/provider matrices.
- Do not repeat live QA runs to chase coverage percentage. Use targeted reruns only when they validate a specific fix or newly covered risk.
- Broad or release QA should explicitly list:
  - covered surfaces
  - intentionally skipped surfaces
  - coverage packs
  - which checks ran on Vercel vs local vs Cloud Run
- If a route or feature changed in this task, cover at least one scenario for
  that surface or state why it was not tested.
- Vercel production `broad` / `release-gate` run should include these minimum
  coverage packs:
  - `core-routes-smoke`
    - `/`
    - `/login`
    - `404`
    - `/api/health`
    - `/api/version`
    - production console cleanliness
  - `dashboard-core`
    - `/system-boot` to `/dashboard`
    - dashboard render
    - server modal 3-tab switch
    - ESC close
  - `ai-core`
    - AI sidebar open/close
    - starter prompt or representative chat send
    - streaming/timing header proof when AI path is in scope
- Use targeted follow-up packs instead of inflating one monolithic broad run:
  - `ai-advanced-surface`
  - `modal-detail-pack`
  - `security-pack`
  - `observability-pack`
    - if this pack is Vercel-only, explicitly skip Cloud Run admin `/monitoring` and `/monitoring/traces`
    - if this pack includes Cloud Run admin checks, call `run.app` directly with `X-API-Key` and record that host in notes/links

## Summary Counting Rule

- Set `countsTowardSummary=false` when the run is only a propagation check, evidence
  sync check, or other meta verification on an already-covered deployment.
- Keep `countsTowardSummary=true` when the run meaningfully adds or refreshes product
  coverage and should change aggregate totals.
- Do not use repeated propagation checks to move `Total runs` or `Total checks`.

## Current Production Reference

- Treat `QA-20260415-0291` as the current broad production reference for
  `v8.11.12` until a newer broad or release-facing run supersedes it.
- Latest targeted production refresh for the current live copy baseline:
  - `QA-20260417-0298` (`v8.11.16`, landing/sidebar copy trim + AI sidebar verification)
- Latest broad production attempt on the same live deployment:
  - `QA-20260417-0299` (`v8.11.16`, `17/18` green, but repeated `next/font preload unused` warnings on `/dashboard` and `/dashboard/ai-assistant`, so it did **not** supersede the broad reference)
- Reference source:
  - `reports/qa/runs/2026/qa-run-QA-20260415-0291.json`
  - `reports/qa/runs/2026/qa-run-QA-20260417-0298.json`
  - `reports/qa/runs/2026/qa-run-QA-20260417-0299.json`
  - `reports/qa/qa-tracker.json`
  - `reports/qa/QA_STATUS.md`
- Compare future broad/release-facing runs against `QA-20260415-0291`
  instead of paraphrasing from memory.
- Previous comparable baseline:
  - `QA-20260406-0246` (`v8.10.9`)

### QA-20260415-0291 Proven Surface

- landing render + version badge on `v8.11.12`
- `/main` redirect to `/`
- `/login` render with Google/GitHub/email/guest PIN entry
- `/privacy` render with back-link to login
- `404` route render
- system start countdown:
  - `/system-boot` observed
  - redirect to `/dashboard`
- dashboard:
  - `15` total
  - `14` online
  - `1` warning
  - `0` risk
  - `0` offline
  - system resources `37 / 47 / 37`
- active alerts modal render + `ESC` close
- topology modal render (`15` nodes / `20` edges) + `ESC` close
- dashboard warning CTA opens AI sidebar with prefilled prompt
- AI sidebar first-hit response:
  - grounded disk warning analysis for `storage-nfs-dc1-01`
  - analysis basis detail preserved `traceId + tools + timeRange`
- `/dashboard/ai-assistant` fullscreen workspace:
  - restores the same conversation
  - preserves analysis basis parity after sidebar handoff
- API health/version:
  - `/api/health` `200`
  - `/api/version` = `8.11.12`, `Next.js 16.1.6`, `production`
- runtime cleanliness:
  - browser console errors `0`
  - browser console warnings `0`

### Reporting Rule For Similar Runs

- If a later run covers the same release-facing broad surface, report:
  - what remained green vs `QA-20260415-0291`
  - what regressed
  - what was intentionally skipped
- Avoid vague statements like `same as previous broad QA`.
- Name the concrete delta, for example:
  - `landing/login/privacy/dashboard core remained green vs QA-20260415-0291`
  - `dashboard AI chat regressed from QA-20260415-0291 baseline`
  - `fullscreen/dashboard console cleanliness regressed from QA-20260415-0291 baseline due to repeated next/font preload warnings`
