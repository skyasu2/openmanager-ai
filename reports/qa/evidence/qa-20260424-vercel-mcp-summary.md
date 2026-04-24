# Vercel MCP QA Summary - 2026-04-24

Target: https://openmanager-ai.vercel.app
Environment: Vercel production frontend + Cloud Run AI backend
MCP/tools: Playwright MCP, Chrome DevTools MCP, next-devtools browser automation

## Frontend Routes

- `/`: rendered `OpenManager AI`, version `v8.11.32`; Next/React stack labels visible.
- `/login`: rendered `Login | OpenManager AI`; Google/GitHub/email/guest entry points visible; guest PIN modal opens through UI.
- `/privacy`: rendered privacy policy content and `/login` return link.
- `/dashboard`: guest UI login succeeded through real browser input/click; dashboard rendered with 18 total servers, 17 online, 1 critical, 0 warning, 0 offline.

## Dashboard and AI Assistant

- Dashboard snapshot label: `Synthetic OTel snapshot · 16:00 KST (slot 96/143)` and `Dataset v1.0.0 · catalog 2026-02-15 03:56Z`.
- AI sidebar opened from dashboard and reported engine state `Ready`.
- AI clarification flow appeared for a broad prompt and `전체 서버 현황` selection completed.
- Explicit AI response matched dashboard state: `전체 18대: 정상 17대, 경고 0대, 위험 1대, 오프라인 0대`.
- Critical server identified by AI: `cache-redis-dc1-01`, memory `91%`, with OOM/GC/cache eviction checks recommended.
- UI latency label for the explicit AI response: `2058ms`; Performance resource duration for `/api/ai/supervisor/stream/v2`: about `2798ms`.
- Nonblocking observation: the first auto/starter AI summary shown immediately after opening the sidebar used an older or alternate summary (`경고 1대, 위험 0대`, `storage-nfs-dc1-01`). The explicit current dashboard query corrected the state. Track as parity-watch, not as release blocker for this run.

## API and Network

Browser-side read-only API checks:

- `/api/health`: 200, status healthy; database/cache/ai connected; version `8.11.32`.
- `/api/health?service=ai`: 200, backend `cloud-run`, latency field `93ms`.
- `/api/version`: 200, version/buildVersion `8.11.32`, Next.js `16.1.6`, environment `production`.

Playwright dashboard network:

- `/api/monitoring/report`: 200
- `/data/otel-data/hourly/hour-16.json`: 200
- `/data/otel-data/timeseries.json`: 200
- `/api/system`: aborted retries followed by 200
- `/api/database`: 200
- `/api/health?service=ai`: 200
- `/api/ai/supervisor/stream/v2`: 200

Chrome DevTools landing network:

- Main document/static assets/manifest/icons: 200
- `/api/web-vitals`: 200
- `HEAD /api/system`: 401, same known nonblocking unauthenticated landing probe.

## Console

- Playwright dashboard console after guest + AI flow: 0 errors, 0 warnings.
- Chrome DevTools landing console: 1 error from `HEAD /api/system 401`; matches known `landing-console-api-system-unauthorized` WONT-FIX behavior.

## Performance and Lighthouse

Chrome DevTools performance trace on `/`:

- LCP: 995ms
- TTFB: 9ms
- LCP render delay: 986ms
- CLS: 0.05
- DOM elements: 169 on landing trace; max DOM depth 10; no estimated savings.

Lighthouse desktop navigation on `/`:

- Accessibility: 100
- Best Practices: 96
- SEO: 100
- Failed audit: `errors-in-console`, caused by the known landing `/api/system` 401.

Playwright dashboard navigation metrics:

- DOMContentLoaded: 549ms
- load: 606ms
- first-contentful-paint: 448ms
- decoded body size: 66,360 bytes
- DOM elements after dashboard + AI sidebar: 2,289

## Usage

- `npm run check:usage:vercel`: PASS
- Current period effective usage: 15.7310 USD
- Billed amount: 0.0000 USD
- Charge rows: 14007
