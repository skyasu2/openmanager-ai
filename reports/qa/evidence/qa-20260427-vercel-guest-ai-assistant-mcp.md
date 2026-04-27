# Vercel Guest Login AI Assistant MCP Check

- Date: 2026-04-27 KST
- Target: https://openmanager-ai.vercel.app
- Deployment: dpl_9Ni1cic8moLhSj3YXfhkLrDDkNkp
- Version: 8.11.36
- Source: Playwright MCP browser session

## Checks

- `/api/version` returned `8.11.36`, Next.js `16.1.6`, production.
- `/api/health` returned healthy with database, cache, and AI connected.
- `/login` guest PIN flow created a guest session.
- Authenticated `/dashboard` rendered with 18 total servers, 17 online, 1 warning, 0 risk, 0 offline.
- AI sidebar opened and showed `AI 엔진 상태: Ready`.
- AI chat response rendered for a server-status summary query.
- Direct prompt `현재 경고 상태인 서버와 조치 권고를 짧게 요약해줘` returned a concrete response for `cache-redis-dc1-01` memory warning.
- The direct response showed `1778ms`, `Streaming AI`, and analysis basis with `서버 메트릭 조회`.
- Browser console messages: 0 errors, 0 warnings.
- Relevant network requests: `/api/system` 200, `/api/health?service=ai` 200, `/api/ai/supervisor/stream/v2` 200.

## Notes

- Two navigation-related `/api/system` aborted requests were observed before dashboard stabilization. They were non-blocking and followed by a successful `/api/system` 200.
- Cloud Run admin `/monitoring` and `/monitoring/traces` were not included in this Vercel UI-focused check.
