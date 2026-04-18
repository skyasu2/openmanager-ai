# QA Evidence - 2026-04-18 v8.11.20 Broad Production QA

- Target: https://openmanager-ai.vercel.app
- Scope: broad / release-facing
- Version observed: 8.11.20
- Deployment: dpl_8Th4eohuqf6tGKxqt1G4Vro6WRcr

## Covered
- `/` landing render, guest bootstrap, system start CTA
- `/main` redirect to `/`
- `/login` render with Google/GitHub/email/guest mode and privacy link
- `/privacy` render with back link
- `404` route render
- `/system-boot` via system start countdown -> `/dashboard`
- `/dashboard` render, resource summary, alert counts, top-5 resource warnings
- Active alerts modal -> AI sidebar prefill handoff
- AI sidebar freeform send -> streaming response
- `/dashboard/ai-assistant` fullscreen handoff with conversation retention
- Server detail modal 3 tabs (`종합 상황`, `성능 분석`, `로그 & 네트워크`) and ESC close

## Key observations
- Dashboard showed 18 servers total, 16 online, 1 warning, 1 critical, 0 offline.
- Resource warning top item was `cache-redis-dc1-01 MEM 91%`.
- AI sidebar prefill from active alert was correct and response returned grounded Redis memory guidance.
- Fullscreen assistant preserved the same conversation and exposed `AI 처리 과정 (3단계)` with `detectAnomalies`, `correlateMetrics`, `findRootCause`.
- A transient routing fallback notice was visible: `라우팅 타임아웃, Analyst Agent로 전환...`, then response completed successfully.
- Browser console remained clean on landing/dashboard/AI checked surfaces.

## Non-blocking notes
- 404 route produced one console error for the intentionally missing page resource, which is expected for that negative-path check.
- Network log contained some aborted `/api/system` and early `sentry-tunnel` requests during route transitions; final dashboard/API requests and AI stream request completed with 200.
