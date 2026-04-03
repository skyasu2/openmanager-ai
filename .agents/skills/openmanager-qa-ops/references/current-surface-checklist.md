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

- Treat `QA-20260402-0213` as the current broad production reference for
  `v8.10.8` until a newer release-facing run supersedes it.
- Reference source:
  - `reports/qa/runs/2026/qa-run-QA-20260402-0213.json`
  - `reports/qa/qa-tracker.json`
  - `reports/qa/QA_STATUS.md`
- When a future QA run covers the same surface, compare deltas against this run
  instead of paraphrasing from memory.

### QA-20260402-0213 Proven Surface

- landing render + `v8.10.8`
- `Vibe Coding` modal 3 tabs:
  - `현재 도구`
  - `개발 환경 변화`
  - `CI/CD`
- `Vibe Coding` overview copy aligned to `배포·CI/CD 파이프라인`
- `CI/CD` tab pipeline content aligned to:
  - `로컬 훅 -> GitLab -> validate -> deploy -> Vercel`
- modal close + focus return
- `/login` minimal header:
  - `UnifiedProfileHeader` absent
- guest PIN login:
  - `4231`
  - login success -> landing redirect
- system start countdown:
  - `4s`
  - redirect to `/dashboard`
- dashboard:
  - `15` servers
  - `14` online
  - `1` risk
  - resource alert top5 visible
- AI sidebar open:
  - engine ready
- AI chat:
  - `/api/ai/supervisor/stream/v2` returns `200`
  - `lb-haproxy-dc1-01` CPU `85%` correctly identified
- API health/version:
  - `/api/health` healthy (`db:7ms`, `cache:5ms`, `ai:5ms`)
  - `/api/version` = `8.10.8`, `Next.js 16.1.6`
- runtime cleanliness:
  - browser console errors `0`
  - `/api/system` `401` regression not reproduced

### Reporting Rule For Similar Runs

- If a later run covers the same release-facing broad surface, report:
  - what remained green vs `QA-20260402-0213`
  - what regressed
  - what was intentionally skipped
- Avoid vague statements like `same as previous broad QA`.
- Name the concrete delta, for example:
  - `Vibe Coding modal still green vs QA-20260402-0213`
  - `dashboard AI chat regressed from QA-20260402-0213 baseline`
