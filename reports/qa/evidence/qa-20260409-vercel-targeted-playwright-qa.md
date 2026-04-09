# Vercel Targeted QA Evidence — 2026-04-09

- Target: https://openmanager-ai.vercel.app
- Mode: Playwright MCP (manual targeted)
- Scope packs: core-routes-smoke, dashboard-core, ai-core, observability-pack (Vercel-side)

## Route checks
- `/` landing render OK, footer version `v8.11.4`
- `/main` redirects to `/`
- `/login` OAuth/email/guest entry UI render OK
- `/privacy` render + back link OK
- `/auth/error` fallback actions render OK
- `/auth/success` redirects to `/login?error=no_user` (expected handoff)
- Synthetic 404 route render OK

## Dashboard + AI checks
- `/system-boot` start flow reached `/dashboard` after countdown
- Dashboard counters OK: total 15 / online 14 / warning 1 / risk 0
- Resource summary and Top5 warning list render OK
- AI sidebar open/close OK
- AI query `현재 모든 서버 상태를 2문장으로 요약해줘` returned 정상 응답
- Network log includes `POST /api/ai/supervisor/stream/v2 => 200`

## API checks
- `/api/health` 200 (`version: 8.11.4`, DB/Cache/AI connected)
- `/api/version` 200 (`buildVersion: 8.11.4`, `nextjs: 16.1.6`)

## Console/Warnings
- Console errors file: `Total messages: 0 (Errors: 0, Warnings: 0)`
- Warning file has 4 preload warnings (font preload unused timing); non-blocking.
