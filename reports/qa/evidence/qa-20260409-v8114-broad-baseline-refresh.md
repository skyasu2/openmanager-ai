# QA Evidence - v8.11.4 Broad Production Baseline Refresh

- Date: 2026-04-09 KST
- Target: https://openmanager-ai.vercel.app
- Deployment: dpl_FnzN8yJFRkS5TUkvQYWREJwtJGh2
- Deployment URL: https://openmanager-d30ys163z-skyasus-projects.vercel.app
- Commit: 8ca2b7eb59ff9de13b6d6ab817cfcd043af38d5a
- Source: Playwright MCP + Vercel CLI + curl

## Scope
- broad
- release-facing
- countsTowardSummary=true
- coverage packs: core-routes-smoke, dashboard-core, ai-core, secondary-routes

## Checks
1. Landing `/` renders `v8.11.4`, feature cards, and guest bootstrap state.
2. `/main` redirects to `/`.
3. `/login` renders Google/GitHub/email/guest entry points and privacy link.
4. `/privacy` renders policy and backlink.
5. `/auth/error` renders recovery actions.
6. Synthetic 404 route renders not-found UI with home/dashboard/login recovery links.
7. `/api/health` returns `healthy` with database/cache/ai connected and version `8.11.4`.
8. `/api/version` returns `version=8.11.4`, `buildVersion=8.11.4`, `nextjs=16.1.6`, `environment=production`.
9. Landing `시스템 시작` transitions through `/system-boot` and reaches `/dashboard`.
10. Dashboard renders `15 total / 14 online / 1 warning / 0 risk` and resource top5.
11. Server detail modal for `api-was-dc1-01` opens, all 3 tabs render, and `Escape` closes the modal.
12. AI sidebar opens with engine `Ready`, starter prompt `CPU 사용률이 높은 서버를 찾아줘` completes successfully.
13. Browser-session fetch to `/api/ai/supervisor/stream/v2` returns `200`, `Content-Type: text/event-stream`, `X-AI-Latency-Ms: 219`.
14. Final dashboard+AI flow console errors: 0.

## Notes
- Direct unauthenticated `curl` to `/api/ai/supervisor/stream/v2` correctly returned `401 Unauthorized - Please login first`; this confirms API auth guard remains active outside the guest browser session.
- During intentional navigation to `/does-not-exist`, browser console recorded one top-level 404 resource message. This did not reproduce in the main landing/login/dashboard/AI flow and is treated as synthetic not-found navigation noise, not a product regression.
- The AI sidebar response ranked current CPU leaders as `api-was-dc1-01 (80%)`, `web-nginx-dc1-02 (57%)`, `web-nginx-dc1-01 (55%)`.

## Durable Artifacts
- Screenshot: `reports/qa/evidence/qa-20260409-v8114-dashboard-broad.png`
- Screenshot: `reports/qa/evidence/qa-20260409-v8114-ai-sidebar-broad.png`
- Console: `reports/qa/evidence/qa-20260409-broad-console-errors.txt`
- Console: `reports/qa/evidence/qa-20260409-broad-console-final.txt`
- Network: `reports/qa/evidence/qa-20260409-broad-network.txt`
